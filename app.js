const state = {
  scenes: [],
  activeIndex: 0,
  recorder: null,
  chunks: [],
  takes: {},
  activeTab: 'packs',
  countdownTimer: null,
  recordingTimer: null,
  progressTimer: null,
  playbackTimer: null,
  videoTimer: null,
  activeAudio: null
};

const els = {
  packInput: document.querySelector('#packInput'),
  packGrid: document.querySelector('#packGrid'),
  packCard: document.querySelector('#packCard'),
  packTitle: document.querySelector('#packTitle'),
  packSubtitle: document.querySelector('#packSubtitle'),
  packProgress: document.querySelector('#packProgress'),
  sceneVideo: document.querySelector('#sceneVideo'),
  sceneImage: document.querySelector('#sceneImage'),
  emptyFrame: document.querySelector('#emptyFrame'),
  frameCharacter: document.querySelector('#frameCharacter'),
  frameSubtitle: document.querySelector('#frameSubtitle'),
  recordingOverlay: document.querySelector('#recordingOverlay'),
  overlayCharacter: document.querySelector('#overlayCharacter'),
  overlayText: document.querySelector('#overlayText'),
  stageState: document.querySelector('#stageState'),
  countdownBadge: document.querySelector('#countdownBadge'),
  videoProgress: document.querySelector('#videoProgress'),
  durationLabel: document.querySelector('#durationLabel'),
  waveDuration: document.querySelector('#waveDuration'),
  topCounter: document.querySelector('#topCounter'),
  projectTitle: document.querySelector('#projectTitle'),
  projectMeta: document.querySelector('#projectMeta'),
  counter: document.querySelector('#counter'),
  character: document.querySelector('#character'),
  subtitle: document.querySelector('#subtitle'),
  timerValue: document.querySelector('#timerValue'),
  micHint: document.querySelector('#micHint'),
  prevBtn: document.querySelector('#prevBtn'),
  prevSceneBtn: document.querySelector('#prevSceneBtn'),
  nextSceneBtn: document.querySelector('#nextSceneBtn'),
  nextBtn: document.querySelector('#nextBtn'),
  referenceBtn: document.querySelector('#referenceBtn'),
  referenceBtnBottom: document.querySelector('#referenceBtnBottom'),
  recordBtn: document.querySelector('#recordBtn'),
  takeResult: document.querySelector('#takeResult'),
  takeAudio: document.querySelector('#takeAudio'),
  downloadTakeBtn: document.querySelector('#downloadTakeBtn'),
  previewBtn: document.querySelector('#previewBtn'),
  previewHint: document.querySelector('#previewHint'),
  previewBtnAlt: document.querySelector('#previewBtnAlt'),
  listenTakeBtn: document.querySelector('#listenTakeBtn'),
  exportVideoBtn: document.querySelector('#exportVideoBtn'),
  exportVideoBtnAlt: document.querySelector('#exportVideoBtnAlt'),
  recordingStatus: document.querySelector('#recordingStatus'),
  localTakes: document.querySelector('#localTakes'),
  sequenceCard: document.querySelector('#sequenceCard'),
  sidePackTitle: document.querySelector('#sidePackTitle'),
  sideSceneTitle: document.querySelector('#sideSceneTitle')
};

els.packInput.addEventListener('change', importPack);
els.prevBtn.addEventListener('click', () => setTab('packs'));
els.prevSceneBtn.addEventListener('click', () => selectScene(state.activeIndex - 1));
els.nextSceneBtn.addEventListener('click', goNextScene);
els.nextBtn.addEventListener('click', goNextScene);
els.referenceBtn.addEventListener('click', playReference);
els.referenceBtnBottom.addEventListener('click', playReference);
els.recordBtn.addEventListener('click', startTakeFlow);
els.downloadTakeBtn.addEventListener('click', downloadTake);
els.previewBtn.addEventListener('click', playCurrentTake);
els.listenTakeBtn.addEventListener('click', playCurrentTake);
els.previewBtnAlt.addEventListener('click', playProjectPreview);
els.exportVideoBtn.addEventListener('click', exportMp4Notice);
els.exportVideoBtnAlt.addEventListener('click', exportMp4Notice);

document.querySelectorAll('[data-tab]').forEach((button) => {
  button.addEventListener('click', (event) => {
    event.preventDefault();
    setTab(button.dataset.tab);
  });
});

async function importPack(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  clearRuntime();
  const bytes = new Uint8Array(await file.arrayBuffer());
  const files = fflate.unzipSync(bytes);
  const entries = Object.entries(files).map(([name, data]) => ({
    name,
    data,
    ext: name.split('.').pop()?.toLowerCase() ?? ''
  }));

  const audio = entries.filter((entry) => ['mp3', 'wav', 'ogg', 'm4a'].includes(entry.ext) && !entry.name.toLowerCase().includes('backing'));
  const images = entries.filter((entry) => ['png', 'jpg', 'jpeg', 'webp'].includes(entry.ext));
  const videos = entries.filter((entry) => ['mp4', 'mov', 'webm', 'ogv'].includes(entry.ext));

  state.scenes = await Promise.all(audio.map(async (entry, index) => {
    const baseName = entry.name.split('/').pop()?.replace(/\.[^.]+$/, '') ?? `Fala ${index + 1}`;
    const audioUrl = objectUrl(entry);
    const duration = await getMediaDuration(audioUrl).catch(() => estimateDuration(baseName));
    return {
      id: `${index}-${baseName}`,
      title: baseName,
      character: detectCharacter(baseName),
      subtitle: cleanSubtitle(baseName),
      duration,
      durationLabel: formatSeconds(duration),
      audioUrl,
      imageUrl: visualUrlFor(entry, index, images),
      videoUrl: visualUrlFor(entry, index, videos)
    };
  }));

  state.takes = {};
  const packName = file.name.replace(/\.zip$/i, '');
  els.packGrid.classList.remove('has-no-pack');
  els.packCard.style.display = 'block';
  els.sequenceCard.classList.remove('is-hidden');
  els.packTitle.textContent = packName;
  els.sidePackTitle.textContent = packName;
  els.packSubtitle.textContent = `${state.scenes.length} falas detectadas · pronto para dublar`;
  selectScene(0);
  setTab('record');
}

function setTab(tab) {
  state.activeTab = tab;
  document.querySelectorAll('.tab-view').forEach((view) => view.classList.remove('active'));
  document.querySelector(`#${tab}Tab`)?.classList.add('active');
  document.querySelectorAll('[data-tab]').forEach((button) => button.classList.toggle('active', button.dataset.tab === tab));
  if (tab === 'community' || tab === 'results') renderLocalTakes();
}

function selectScene(index) {
  if (!state.scenes.length) return;
  clearRuntime();
  state.activeIndex = Math.max(0, Math.min(index, state.scenes.length - 1));
  const scene = currentScene();
  const take = state.takes[scene.id];
  const counter = `Fala ${state.activeIndex + 1} de ${state.scenes.length}`;

  els.topCounter.textContent = counter;
  els.counter.textContent = counter;
  els.projectTitle.textContent = scene.character;
  els.projectMeta.textContent = take ? `${counter} · gravado` : `${counter} · original`;
  els.sideSceneTitle.textContent = counter;
  els.character.textContent = scene.character;
  els.subtitle.textContent = scene.subtitle;
  els.frameCharacter.textContent = scene.character;
  els.frameSubtitle.textContent = scene.subtitle;
  els.overlayCharacter.textContent = scene.character;
  els.overlayText.textContent = scene.subtitle;
  els.durationLabel.textContent = scene.durationLabel;
  if (els.waveDuration) els.waveDuration.textContent = scene.durationLabel;
  els.timerValue.textContent = '2.1';
  els.micHint.textContent = take ? 'Toque no microfone para regravar' : 'Toque no microfone para começar';
  els.recordingStatus.textContent = take ? 'Gravado' : 'Pronto';
  els.previewHint.textContent = take ? 'Toque para ouvir seu take' : 'Grave este take para ouvir aqui';
  els.videoProgress.style.width = '18%';
  els.stageState.textContent = take ? 'Take gravado' : 'Pronto para gravar';
  els.stageState.className = `stage-state ${take ? 'recorded' : ''}`;
  const canGoNext = Boolean(take) && state.activeIndex < state.scenes.length - 1;
  els.nextBtn.disabled = !canGoNext;
  els.nextSceneBtn.disabled = !canGoNext;
  els.nextBtn.classList.toggle('pulse-next', canGoNext);
  els.nextSceneBtn.classList.toggle('pulse-next', canGoNext);
  els.previewBtn.disabled = !take;
  els.listenTakeBtn.disabled = !take;
  els.listenTakeBtn.classList.toggle('is-hidden', !take);
  els.packProgress.style.width = `${getRecordedPercent()}%`;

  els.sceneVideo.style.display = scene.videoUrl ? 'block' : 'none';
  els.sceneImage.style.display = !scene.videoUrl && scene.imageUrl ? 'block' : 'none';
  els.emptyFrame.style.display = scene.videoUrl || scene.imageUrl ? 'none' : 'grid';
  els.sceneVideo.src = scene.videoUrl || '';
  els.sceneImage.src = scene.imageUrl || '';
  els.takeResult.style.display = take ? 'flex' : 'none';
  els.takeAudio.src = take?.url ?? '';
}

function currentScene() {
  return state.scenes[state.activeIndex];
}

function goNextScene() {
  const scene = currentScene();
  if (!scene || !state.takes[scene.id]) {
    els.recordBtn.classList.add('attention');
    els.micHint.textContent = 'Grave este take antes de avançar';
    setTimeout(() => els.recordBtn.classList.remove('attention'), 900);
    return;
  }
  selectScene(state.activeIndex + 1);
}

function playReference() {
  const scene = currentScene();
  if (!scene?.audioUrl) return;
  playTimedAudio(scene.audioUrl, scene.duration);
  playSceneMedia(scene, scene.duration);
  animateProgress(scene.duration);
}

async function startTakeFlow() {
  const scene = currentScene();
  if (!scene || state.recorder?.state === 'recording') return;

  await navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => stream.getTracks().forEach((track) => track.stop()));
  clearRuntime();
  els.countdownBadge.style.display = 'grid';
  els.recordingOverlay.style.display = 'grid';
  els.stageState.textContent = 'Prepare a fala...';
  els.stageState.className = 'stage-state recording';
  els.recordBtn.classList.add('recording');
  els.micHint.textContent = 'Entre no tempo certo';
  els.recordingStatus.textContent = 'Preparando';

  let count = 3;
  els.countdownBadge.textContent = count;
  state.countdownTimer = setInterval(async () => {
    count -= 1;
    els.countdownBadge.textContent = count === 0 ? 'DUBLE!' : count;
    els.timerValue.textContent = String(Math.max(0, count));
    if (count <= 0) {
      clearInterval(state.countdownTimer);
      state.countdownTimer = null;
      setTimeout(recordActiveScene, 250);
    }
  }, 850);
}

async function recordActiveScene() {
  const scene = currentScene();
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  state.chunks = [];
  state.recorder = new MediaRecorder(stream);
  state.recorder.ondataavailable = (event) => state.chunks.push(event.data);
  state.recorder.onstop = () => {
    stream.getTracks().forEach((track) => track.stop());
    const url = URL.createObjectURL(new Blob(state.chunks, { type: 'audio/webm' }));
    state.takes[scene.id] = { url, character: scene.character, subtitle: scene.subtitle, createdAt: new Date().toISOString() };
    clearRuntime();
    selectScene(state.activeIndex);
    renderLocalTakes();
  };

  els.countdownBadge.style.display = 'none';
  els.recordingOverlay.style.display = 'grid';
  els.stageState.textContent = 'Gravando take...';
  els.stageState.className = 'stage-state recording';
  els.recordBtn.classList.add('recording');
  els.micHint.textContent = 'Gravando no tempo da fala...';
  els.recordingStatus.textContent = 'Gravando';
  playTimedAudio(scene.audioUrl, scene.duration, 0.55);
  playSceneMedia(scene, scene.duration);
  animateProgress(scene.duration);

  const startedAt = Date.now();
  state.recordingTimer = setInterval(() => {
    const remaining = Math.max(0, scene.duration - ((Date.now() - startedAt) / 1000));
    els.timerValue.textContent = remaining.toFixed(1);
  }, 100);

  state.recorder.start();
  setTimeout(() => {
    if (state.recorder?.state === 'recording') state.recorder.stop();
  }, scene.duration * 1000);
}

async function playProjectPreview() {
  if (!state.scenes.length) return;
  for (let index = 0; index < state.scenes.length; index += 1) {
    selectScene(index);
    const scene = currentScene();
    const take = state.takes[scene.id];
    playSceneMedia(scene, scene.duration);
    animateProgress(scene.duration);
    playTimedAudio(take?.url ?? scene.audioUrl, scene.duration);
    await wait((scene.duration * 1000) + 250);
  }
}

function playCurrentTake() {
  const scene = currentScene();
  const take = scene ? state.takes[scene.id] : null;
  if (!scene || !take) {
    els.previewHint.textContent = 'Grave este take primeiro';
    return;
  }
  playTimedAudio(take.url, scene.duration);
  playSceneMedia(scene, scene.duration);
  animateProgress(scene.duration);
}

function playSceneMedia(scene, duration) {
  if (!scene.videoUrl) return;
  els.sceneVideo.currentTime = 0;
  els.sceneVideo.play().catch(() => undefined);
  clearTimeout(state.videoTimer);
  state.videoTimer = setTimeout(() => {
    els.sceneVideo.pause();
    els.sceneVideo.currentTime = 0;
  }, duration * 1000);
}

function playTimedAudio(url, duration, volume = 1) {
  stopActivePlayback();
  const audio = new Audio(url);
  audio.volume = volume;
  state.activeAudio = audio;
  audio.play().catch(() => undefined);
  clearTimeout(state.playbackTimer);
  state.playbackTimer = setTimeout(stopActivePlayback, duration * 1000);
}

function stopActivePlayback() {
  clearTimeout(state.playbackTimer);
  state.playbackTimer = null;
  if (state.activeAudio) {
    state.activeAudio.pause();
    state.activeAudio.currentTime = 0;
    state.activeAudio = null;
  }
}

function animateProgress(duration) {
  clearInterval(state.progressTimer);
  const startedAt = Date.now();
  state.progressTimer = setInterval(() => {
    const progress = Math.min(1, (Date.now() - startedAt) / (duration * 1000));
    els.videoProgress.style.width = `${Math.max(18, progress * 100)}%`;
    if (progress >= 1) clearInterval(state.progressTimer);
  }, 80);
}

function downloadTake() {
  const scene = currentScene();
  const take = scene ? state.takes[scene.id] : null;
  if (!take) return;
  const link = document.createElement('a');
  link.href = take.url;
  link.download = `dubpack-${scene.character}-fala-${state.activeIndex + 1}.webm`;
  link.click();
}

function exportMp4Notice() {
  alert('MP4 final: no navegador, esta etapa precisa entrar com FFmpeg WebAssembly para renderizar o video com as vozes. O fluxo visual ja esta preparado; o proximo passo tecnico e ligar essa renderizacao real.');
}

function renderLocalTakes() {
  const takes = Object.entries(state.takes);
  els.localTakes.innerHTML = '';
  if (!takes.length) {
    els.localTakes.innerHTML = '<div class="take-card">Nenhum take gravado ainda.</div>';
    return;
  }

  takes.forEach(([id, take]) => {
    const sceneIndex = state.scenes.findIndex((scene) => scene.id === id);
    const card = document.createElement('div');
    card.className = 'take-card';
    card.innerHTML = `<strong>Fala ${sceneIndex + 1} · ${take.character}</strong><p>${take.subtitle}</p><audio controls src="${take.url}"></audio>`;
    els.localTakes.appendChild(card);
  });
}

function clearRuntime() {
  clearInterval(state.countdownTimer);
  clearInterval(state.recordingTimer);
  clearInterval(state.progressTimer);
  clearTimeout(state.playbackTimer);
  clearTimeout(state.videoTimer);
  state.countdownTimer = null;
  state.recordingTimer = null;
  state.progressTimer = null;
  state.playbackTimer = null;
  state.videoTimer = null;
  els.countdownBadge.style.display = 'none';
  els.recordingOverlay.style.display = 'none';
  els.recordBtn.classList.remove('recording');
  if (state.activeAudio) {
    state.activeAudio.pause();
    state.activeAudio.currentTime = 0;
    state.activeAudio = null;
  }
  if (els.sceneVideo) els.sceneVideo.pause();
}

function objectUrl(entry) {
  return URL.createObjectURL(new Blob([entry.data], { type: mimeFor(entry.ext) }));
}

function visualUrlFor(audioEntry, index, visualEntries) {
  if (!visualEntries.length) return '';
  const audioBase = normalizeBaseName(audioEntry.name);
  const exact = visualEntries.find((entry) => normalizeBaseName(entry.name) === audioBase);
  const partial = visualEntries.find((entry) => {
    const visualBase = normalizeBaseName(entry.name);
    return visualBase.includes(audioBase) || audioBase.includes(visualBase);
  });
  const selected = exact || partial || visualEntries[index] || visualEntries[0];
  return selected ? objectUrl(selected) : '';
}

function normalizeBaseName(name) {
  return (name.split('/').pop() || name)
    .replace(/\.[^.]+$/, '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '');
}

function mimeFor(ext) {
  const map = {
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    ogg: 'audio/ogg',
    m4a: 'audio/mp4',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    mp4: 'video/mp4',
    mov: 'video/quicktime',
    webm: 'video/webm',
    ogv: 'video/ogg'
  };
  return map[ext] ?? 'application/octet-stream';
}

function detectCharacter(name) {
  const parts = name.replace(/\.[^.]+$/, '').split(/[_-]/).filter(Boolean);
  return parts.find((part) => /[a-zA-ZÀ-ÿ]/.test(part) && !/^\d+$/.test(part)) ?? 'Personagem';
}

function cleanSubtitle(name) {
  return name.replace(/\.[^.]+$/, '').replace(/^\d+[_-]?/, '').replace(/[_-]+/g, ' ');
}

function estimateDuration(name) {
  const match = name.match(/(\d+(?:[.,]\d+)?)s/i);
  if (match) return Math.max(1.2, Number(match[1].replace(',', '.')));
  return Math.min(12, Math.max(1.8, cleanSubtitle(name).length / 16));
}

function formatSeconds(value) {
  const seconds = Math.max(0, Math.round(value));
  return `00:${String(seconds).padStart(2, '0')}`;
}

function getRecordedPercent() {
  if (!state.scenes.length) return 0;
  const recorded = state.scenes.filter((scene) => state.takes[scene.id]).length;
  return Math.round((recorded / state.scenes.length) * 100);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getMediaDuration(url) {
  return new Promise((resolve, reject) => {
    const audio = new Audio(url);
    audio.preload = 'metadata';
    audio.onloadedmetadata = () => {
      const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
      resolve(Math.max(1.2, Math.min(duration || 0, 45)));
    };
    audio.onerror = reject;
  });
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => undefined);
}
