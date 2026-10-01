import { parseScript, compareSpeech, textLinesFromItems } from './rehearsal-core.mjs?v=214';

const ui = Object.fromEntries([
  'scriptInput', 'rehearsalStatus', 'rehearsalWorkspace', 'actorRole', 'rehearsalScene',
  'rehearsalRate', 'followSpeech', 'hideActorLine', 'speechPrivacy', 'rehearsalSceneTitle',
  'rehearsalCounter', 'rehearsalSpeaker', 'rehearsalDirections', 'rehearsalCue', 'rehearsalLine',
  'revealActorLine', 'speechProgress', 'speechProgressLabel', 'recognizedSpeech',
  'startRehearsal', 'pauseRehearsal', 'repeatRehearsal', 'continueRehearsal',
  'rehearsalVoices', 'scriptReview', 'rehearsalTranscriptStrip', 'rehearsalTranscriptFilter'
].map((id) => [id, document.getElementById(id)]));
const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const synthesis = window.speechSynthesis;
let importSequence = 0;
const rehearsal = {
  scenes: [], scene: 0, line: 0, running: false, generation: 0,
  recognition: null, utterance: null, timer: null, restartTimer: null,
  transcript: '', matched: [], voices: [], selectedVoices: new Map(), revealed: false, completed: false
};

function status(message) { ui.rehearsalStatus.textContent = message; }
function current() { return rehearsal.scenes[rehearsal.scene]?.lines[rehearsal.line]; }
function actorTurn(line = current()) { return line && (line.character === ui.actorRole.value || line.character === 'TODOS'); }
function option(value, label = value) { return new Option(label, value); }

function halt() {
  rehearsal.generation++;
  rehearsal.running = false;
  clearTimeout(rehearsal.timer);
  clearTimeout(rehearsal.restartTimer);
  const recognition = rehearsal.recognition;
  rehearsal.recognition = null;
  if (recognition) { recognition.onend = null; recognition.abort(); }
  synthesis?.cancel();
  rehearsal.utterance = null;
  ui.pauseRehearsal.disabled = true;
  ui.startRehearsal.disabled = !current();
  ui.continueRehearsal.disabled = true;
}

function resetPosition(sceneIndex, lineIndex = 0) {
  halt();
  rehearsal.scene = sceneIndex;
  rehearsal.line = lineIndex;
  rehearsal.transcript = '';
  rehearsal.matched = [];
  rehearsal.revealed = false;
  rehearsal.completed = false;
  ui.startRehearsal.textContent = 'Começar ensaio';
  render();
  status('Ensaio pronto.');
}

function render() {
  const scene = rehearsal.scenes[rehearsal.scene];
  const line = current();
  if (!line) return;
  const own = actorTurn(line);
  ui.rehearsalScene.value = String(rehearsal.scene);
  ui.rehearsalSceneTitle.textContent = scene.title;
  ui.rehearsalCounter.textContent = `${rehearsal.line + 1} / ${scene.lines.length}`;
  ui.rehearsalSpeaker.textContent = own ? `${line.character} · Sua vez` : line.character;
  ui.rehearsalDirections.textContent = line.directions;
  const cue = scene.lines.slice(0, rehearsal.line).reverse().find((item) => !actorTurn(item));
  ui.rehearsalCue.hidden = !own || !cue;
  if (cue) {
    ui.rehearsalCue.replaceChildren();
    const label = document.createElement('small');
    label.textContent = `Deixa de ${cue.character}`;
    const text = document.createElement('span');
    text.textContent = cue.text;
    ui.rehearsalCue.append(label, text);
  }
  ui.rehearsalLine.replaceChildren();
  const concealed = own && ui.hideActorLine.checked && !rehearsal.revealed;
  ui.revealActorLine.hidden = !concealed;
  if (concealed) ui.rehearsalLine.textContent = 'Sua fala está oculta.';
  else {
    const tokens = line.text.split(/\s+/);
    // Highlight indexes use the same normalized words as the speech matcher.
    let wordIndex = 0;
    for (const token of tokens) {
      const span = document.createElement('span');
      span.textContent = `${token} `;
      const count = token.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]/g, ' ').trim().split(/\s+/).filter(Boolean).length;
      if (own && count && Array.from({ length: count }, (_, i) => wordIndex + i)
        .every((index) => rehearsal.matched.includes(index))) span.className = 'spoken-word';
      wordIndex += count;
      ui.rehearsalLine.append(span);
    }
  }
  const comparison = compareSpeech(line.text, rehearsal.transcript);
  ui.speechProgress.value = own ? Math.round(comparison.coverage * 100) : 0;
  ui.speechProgressLabel.textContent = own ? `${Math.round(comparison.coverage * 100)}% da fala reconhecida` : 'Parceiro de cena';
  ui.recognizedSpeech.textContent = own && rehearsal.transcript ? `Reconhecido: ${rehearsal.transcript}` : '';
  renderTranscriptStrip(scene);
  ui.continueRehearsal.disabled = !rehearsal.running || !own;
  ui.startRehearsal.disabled = rehearsal.running;
  ui.pauseRehearsal.disabled = !rehearsal.running;
  document.querySelector('.rehearsal-stage').classList.toggle('actor-turn', Boolean(own));
}

function renderTranscriptStrip(scene) {
  ui.rehearsalTranscriptStrip.replaceChildren();
  const filter = ui.rehearsalTranscriptFilter.value;
  scene.lines.forEach((item, index) => {
    if (filter === 'actor' && !actorTurn(item)) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `rehearsal-transcript-item${index === rehearsal.line ? ' is-current' : ''}${actorTurn(item) ? ' is-actor' : ''}`;
    button.title = 'Ir para esta fala';
    const speaker = document.createElement('strong');
    speaker.textContent = item.character;
    const text = document.createElement('span');
    text.textContent = item.text;
    button.append(speaker, text);
    button.onclick = () => {
      resetPosition(rehearsal.scene, index);
      status(index === rehearsal.line && actorTurn(item) ? 'Sua fala selecionada. Toque em “Começar ensaio” quando estiver pronto.' : 'Fala selecionada.');
    };
    ui.rehearsalTranscriptStrip.append(button);
  });
}

function start() {
  if (!current()) return;
  if (rehearsal.completed) resetPosition(rehearsal.scene);
  if (window.matchMedia('(max-width: 760px)').matches) document.getElementById('rehearsalSetup').open = false;
  halt();
  rehearsal.running = true;
  runLine();
}

function runLine() {
  if (!rehearsal.running || !current()) return;
  rehearsal.transcript = '';
  rehearsal.matched = [];
  rehearsal.revealed = false;
  render();
  if (actorTurn()) {
    status('Sua vez. Esperando a sua fala.');
    if (ui.followSpeech.checked && Recognition && window.isSecureContext) listen();
    else status('Sua vez. Ao terminar, toque em “Concluí minha fala”.');
    return;
  }
  if (!synthesis) {
    halt(); render();
    status('Este navegador não oferece leitura por voz.');
    return;
  }
  const line = current();
  const generation = rehearsal.generation;
  const utterance = new SpeechSynthesisUtterance(line.text);
  utterance.lang = 'pt-BR';
  utterance.rate = Math.min(1.05, Number(ui.rehearsalRate.value) || 0.94);
  utterance.pitch = 1;
  utterance.volume = 0.92;
  utterance.voice = rehearsal.voices.find((voice) => voice.voiceURI === rehearsal.selectedVoices.get(line.character)) || null;
  rehearsal.utterance = utterance;
  utterance.onend = () => {
    if (generation === rehearsal.generation && rehearsal.running) rehearsal.timer = setTimeout(advance, 350);
  };
  utterance.onerror = (event) => {
    if (generation !== rehearsal.generation) return;
    halt(); render();
    status(`Não foi possível ler esta fala (${event.error}). Escolha outra voz e retome o ensaio.`);
  };
  status(`${line.character} está falando.`);
  synthesis.speak(utterance);
}

function advance() {
  if (!rehearsal.running) return;
  halt();
  const scene = rehearsal.scenes[rehearsal.scene];
  if (rehearsal.line + 1 >= scene.lines.length) {
    render();
    status('Cena concluída. Selecione outra cena ou repita o ensaio.');
    rehearsal.completed = true;
    ui.startRehearsal.textContent = 'Recomeçar cena';
    return;
  }
  rehearsal.line++;
  rehearsal.running = true;
  runLine();
}

function listen() {
  const generation = rehearsal.generation;
  let attempts = 0;
  let previousFinal = '';
  const valid = () => generation === rehearsal.generation && rehearsal.running && actorTurn();
  const begin = () => {
    if (!valid()) return;
    const recognition = new Recognition();
    rehearsal.recognition = recognition;
    recognition.lang = 'pt-BR';
    recognition.continuous = true;
    recognition.interimResults = true;
    let blocked = false;
    let sessionFinal = '';
    recognition.onresult = (event) => {
      if (!valid()) return;
      let finalText = '', interim = '';
      for (const result of Array.from(event.results)) {
        if (result.isFinal) finalText += ` ${result[0].transcript}`;
        else interim += ` ${result[0].transcript}`;
      }
      sessionFinal = finalText;
      rehearsal.transcript = `${previousFinal} ${finalText} ${interim}`.trim();
      const comparison = compareSpeech(current().text, rehearsal.transcript);
      rehearsal.matched = comparison.matched;
      render();
      clearTimeout(rehearsal.timer);
      // Only settled recognition containing the ending may release the next partner.
      if (!interim.trim() && compareSpeech(current().text, `${previousFinal} ${finalText}`).complete) {
        status('Fala reconhecida até o final.');
        rehearsal.timer = setTimeout(() => { if (valid()) advance(); }, 650);
      } else status('Ouvindo sua fala. Você pode fazer pausas.');
    };
    recognition.onerror = (event) => {
      if (!valid()) return;
      blocked = event.error !== 'no-speech';
      if (blocked) status(event.error === 'not-allowed' || event.error === 'service-not-allowed'
        ? 'Microfone não autorizado. Use “Concluí minha fala” ou permita o acesso no navegador.'
        : 'Reconhecimento indisponível. Use “Concluí minha fala” para continuar.');
    };
    recognition.onend = () => {
      if (!valid()) return;
      rehearsal.recognition = null;
      previousFinal += sessionFinal;
      if (blocked) return;
      if (++attempts <= 3) rehearsal.restartTimer = setTimeout(begin, 300);
      else status('Reconhecimento interrompido. Use “Concluí minha fala” ou retome o ensaio.');
    };
    try { recognition.start(); }
    catch { status('Não foi possível iniciar o microfone. Use “Concluí minha fala”.'); }
  };
  begin();
}

function refreshVoices() {
  rehearsal.voices = synthesis?.getVoices() || [];
  ui.rehearsalVoices.replaceChildren();
  const cast = [...new Set(rehearsal.scenes.flatMap((scene) => scene.lines.map((line) => line.character)))];
  const portuguese = rehearsal.voices.filter((voice) => /^pt\b/i.test(voice.lang));
  const available = (portuguese.length ? portuguese : rehearsal.voices).slice().sort((a, b) => voiceQuality(b) - voiceQuality(a));
  cast.filter((character) => character !== ui.actorRole.value && character !== 'TODOS').forEach((character, index) => {
    const label = document.createElement('label');
    label.append(document.createTextNode(character));
    const profile = document.createElement('select');
    profile.setAttribute('aria-label', `Perfil da voz de ${character}`);
    profile.append(option('', 'Perfil automático'), option('female', 'Voz feminina'), option('male', 'Voz masculina'));
    const select = document.createElement('select');
    select.setAttribute('aria-label', `Voz de ${character}`);
    select.append(option('', 'Voz padrão do aparelho'));
    for (const voice of available) select.append(option(voice.voiceURI, `${voice.name} (${voice.lang})`));
    if (!rehearsal.selectedVoices.has(character) && portuguese.length) {
      rehearsal.selectedVoices.set(character, available[index % available.length].voiceURI);
    }
    select.value = rehearsal.selectedVoices.get(character) || '';
    profile.value = inferVoiceProfile(select.value);
    profile.onchange = () => {
      const filtered = available.filter((voice) => profileMatches(voice, profile.value));
      const chosen = filtered[0] || available[0];
      if (chosen) {
        select.value = chosen.voiceURI;
        rehearsal.selectedVoices.set(character, chosen.voiceURI);
      }
      halt(); render();
      status('Perfil de voz alterado. Retome o ensaio.');
    };
    select.onchange = () => {
      halt(); render();
      rehearsal.selectedVoices.set(character, select.value);
      profile.value = inferVoiceProfile(select.value);
      status('Voz alterada. Retome o ensaio.');
    };
    label.append(profile);
    label.append(select);
    ui.rehearsalVoices.append(label);
  });
}

function voiceQuality(voice) {
  const name = `${voice.name} ${voice.voiceURI}`.toLowerCase();
  let score = 0;
  if (/natural|neural|online|premium|enhanced|google/.test(name)) score += 8;
  if (/pt[-_ ]?br|portuguese brazil/.test(`${voice.lang} ${voice.name}`.toLowerCase())) score += 4;
  if (/default|espeak|compact/.test(name)) score -= 4;
  return score;
}

function voiceGender(voice) {
  const name = `${voice.name} ${voice.voiceURI}`.toLowerCase();
  if (/female|feminina|woman|mulher|maria|helena|francisca|camila|luciana/.test(name)) return 'female';
  if (/male|masculina|man|homem|daniel|joao|jorge|ricardo/.test(name)) return 'male';
  return '';
}

function profileMatches(voice, profile) { return !profile || voiceGender(voice) === profile; }
function inferVoiceProfile(uri) { return voiceGender(rehearsal.voices.find((voice) => voice.voiceURI === uri) || {}); }

function renderReview() {
  ui.scriptReview.replaceChildren();
  rehearsal.scenes.forEach((scene, sceneIndex) => {
    const heading = document.createElement('h4');
    heading.textContent = scene.title;
    ui.scriptReview.append(heading);
    scene.lines.forEach((line, lineIndex) => {
      const label = document.createElement('label');
      label.textContent = `${line.character} · p. ${line.page}`;
      const text = document.createElement('textarea');
      text.value = line.text;
      text.rows = 3;
      text.onchange = () => {
        if (!text.value.trim()) { text.value = line.text; return; }
        halt();
        line.text = text.value.trim();
        rehearsal.transcript = ''; rehearsal.matched = [];
        render(); status('Fala corrigida.');
      };
      const jump = document.createElement('button');
      jump.className = 'secondary'; jump.type = 'button'; jump.textContent = 'Ensaiar daqui';
      jump.onclick = () => { resetPosition(sceneIndex, lineIndex); start(); };
      label.append(text, jump);
      ui.scriptReview.append(label);
    });
  });
}

export async function importScript(file) {
  if (!file) return;
  halt();
  const importGeneration = ++importSequence;
  ui.scriptInput.disabled = true;
  status(`Lendo PDF: ${file.name}...`);
  let document;
  let loadingTask;
  let timeout;
  try {
    const read = async () => {
      const pdfjs = await import('./vendor/pdf.mjs?v=214');
      pdfjs.GlobalWorkerOptions.workerSrc = new URL('./vendor/pdf.worker.mjs?v=214', import.meta.url).href;
      loadingTask = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false });
      return loadingTask.promise;
    };
    document = await Promise.race([read(), new Promise((_, reject) => {
      timeout = setTimeout(() => reject(new Error('A leitura do PDF demorou demais. Verifique sua conexão e tente novamente.')), 30000);
    })]);
    clearTimeout(timeout);
    const pages = [];
    for (let number = 1; number <= document.numPages; number++) {
      status(`Lendo ${file.name}: página ${number} de ${document.numPages}...`);
      const page = await document.getPage(number);
      pages.push(textLinesFromItems((await page.getTextContent()).items));
    }
    const scenes = parseScript(pages);
    if (!scenes.length) throw new Error('Não encontrei cenas e falas no formato PERSONAGEM: texto. Um PDF escaneado precisa primeiro de reconhecimento de texto.');
    if (importGeneration !== importSequence) return;
    rehearsal.scenes = scenes;
    rehearsal.selectedVoices.clear();
    ui.rehearsalWorkspace.hidden = false;
    ui.actorRole.replaceChildren();
    const cast = [...new Set(scenes.flatMap((scene) => scene.lines.map((line) => line.character)))].filter((name) => name !== 'TODOS');
    cast.forEach((name) => ui.actorRole.append(option(name)));
    ui.actorRole.value = cast.find((name) => /^HARRY\b/.test(name)) || cast[0];
    ui.rehearsalScene.replaceChildren();
    scenes.forEach((scene, index) => ui.rehearsalScene.append(option(String(index), scene.title)));
    refreshVoices(); renderReview(); resetPosition(0);
    status(`${file.name} · ${scenes.length} cenas · ${cast.length} personagens. Confira o roteiro antes de ensaiar.`);
  } catch (error) {
    if (importGeneration === importSequence) status(`Não foi possível importar: ${error.message}`);
  } finally {
    clearTimeout(timeout);
    try { await loadingTask?.destroy(); } catch { /* Keep the chooser usable after a reader failure. */ }
    if (importGeneration === importSequence) {
      ui.scriptInput.disabled = false;
      ui.scriptInput.value = '';
    }
  }
}

window.DubpackRehearsal = { importScript };
window.dispatchEvent(new Event('dubpack:rehearsal-ready'));

ui.startRehearsal.onclick = start;
ui.pauseRehearsal.onclick = () => { halt(); render(); status('Ensaio pausado.'); };
ui.continueRehearsal.onclick = () => { if (actorTurn()) advance(); };
ui.repeatRehearsal.onclick = () => {
  let index = rehearsal.line;
  if (index > 0 && actorTurn()) index--;
  resetPosition(rehearsal.scene, index); start();
};
ui.actorRole.onchange = () => { resetPosition(rehearsal.scene); refreshVoices(); };
ui.rehearsalScene.onchange = () => {
  resetPosition(Number(ui.rehearsalScene.value));
  ui.startRehearsal.textContent = 'Começar ensaio'; ui.startRehearsal.onclick = start;
};

ui.rehearsalTranscriptFilter.onchange = () => render();
ui.hideActorLine.onchange = render;
ui.revealActorLine.onclick = () => { rehearsal.revealed = true; render(); };
ui.followSpeech.onchange = () => { halt(); render(); status('Modo de acompanhamento alterado. Retome o ensaio.'); };
document.addEventListener('dubpack:tab', (event) => { if (event.detail !== 'rehearsal') halt(); });
document.addEventListener('visibilitychange', () => {
  if (document.hidden && rehearsal.running) { halt(); render(); status('Ensaio pausado.'); }
});
window.addEventListener('pagehide', halt);
if (synthesis) synthesis.addEventListener('voiceschanged', refreshVoices);
if (!Recognition || !window.isSecureContext) {
  ui.followSpeech.checked = false;
  ui.followSpeech.disabled = true;
  ui.speechPrivacy.textContent = 'Neste navegador, conclua sua fala pelo botão “Concluí minha fala”.';
}
