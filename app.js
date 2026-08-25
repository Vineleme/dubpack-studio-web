const state = {
  scenes: [],
  activeIndex: 0,
  recorder: null,
  chunks: [],
  takeUrl: ''
};

const els = {
  packInput: document.querySelector('#packInput'),
  packStatus: document.querySelector('#packStatus'),
  packSubtitle: document.querySelector('#packSubtitle'),
  sceneCounter: document.querySelector('#sceneCounter'),
  sceneList: document.querySelector('#sceneList'),
  sceneVideo: document.querySelector('#sceneVideo'),
  sceneImage: document.querySelector('#sceneImage'),
  emptyFrame: document.querySelector('#emptyFrame'),
  topCounter: document.querySelector('#topCounter'),
  projectTitle: document.querySelector('#projectTitle'),
  projectMeta: document.querySelector('#projectMeta'),
  counter: document.querySelector('#counter'),
  character: document.querySelector('#character'),
  subtitle: document.querySelector('#subtitle'),
  prevBtn: document.querySelector('#prevBtn'),
  nextBtn: document.querySelector('#nextBtn'),
  referenceBtn: document.querySelector('#referenceBtn'),
  recordBtn: document.querySelector('#recordBtn'),
  takeAudio: document.querySelector('#takeAudio'),
  downloadTakeBtn: document.querySelector('#downloadTakeBtn')
};

els.packInput.addEventListener('change', importPack);
els.prevBtn.addEventListener('click', () => selectScene(state.activeIndex - 1));
els.nextBtn.addEventListener('click', () => selectScene(state.activeIndex + 1));
els.referenceBtn.addEventListener('click', playReference);
els.recordBtn.addEventListener('click', toggleRecording);
els.downloadTakeBtn.addEventListener('click', downloadTake);

async function importPack(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const bytes = new Uint8Array(await file.arrayBuffer());
  const files = fflate.unzipSync(bytes);
  const entries = Object.entries(files).map(([name, data]) => ({
    name,
    data,
    ext: name.split('.').pop()?.toLowerCase() ?? ''
  }));

  const media = entries.filter((entry) => ['mp3', 'wav', 'ogg', 'm4a', 'png', 'jpg', 'jpeg', 'webp', 'mp4', 'mov', 'webm', 'ogv'].includes(entry.ext));
  const audio = media.filter((entry) => ['mp3', 'wav', 'ogg', 'm4a'].includes(entry.ext));
  const images = media.filter((entry) => ['png', 'jpg', 'jpeg', 'webp'].includes(entry.ext));
  const videos = media.filter((entry) => ['mp4', 'mov', 'webm', 'ogv'].includes(entry.ext));

  state.scenes = audio.map((entry, index) => {
    const baseName = entry.name.split('/').pop()?.replace(/\.[^.]+$/, '') ?? `Fala ${index + 1}`;
    return {
      title: baseName,
      character: detectCharacter(baseName),
      subtitle: baseName.replace(/[_-]+/g, ' '),
      audioUrl: objectUrl(entry),
      imageUrl: images[index] ? objectUrl(images[index]) : '',
      videoUrl: videos[0] ? objectUrl(videos[0]) : ''
    };
  });

  els.packStatus.textContent = `${state.scenes.length} falas`;
  els.packSubtitle.textContent = `${file.name} · ${state.scenes.length} falas detectadas`;
  renderSceneList();
  selectScene(0);
}

function objectUrl(entry) {
  return URL.createObjectURL(new Blob([entry.data], { type: mimeFor(entry.ext) }));
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
  const clean = name.replace(/\.[^.]+$/, '').split(/[_-]/).filter(Boolean);
  return clean.find((part) => /[a-zA-Z]/.test(part)) ?? 'Personagem';
}

function renderSceneList() {
  els.sceneList.innerHTML = '';
  state.scenes.forEach((scene, index) => {
    const button = document.createElement('button');
    button.className = `scene ${index === state.activeIndex ? 'active' : ''}`;
    button.textContent = `Fala ${index + 1} · ${scene.character}`;
    button.addEventListener('click', () => selectScene(index));
    els.sceneList.appendChild(button);
  });
}

function selectScene(index) {
  if (!state.scenes.length) return;
  state.activeIndex = Math.max(0, Math.min(index, state.scenes.length - 1));
  const scene = state.scenes[state.activeIndex];

  els.counter.textContent = `Fala ${state.activeIndex + 1} de ${state.scenes.length}`;
  els.topCounter.textContent = `Fala ${state.activeIndex + 1} de ${state.scenes.length}`;
  els.sceneCounter.textContent = `${state.activeIndex + 1}/${state.scenes.length}`;
  els.projectTitle.textContent = scene.character;
  els.projectMeta.textContent = state.takeUrl ? 'gravado' : 'original';
  els.character.textContent = scene.character;
  els.subtitle.textContent = scene.subtitle;

  els.sceneVideo.style.display = scene.videoUrl ? 'block' : 'none';
  els.sceneImage.style.display = !scene.videoUrl && scene.imageUrl ? 'block' : 'none';
  els.emptyFrame.style.display = scene.videoUrl || scene.imageUrl ? 'none' : 'grid';
  els.sceneVideo.src = scene.videoUrl || '';
  els.sceneImage.src = scene.imageUrl || '';
  renderSceneList();
}

function playReference() {
  const scene = state.scenes[state.activeIndex];
  if (!scene?.audioUrl) return;
  new Audio(scene.audioUrl).play();
  if (scene.videoUrl) {
    els.sceneVideo.currentTime = 0;
    els.sceneVideo.play().catch(() => undefined);
  }
}

async function toggleRecording() {
  if (state.recorder?.state === 'recording') {
    state.recorder.stop();
    return;
  }

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  state.chunks = [];
  state.recorder = new MediaRecorder(stream);
  state.recorder.ondataavailable = (event) => state.chunks.push(event.data);
  state.recorder.onstop = () => {
    stream.getTracks().forEach((track) => track.stop());
    state.takeUrl = URL.createObjectURL(new Blob(state.chunks, { type: 'audio/webm' }));
    els.takeAudio.src = state.takeUrl;
    els.recordBtn.textContent = 'Regravar';
    els.projectMeta.textContent = 'gravado';
    els.recordBtn.classList.remove('recording');
    els.nextBtn.classList.add('pulse-next');
  };

  els.nextBtn.classList.remove('pulse-next');
  els.recordBtn.textContent = 'Parar';
  els.recordBtn.classList.add('recording');
  state.recorder.start();
}

function downloadTake() {
  if (!state.takeUrl) return;
  const link = document.createElement('a');
  link.href = state.takeUrl;
  link.download = `dubpack-take-${state.activeIndex + 1}.webm`;
  link.click();
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => undefined);
}
