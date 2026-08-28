import { BED_VOLUME } from './constants.js';
import { state, els } from './state.js';
import { isLoggedIn, requireAuth } from './auth.js';
import { currentPack, currentScene, selectScene } from './pack.js';
import { abortCapture } from './recorder.js';
import { setTab } from './ui.js';
import { formatSeconds, interruptibleWait, iosAudioHint, isIOS, rememberUrl, safeFile, takeLooksLikeWebm, toast } from './utils.js';
import { destroyStageOgv, ensureStageOgv, pauseStageOgv, playStageOgv, seekStageOgv, urlLooksLikeOgg, warmOgvDecoder } from './ogv.js';

export function playClickAudio(layers, duration) {
  stopActivePlayback();
  void ensurePlaybackAudio();
  const items = layers.filter((layer) => layer.blob || layer.url);
  state.activeAudios = items.map((layer) => {
    const audio = new Audio();
    audio.preload = 'auto';
    audio.volume = Math.min(1, Math.max(0, Number(layer.volume) || 1));
    const blob = layer.blob || state.blobByUrl.get(layer.url);
    audio.src = blob ? rememberUrl(URL.createObjectURL(blob), blob) : layer.url;
    audio.play().catch(() => {
      if (!blob) {
        toast(iosAudioHint());
        return;
      }
      void playBlobThroughContext(blob, audio.volume);
    });
    return audio;
  });
  state.activeAudio = state.activeAudios[0] || null;
  clearTimeout(state.playbackTimer);
  state.playbackTimer = setTimeout(stopActivePlayback, (Number(duration) || 2) * 1000);
}

export async function playBlobThroughContext(blob, volume) {
  try {
    const ctx = await ensurePlaybackAudio();
    if (!ctx) throw new Error('no-audio-context');
    const decoded = await ctx.decodeAudioData((await blob.arrayBuffer()).slice(0));
    const gain = ctx.createGain();
    gain.gain.value = volume;
    const source = ctx.createBufferSource();
    source.buffer = decoded;
    source.connect(gain);
    gain.connect(ctx.destination);
    source.start();
    state.playbackStops.push(() => {
      try { source.stop(0); } catch { /* ignore */ }
    });
  } catch {
    toast(iosAudioHint());
  }
}

export function playReference() {
  if (!isLoggedIn()) {
    requireAuth();
    return;
  }
  const scene = currentScene();
  if (!scene?.audioUrl) {
    toast('Importe um pack para ouvir a referência.');
    return;
  }
  void unlockAudio();
  stopActivePlayback();
  playSceneMedia(scene, scene.duration);
  animateProgress(scene.duration);
  playClickAudio([{ url: scene.audioUrl, volume: 1 }], scene.duration);
}

export async function ensurePlaybackAudio() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  if (!state.playbackCtx || state.playbackCtx.state === 'closed') {
    state.playbackCtx = new AudioCtx();
  }
  if (state.playbackCtx.state === 'suspended') {
    await state.playbackCtx.resume();
  }
  return state.playbackCtx;
}

export async function unlockAudio() {
  const ctx = await ensurePlaybackAudio();
  if (!ctx) return;
  try {
    const buffer = ctx.createBuffer(1, 1, 22050);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0);
    source.stop(ctx.currentTime + 0.001);
  } catch {
    // ignore
  }
}

export async function getCachedAudioBuffer(ctx, url) {
  if (audioBufferCache.has(url)) return audioBufferCache.get(url);
  const buffer = await fetchAudioBuffer(ctx, url);
  audioBufferCache.set(url, buffer);
  return buffer;
}

export function warmSceneAudio(scenes) {
  if (!scenes?.length) return;
  void ensurePlaybackAudio().then((ctx) => {
    if (!ctx) return;
    scenes.forEach((scene) => {
      if (scene.audioUrl) {
        void getCachedAudioBuffer(ctx, scene.audioUrl).catch(() => undefined);
      }
    });
  });
}

export async function fetchAudioBuffer(ctx, url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error('fetch-audio');
  const data = await response.arrayBuffer();
  return ctx.decodeAudioData(data.slice(0));
}

export async function playProjectPreview() {
  if (!isLoggedIn()) {
    requireAuth();
    return;
  }
  const pack = currentPack();
  if (!pack?.scenes.length) {
    toast('Importe um pack primeiro.');
    return;
  }
  if (state.previewing) {
    stopProjectPreview();
    return;
  }

  state.previewing = true;
  const gen = ++state.previewGen;
  void unlockAudio();
  if (els.previewBtnAlt) els.previewBtnAlt.textContent = 'Parar prévia';
  els.stopPreviewBtn?.classList.remove('is-hidden');
  setTab('record');

  for (let index = 0; index < pack.scenes.length; index += 1) {
    if (!state.previewing || state.previewGen !== gen) return;
    selectScene(index);
    const scene = currentScene();
    const take = pack.takes[scene.id];
    playSceneMedia(scene, scene.duration);
    animateProgress(scene.duration);
    const layers = take && !(isIOS() && takeLooksLikeWebm(take))
      ? [{ url: take.url, volume: 1 }, { url: scene.audioUrl, volume: BED_VOLUME }]
      : [{ url: scene.audioUrl, volume: 1 }];
    playLayersHtml(layers, scene.duration);
    const ok = await interruptibleWait((scene.duration * 1000) + 180, gen);
    if (!ok) return;
  }

  if (state.previewGen === gen) stopProjectPreview();
}

export function stopProjectPreview() {
  state.previewing = false;
  state.previewGen += 1;
  els.previewBtnAlt && (els.previewBtnAlt.textContent = '▶ Assistir resultado');
  els.stopPreviewBtn?.classList.add('is-hidden');
  abortCapture();
}

export function playCurrentTake() {
  if (!isLoggedIn()) {
    requireAuth();
    return;
  }
  const pack = currentPack();
  const scene = currentScene();
  const take = scene ? pack?.takes[scene.id] : null;
  if (!scene || !take) {
    els.previewHint.textContent = 'Grave este take primeiro';
    return;
  }
  if (isIOS() && takeLooksLikeWebm(take)) {
    toast('Este take não toca no iPhone. Grave esta fala de novo.');
    return;
  }
  void unlockAudio();
  stopActivePlayback();
  playSceneMedia(scene, scene.duration);
  animateProgress(scene.duration);
  playClickAudio([
    { url: take.url, blob: take.blob, volume: 1 },
    { url: scene.audioUrl, volume: BED_VOLUME }
  ], Math.max(scene.duration, Number(take.duration) || 1));
}

export function bindSceneVisual(scene) {
  const video = els.sceneVideo;
  const image = els.sceneImage;
  const empty = els.emptyFrame;
  if (!video || !image || !empty) return;

  if (scene.imageUrl) {
    video.pause();
    video.style.display = 'none';
    destroyStageOgv();
    empty.style.display = 'none';
    empty.replaceChildren();
    image.style.display = 'block';
    if (image.src !== scene.imageUrl) image.src = scene.imageUrl;
    return;
  }

  if (scene.videoUrl) {
    image.style.display = 'none';
    empty.style.display = 'none';
    empty.replaceChildren();
    void bindSceneVideo(scene);
    return;
  }

  video.pause();
  if (video.src) video.removeAttribute('src');
  video.style.display = 'none';
  destroyStageOgv();
  image.style.display = 'none';
  paintEmptyScene(scene);
}

async function bindSceneVideo(scene) {
  const video = els.sceneVideo;
  if (!video || !scene?.videoUrl) return;
  const useOgv = await urlLooksLikeOgg(scene.videoUrl);
  if (useOgv) {
    video.pause();
    if (video.src) video.removeAttribute('src');
    video.style.display = 'none';
    warmOgvDecoder();
    try {
      await ensureStageOgv(scene.videoUrl);
      await seekStageOgv(Number(scene.videoOffset) || 0.04);
      pauseStageOgv();
    } catch {
      toast('Este pack usa .ogv. Aguarde o decoder carregar e tente de novo.');
    }
    return;
  }

  destroyStageOgv();
  video.style.display = 'block';
  video.muted = true;
  video.playsInline = true;
  if (video.src !== scene.videoUrl) video.src = scene.videoUrl;
  showSceneStill(scene);
}

export function playSceneMedia(scene, duration) {
  if (scene.imageUrl && els.sceneImage) {
    els.sceneImage.style.display = 'block';
    if (els.sceneVideo) els.sceneVideo.style.display = 'none';
    destroyStageOgv();
    return;
  }
  if (!scene.videoUrl || !els.sceneVideo) return;
  void playSceneVideo(scene, duration);
}

async function playSceneVideo(scene, duration) {
  const video = els.sceneVideo;
  const start = Number(scene.videoOffset) || 0;
  const useOgv = await urlLooksLikeOgg(scene.videoUrl);
  clearTimeout(state.videoTimer);

  if (useOgv) {
    video.style.display = 'none';
    try {
      await ensureStageOgv(scene.videoUrl);
      await seekStageOgv(start);
      await playStageOgv();
    } catch {
      return;
    }
    state.videoTimer = setTimeout(() => {
      pauseStageOgv();
      void seekStageOgv(start || 0.04);
    }, duration * 1000);
    return;
  }

  destroyStageOgv();
  video.muted = true;
  video.playsInline = true;
  video.style.display = 'block';
  try {
    video.currentTime = start;
  } catch {
    // ignore
  }
  video.play().catch(() => undefined);
  state.videoTimer = setTimeout(() => {
    video.pause();
    showSceneStill(scene);
  }, duration * 1000);
}

export function showSceneStill(scene) {
  const video = els.sceneVideo;
  if (!video || !scene.videoUrl) return;
  void urlLooksLikeOgg(scene.videoUrl).then((useOgv) => {
    if (useOgv) {
      void seekStageOgv(Number(scene.videoOffset) || 0.04).then(() => pauseStageOgv());
      return;
    }
    const apply = () => {
      const duration = Number.isFinite(video.duration) ? video.duration : 0;
      const offset = Number(scene.videoOffset) || 0;
      const target = duration
        ? Math.min(Math.max(offset, 0), Math.max(0, duration - 0.08))
        : offset;
      try {
        video.currentTime = target || 0.04;
      } catch {
        // Alguns arquivos ainda não aceitam seek.
      }
    };
    if (video.readyState >= 2) apply();
    else video.addEventListener('loadeddata', apply, { once: true });
    video.addEventListener('seeked', () => {
      if (!state.previewing && !state.recorder) video.pause();
    }, { once: true });
  });
}

export function paintEmptyScene(scene) {
  const empty = els.emptyFrame;
  empty.replaceChildren();
  const kicker = document.createElement('small');
  kicker.textContent = 'Cena desta fala';
  const title = document.createElement('strong');
  title.textContent = scene.character || 'Pack';
  empty.append(kicker, title);
  empty.style.display = 'grid';
}

export function playTimedAudio(url, duration, volume = 1) {
  return playLayers([{ url, volume }], duration);
}

export async function playLayers(layers, duration) {
  stopActivePlayback();
  const items = layers.filter((layer) => layer.url);
  if (!items.length) return;

  if (isIOS()) {
    playLayersHtml(items, duration);
    return;
  }

  try {
    const ctx = await ensurePlaybackAudio();
    if (!ctx) throw new Error('no-audio-context');
    const startAt = ctx.currentTime + 0.06;
    for (const layer of items) {
      const buffer = await getCachedAudioBuffer(ctx, layer.url);
      const gain = ctx.createGain();
      gain.gain.value = Math.max(0, Math.min(1, layer.volume));
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(gain);
      gain.connect(ctx.destination);
      source.start(startAt);
      state.playbackStops.push(() => {
        try { source.stop(0); } catch { /* ignore */ }
        source.disconnect();
        gain.disconnect();
      });
    }
  clearTimeout(state.playbackTimer);
    state.playbackTimer = setTimeout(stopActivePlayback, (duration * 1000) + 140);
    return;
  } catch {
    playLayersHtml(items, duration);
  }
}

export function playLayersHtml(layers, duration) {
  const items = layers.filter((layer) => layer.url || layer.blob);
  state.activeAudios = items.map((layer) => {
    const audio = new Audio();
    audio.preload = 'auto';
    audio.volume = Math.min(1, Math.max(0, Number(layer.volume) || 1));
    const blob = layer.blob || state.blobByUrl.get(layer.url);
    audio.src = blob ? rememberUrl(URL.createObjectURL(blob), blob) : layer.url;
    audio.play().catch(() => toast(iosAudioHint()));
    return audio;
  });
  state.activeAudio = state.activeAudios[0] || null;
  clearTimeout(state.playbackTimer);
  state.playbackTimer = setTimeout(stopActivePlayback, (Number(duration) || 2) * 1000);
}

export function stopActivePlayback() {
  clearTimeout(state.playbackTimer);
  state.playbackTimer = null;
  state.playbackStops.forEach((stop) => stop?.());
  state.playbackStops = [];
  const list = state.activeAudios?.length
    ? state.activeAudios
    : (state.activeAudio ? [state.activeAudio] : []);
  list.forEach((audio) => {
    audio.pause();
    audio.currentTime = 0;
  });
  state.activeAudios = [];
  state.activeAudio = null;
  pauseStageOgv();
}

export function animateProgress(duration) {
  clearInterval(state.progressTimer);
  const startedAt = Date.now();
  state.progressTimer = setInterval(() => {
    const progress = Math.min(1, (Date.now() - startedAt) / (duration * 1000));
    els.videoProgress.style.width = `${progress * 100}%`;
    els.elapsedLabel.textContent = formatSeconds(progress * duration);
    if (els.wavePlayhead) els.wavePlayhead.style.left = `${progress * 100}%`;
    if (progress >= 1) clearInterval(state.progressTimer);
  }, 80);
}

export function downloadTake() {
  if (!isLoggedIn()) {
    requireAuth();
    return;
  }
  const pack = currentPack();
  const scene = currentScene();
  const take = scene ? pack?.takes[scene.id] : null;
  if (!take) {
    toast('Grave este take primeiro.');
    return;
  }
  const link = document.createElement('a');
  link.href = take.url;
  link.download = `dubpack-${safeFile(scene.character)}-fala-${state.activeIndex + 1}.${take.ext || 'webm'}`;
  link.click();
}

export async function exportTakesZip() {
  const pack = currentPack();
  const takes = pack ? Object.entries(pack.takes) : [];
  if (!takes.length) {
    toast('Grave pelo menos um take para baixar.');
    return;
  }
  const files = {};
  for (const [id, take] of takes) {
    const sceneIndex = pack.scenes.findIndex((scene) => scene.id === id);
    const blob = take.blob || await fetch(take.url).then((response) => response.blob());
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const name = `${String(sceneIndex + 1).padStart(2, '0')}-${safeFile(take.character)}.${take.ext || 'webm'}`;
    files[name] = bytes;
  }
  const zipped = fflate.zipSync(files);
  const url = URL.createObjectURL(new Blob([zipped], { type: 'application/zip' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `${safeFile(pack.name)}-takes.zip`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
