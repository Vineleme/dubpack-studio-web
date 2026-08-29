import { t, getLang } from './i18n-bridge.js';
import { BED_EXPORT, BED_DUCK, EXPORT_WATERMARK_LABEL } from './constants.js';
import { state, els } from './state.js';
import { isLoggedIn, requireAuth } from './auth.js';
import { canExportVideo, consumeExportCredit, isPro, shouldWatermarkExport } from './credits.js';
import { currentPack, decorateScene, showFinalVideo } from './pack.js';
import { scheduleSave } from './persist.js';
import { stopProjectPreview } from './playback.js';
import { abortCapture } from './recorder.js';
import { setTab } from './ui.js';
import { coverDraw, gainForTake, isIOS, isPhone, loadScript, packIsComplete, rememberUrl, roundRectPath, safeFile, toast, wait } from './utils.js';

export async function downloadFinalMp4() {
  if (!isLoggedIn()) {
    requireAuth();
    return;
  }
  const pack = currentPack();
  if (!pack?.finalBlob && !pack?.finalUrl) return;
  let blob = pack.finalBlob;
  if (!blob && pack.finalUrl) {
    try {
      blob = await fetch(pack.finalUrl).then((response) => response.blob());
    } catch {
      toast(t('export.reexport'));
      return;
    }
  }
  const ext = blob.type.includes('mp4') || pack.finalExt === 'mp4' ? 'mp4' : 'webm';
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${safeFile(pack.name)}-dub.${ext}`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function preloadFfmpeg() {
  if (isIOS()) return Promise.resolve();
  return loadFfmpeg().catch(() => undefined);
}

export async function requestFinalMp4() {
  if (!isLoggedIn()) {
    requireAuth();
    return;
  }
  const pack = currentPack();
  if (!pack?.scenes.length) {
    toast('Importe um pack e grave as falas primeiro.');
    return;
  }
  const recorded = pack.scenes.filter((scene) => pack.takes[scene.id]).length;
  if (!packIsComplete(pack)) {
    toast(`Grave todas as falas para gerar o MP4. Faltam ${pack.scenes.length - recorded}.`);
    setTab('record');
    return;
  }
  if (!canExportVideo()) {
    toast(isPro()
      ? 'Créditos do mês acabaram. Compre extras ou aguarde a renovação PRO.'
      : 'Sem créditos. Assine o PRO ou compre um pacote para gerar o MP4.');
    setTab('credits');
    return;
  }
  if (state.exporting) {
    toast('Já estou montando o MP4.');
    return;
  }
  const watermarked = shouldWatermarkExport();
  if (watermarked) {
    toast(`Plano gratuito com 1 crédito: o MP4 sai com marca d'água ${EXPORT_WATERMARK_LABEL}. PRO remove a marca.`);
  }
  stopProjectPreview();
  abortCapture();
  state.exporting = true;
  setTab('dub');
  setExportPreview(true);
  setExportProgress(2, 'Começando');
  if (els.generateMp4Btn) els.generateMp4Btn.disabled = true;
  els.exportVideoBtn.disabled = true;
  if (els.exportVideoBtnSide) els.exportVideoBtnSide.disabled = true;
  try {
    const composed = await composeDubbedVideo(pack, setExportProgress);
    const output = composed;
    setExportProgress(100, 'Pronto');
    if (pack.finalUrl) URL.revokeObjectURL(pack.finalUrl);
    pack.finalBlob = output;
    pack.finalExt = output.type.includes('mp4') ? 'mp4' : 'webm';
    pack.watermarked = watermarked;
    pack.finalUrl = rememberUrl(URL.createObjectURL(output));
    consumeExportCredit();
    showFinalVideo(pack);
    scheduleSave();
    const isMp4 = pack.finalExt === 'mp4';
    toast(watermarked
      ? (isMp4
        ? (getLang() === 'en'
          ? `Dub ready in MP4 with ${EXPORT_WATERMARK_LABEL} watermark.`
          : `Dublagem pronta em MP4 com marca d'água ${EXPORT_WATERMARK_LABEL}.`)
        : (getLang() === 'en'
          ? `Dub ready in WebM with ${EXPORT_WATERMARK_LABEL} watermark.`
          : `Dublagem pronta em WebM com marca d'água ${EXPORT_WATERMARK_LABEL}.`))
      : (isMp4
        ? (getLang() === 'en' ? 'Dub ready in MP4. Watch or download.' : 'Dublagem pronta em MP4. Assista ou baixe.')
        : (getLang() === 'en' ? 'Dub ready in WebM. Watch or download.' : 'Dublagem pronta em WebM. Assista ou baixe.')));
    els.exportVideoBtn?.classList.remove('pulse-next');
    els.exportVideoBtnSide?.classList.remove('pulse-next');
    if (els.finalVideo) {
      els.finalVideo.currentTime = 0;
      const play = els.finalVideo.play();
      if (play) play.catch(() => toast('Toque no play para ouvir sua dublagem.'));
    }
  } catch (error) {
    const message = error.message || 'Não foi possível gerar o vídeo.';
    toast(message);
    if (els.exportStatus) els.exportStatus.textContent = message;
  } finally {
    state.exporting = false;
    if (els.generateMp4Btn) els.generateMp4Btn.disabled = false;
    els.exportVideoBtn.disabled = false;
    if (els.exportVideoBtnSide) els.exportVideoBtnSide.disabled = false;
    hideExportProgress();
  }
}

export function pickVideoMime() {
  const types = ['video/webm;codecs=vp8,opus', 'video/webm;codecs=vp9,opus', 'video/webm'];
  return types.find((type) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) || '';
}

export function exportVideoBitrate() {
  return isPhone() ? 1_800_000 : 3_500_000;
}

export function setExportPreview(on) {
  els.finalVideoWrap?.classList.toggle('is-exporting', Boolean(on));
}

export function setExportProgress(pct, text) {
  const n = Math.max(0, Math.min(100, Math.round(Number(pct) || 0)));
  els.exportProgressWrap?.classList.remove('is-hidden');
  if (els.exportProgressBar) els.exportProgressBar.style.width = `${n}%`;
  if (els.exportProgressLabel) els.exportProgressLabel.textContent = text ? `${text} ${n}%` : `${n}%`;
  if (els.exportStatus && text) els.exportStatus.textContent = `${text} ${n}%`;
}

export function hideExportProgress() {
  els.exportProgressWrap?.classList.add('is-hidden');
}

export async function urlLooksLikeOgg(url) {
  if (!url) return false;
  if (/\.(ogv|ogg|ogm|oga)(\?|#|$)/i.test(String(url))) return true;
  const known = state.blobByUrl?.get(url);
  if (!known) return false;
  try {
    if (/ogg|ogv|ogm|oga/i.test(known.type || '')) return true;
    const head = new Uint8Array(await known.slice(0, 4).arrayBuffer());
    return head[0] === 0x4f && head[1] === 0x67 && head[2] === 0x67 && head[3] === 0x53;
  } catch {
    return false;
  }
}

export function filmCandidates(pack) {
  const urls = [];
  const add = (url) => {
    if (url && !urls.includes(url)) urls.push(url);
  };
  add(pack.filmUrl);
  pack.scenes.forEach((scene) => add(scene.videoUrl));
  return urls;
}

export function loadExportVideo(src) {
  const video = els.exportFilm || document.createElement('video');
  if (/^https?:/i.test(String(src || ''))) video.crossOrigin = 'anonymous';
  else video.removeAttribute('crossorigin');
  video.muted = true;
  video.defaultMuted = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.loop = false;
  video.controls = false;
  video.removeAttribute('src');
  video.src = src;
  video.load();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), 8000);
    const done = () => {
      clearTimeout(timer);
      resolve(video);
    };
    video.onloadeddata = done;
    video.oncanplay = done;
    video.onerror = () => {
      clearTimeout(timer);
      reject(new Error('native'));
    };
  });
}

export async function waitForFilmReady(film) {
  const deadline = performance.now() + 10000;
  while (performance.now() < deadline) {
    const source = film.getPaintSource?.();
    const w = source?.videoWidth || source?.width || 0;
    const h = source?.videoHeight || source?.height || 0;
    const t = film.currentTime?.() || 0;
    if (w > 1 && h > 1 && t > 0.04) return true;
    await wait(60);
  }
  return false;
}

export async function ensureOgvPlayer() {
  if (window.OGVPlayer || window.ogv?.OGVPlayer) return window.OGVPlayer || window.ogv.OGVPlayer;
  window.OGVLoader = window.OGVLoader || {};
  const base = new URL('./vendor/ogv/', window.location.href).href;
  window.OGVLoader.base = base;
  await loadScript(`${base}ogv-support.js`);
  await loadScript(`${base}ogv.js`);
  const Player = window.OGVPlayer || window.ogv?.OGVPlayer;
  if (!Player) throw new Error('Não carregou o player de .ogv.');
  return Player;
}

function pickOgvCanvas(player, ignore) {
  const nodes = [];
  if (player?._canvas) nodes.push(player._canvas);
  if (player?._view) nodes.push(player._view);
  player?.querySelectorAll?.('canvas')?.forEach((node) => nodes.push(node));
  return nodes.find((node) => node && node !== ignore && (node.width > 1 || node.height > 1)) || null;
}

function sceneTimeSeconds(value) {
  const n = Number(value) || 0;
  return n > 20 * 60 ? n / 1000 : n;
}

export async function openOgvFilm(url, onProgress) {
  onProgress?.(12, 'Abrindo o vídeo Choicer');
  const Player = await ensureOgvPlayer();
  const wrap = els.finalVideoWrap;
  if (!wrap) throw new Error('Não achei a área do vídeo final.');
  wrap.querySelectorAll('ogvjs, canvas.export-ogv-paint').forEach((node) => node.remove());

  onProgress?.(18, 'Preparando o filme da cena');
  const player = new Player({ wasm: true, webGL: true, threading: false, simd: false });
  player.muted = true;
  player.volume = 0;
  player.setAttribute('playsinline', '');
  player.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;z-index:3;background:#000';
  wrap.appendChild(player);

  let captureStream = null;
  let captureTrack = null;
  let copyCanvas = null;
  let copying = false;
  let copyRaf = 0;

  await wait(0);
  player.src = url;
  void player.play?.()?.catch?.(() => undefined);

  const deadline = performance.now() + 8000;
  while (performance.now() < deadline) {
    const from = pickOgvCanvas(player);
    const w = player.videoWidth || from?.width || 0;
    const h = player.videoHeight || from?.height || 0;
    if (w > 1 && h > 1) break;
    await wait(50);
  }

  try { player.pause(); } catch { /* ignore */ }
  try { player.currentTime = 0; } catch { /* ignore */ }
  onProgress?.(25, 'Filme pronto');

  const durationRaw = Number(player.duration);
  return {
    duration: Number.isFinite(durationRaw) ? durationRaw : 0,
    srcUrl: url,
    currentTime: () => Number(player.currentTime) || 0,
    hasPicture: () => Boolean(pickOgvCanvas(player)),
    play: () => player.play(),
    pause: () => player.pause(),
    ended: new Promise((resolve) => player.addEventListener('ended', resolve, { once: true })),
    getPaintSource: () => copyCanvas || pickOgvCanvas(player),
    getTrack: () => {
      if (captureTrack) return captureTrack;
      const from = pickOgvCanvas(player);
      if (!from) return null;
      if (typeof from.captureStream === 'function') {
        try {
          captureStream = from.captureStream(30);
          captureTrack = captureStream.getVideoTracks()[0] || null;
          if (captureTrack) return captureTrack;
        } catch {
          captureStream = null;
        }
      }
      const width = Math.max(640, from.width || player.videoWidth || 1280);
      const height = Math.max(360, from.height || player.videoHeight || 720);
      copyCanvas = document.createElement('canvas');
      copyCanvas.className = 'export-ogv-paint';
      copyCanvas.width = width;
      copyCanvas.height = height;
      copyCanvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;z-index:4;pointer-events:none';
      wrap.appendChild(copyCanvas);
      const ctx = copyCanvas.getContext('2d', { alpha: false });
      copying = true;
      const tick = () => {
        if (!copying) return;
        try { ctx.drawImage(from, 0, 0, width, height); } catch { /* keep last frame */ }
        copyRaf = requestAnimationFrame(tick);
      };
      tick();
      captureStream = copyCanvas.captureStream(30);
      captureTrack = captureStream.getVideoTracks()[0] || null;
      return captureTrack;
    },
    stop: () => {
      copying = false;
      cancelAnimationFrame(copyRaf);
      captureStream?.getTracks().forEach((track) => track.stop());
      captureStream = null;
      captureTrack = null;
      try { player.pause(); } catch { /* ignore */ }
      player.remove();
      copyCanvas?.remove();
    }
  };
}

export async function openNativeFilm(url) {
  const video = await loadExportVideo(url);
  video.muted = true;
  try { video.currentTime = 0; } catch { /* ignore */ }
  return {
    duration: Number(video.duration) || 0,
    srcUrl: url,
    currentTime: () => Number(video.currentTime) || 0,
    play: () => video.play(),
    pause: () => video.pause(),
    ended: new Promise((resolve) => {
      video.onended = resolve;
    }),
    hasPicture: () => (video.videoWidth || 0) > 1,
    getPaintSource: () => video,
    getTrack: () => {
      const capture = video.captureStream?.bind(video) || video.mozCaptureStream?.bind(video);
      if (capture) return capture().getVideoTracks()[0];
      const width = Math.max(640, video.videoWidth || 1280);
      const height = Math.max(360, video.videoHeight || 720);
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
      const stream = canvas.captureStream(30);
      const paint = () => {
        if (video.videoWidth) ctx.drawImage(video, 0, 0, width, height);
        if (!video.ended) requestAnimationFrame(paint);
      };
      paint();
      return stream.getVideoTracks()[0];
    },
    stop: () => video.pause()
  };
}

export async function openFilmPlayback(candidates, onProgress, pack) {
  let lastError = null;
  for (const url of candidates) {
    try {
      if (await urlLooksLikeOgg(url)) return await openOgvFilm(url, onProgress);
      return await openNativeFilm(url);
    } catch (error) {
      lastError = error;
      try {
        return await openOgvFilm(url, onProgress);
      } catch (ogvError) {
        lastError = ogvError;
      }
    }
  }
  throw lastError || new Error('Não achei o vídeo da cena no ZIP.');
}

export async function decodeAudioFrom(audioCtx, blob, url) {
  const tryDecode = async (data) => audioCtx.decodeAudioData(data.slice(0));
  if (blob) {
    try {
      return await tryDecode(await blob.arrayBuffer());
    } catch {
      // tenta URL
    }
  }
  if (url) {
    return tryDecode(await fetch(url).then((response) => response.arrayBuffer()));
  }
  throw new Error('sem áudio');
}

export function startBufferAt(audioCtx, dest, buffer, when, gainValue) {
  const gain = audioCtx.createGain();
  gain.gain.value = gainValue;
  gain.connect(dest);
  const source = audioCtx.createBufferSource();
  source.buffer = buffer;
  source.connect(gain);
  source.start(Math.max(when, audioCtx.currentTime));
  return {
    gain,
    stop: () => {
      try { source.stop(); } catch { /* already stopped */ }
      source.disconnect();
      gain.disconnect();
    }
  };
}

export function duckDuringTakes(gainNode, t0, windows) {
  const param = gainNode.gain;
  param.setValueAtTime(BED_EXPORT, t0);
  windows.forEach((win) => {
    const start = t0 + win.offset;
    const end = start + win.duration;
    param.setValueAtTime(BED_EXPORT, Math.max(t0, start - 0.08));
    param.linearRampToValueAtTime(BED_DUCK, start + 0.05);
    param.setValueAtTime(BED_DUCK, Math.max(start + 0.05, end - 0.05));
    param.linearRampToValueAtTime(BED_EXPORT, end + 0.12);
  });
}

export function attachMediaBed(audioCtx, dest, srcUrl) {
  const audio = document.createElement('audio');
  audio.crossOrigin = 'anonymous';
  audio.preload = 'auto';
  audio.src = srcUrl;
  document.body.appendChild(audio);
  const gain = audioCtx.createGain();
  gain.gain.value = BED_EXPORT;
  const source = audioCtx.createMediaElementSource(audio);
  source.connect(gain);
  gain.connect(dest);
  return {
    el: audio,
    gain,
    stop: () => {
      audio.pause();
      audio.remove();
      source.disconnect();
      gain.disconnect();
    }
  };
}

export function resolveFilmUrl(pack) {
  return filmCandidates(pack)[0] || '';
}

export function drawExportWatermark(ctx, width, height) {
  const label = EXPORT_WATERMARK_LABEL;
  const pad = Math.max(14, Math.round(width * 0.022));
  const fontSize = Math.max(18, Math.round(width * 0.032));
  ctx.save();
  ctx.font = `800 ${fontSize}px Inter, system-ui, sans-serif`;
  ctx.textBaseline = 'bottom';
  const textW = ctx.measureText(label).width;
  const boxW = textW + pad * 2.2;
  const boxH = fontSize + pad * 1.35;
  const x = width - boxW - pad;
  const y = height - pad;
  ctx.fillStyle = 'rgba(9, 8, 23, 0.62)';
  roundRectPath(ctx, x, y - boxH, boxW, boxH, 10);
  ctx.fill();
  ctx.fillStyle = 'rgba(245, 46, 131, 0.9)';
  ctx.fillRect(x, y - boxH, 4, boxH);
  ctx.shadowColor = 'rgba(245, 46, 131, 0.45)';
  ctx.shadowBlur = 10;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.94)';
  ctx.fillText(label, x + pad + 2, y - pad * 0.55);
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 0.11;
  ctx.font = `900 ${Math.max(28, Math.round(width * 0.075))}px Inter, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.translate(width / 2, height / 2);
  ctx.rotate(-0.32);
  ctx.fillStyle = '#f52e83';
  ctx.fillText(label, 0, 0);
  ctx.restore();
}

export async function buildWatermarkedVideoTrack(film) {
  let width = 1280;
  let height = 720;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const source = film.getPaintSource?.();
    const w = source?.videoWidth || source?.width || 0;
    const h = source?.videoHeight || source?.height || 0;
    if (w > 1 && h > 1) {
      width = w;
      height = h;
      break;
    }
    await wait(40);
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
  let painting = true;
  const paint = () => {
    if (!painting) return;
    const source = film.getPaintSource?.();
    if (source) {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, width, height);
      coverDraw(ctx, source, width, height);
      drawExportWatermark(ctx, width, height);
    }
    requestAnimationFrame(paint);
  };
  paint();
  const stream = canvas.captureStream(30);
  return {
    track: stream.getVideoTracks()[0],
    stop: () => {
      painting = false;
      stream.getTracks().forEach((track) => track.stop());
    }
  };
}

export async function composeDubbedVideo(pack, onProgress) {
  const candidates = filmCandidates(pack);
  if (!candidates.length) {
    throw new Error('Este pack não tem o vídeo completo da cena (dub_video). Importe o ZIP de novo com o filme, não só as imagens das falas.');
  }

  const audioCtx = new AudioContext();
  await audioCtx.resume();
  const dest = audioCtx.createMediaStreamDestination();
  const mimeType = pickVideoMime();
  if (!mimeType && typeof MediaRecorder === 'undefined') {
    throw new Error('Este navegador não grava vídeo. Abra no Chrome.');
  }
  const stops = [];
  let film;
  let bed;
  let recordingStarted = false;
  let recorder;
  let stopped = Promise.resolve();
  const chunks = [];
  setExportPreview(true);

  try {
    onProgress?.(4, 'Preparando as vozes');
    const lastLineEnd = pack.scenes.reduce((max, raw) => {
      const scene = decorateScene(raw);
      return Math.max(max, sceneTimeSeconds(scene.videoOffset) + (Number(scene.duration) || 0));
    }, 0);

    const takeWindows = pack.scenes.map((raw) => {
      const scene = decorateScene(raw);
      const take = pack.takes[scene.id];
      if (!take) return null;
      return {
        offset: sceneTimeSeconds(scene.videoOffset),
        duration: Number(scene.duration) || 2,
        take,
        scene
      };
    }).filter(Boolean);

    setExportProgress(8, 'Preparando as vozes');
    let playBacking = null;
    if (pack.backingUrl) {
      try {
        const backingBuf = await decodeAudioFrom(audioCtx, null, pack.backingUrl);
        playBacking = (t0) => {
          const node = startBufferAt(audioCtx, dest, backingBuf, t0, BED_EXPORT);
          stops.push(node.stop);
          return node.gain;
        };
      } catch {
        playBacking = null;
      }
    }

    const takeBuffers = [];
    for (let index = 0; index < takeWindows.length; index += 1) {
      const win = takeWindows[index];
      setExportProgress(8 + ((index + 1) / Math.max(1, takeWindows.length)) * 10, 'Preparando as vozes');
      try {
        takeBuffers.push({
          ...win,
          buffer: await decodeAudioFrom(audioCtx, win.take.blob, win.take.url)
        });
      } catch {
        // Sem take decodificado, a fala original do filme fica.
      }
    }

    onProgress?.(18, 'Carregando o vídeo da cena');
    film = await openFilmPlayback(candidates, setExportProgress, pack);

    if (!playBacking && !(await urlLooksLikeOgg(film.srcUrl))) {
      try {
        bed = attachMediaBed(audioCtx, dest, film.srcUrl);
      } catch {
        bed = null;
      }
    }

    const videoTrack = film.getTrack();
    if (!videoTrack) throw new Error('Não deu para capturar o filme da cena.');

    const mixed = new MediaStream([
      videoTrack,
      ...dest.stream.getAudioTracks()
    ]);
    try {
      recorder = mimeType
        ? new MediaRecorder(mixed, { mimeType, videoBitsPerSecond: 3_500_000 })
        : new MediaRecorder(mixed);
    } catch {
      recorder = new MediaRecorder(mixed);
    }
    recorder.onerror = () => {
      chunks.length = 0;
    };
    recorder.ondataavailable = (event) => {
      if (event.data?.size) chunks.push(event.data);
    };
    stopped = new Promise((resolve) => {
      recorder.onstop = resolve;
    });

    if (bed) bed.el.currentTime = 0;
    recorder.start(250);
    recordingStarted = true;
    await film.play()?.catch?.(() => undefined);
    if (bed) await bed.el.play().catch(() => undefined);
    const t0 = audioCtx.currentTime;
    const bedGain = playBacking?.(t0) || bed?.gain;
    if (bedGain && takeBuffers.length) duckDuringTakes(bedGain, t0, takeBuffers);
    takeBuffers.forEach((win) => {
      stops.push(startBufferAt(audioCtx, dest, win.buffer, t0 + win.offset, gainForTake(win.buffer)).stop);
    });

    const rawDuration = Number(film.duration);
    const lineEnd = Number.isFinite(lastLineEnd) && lastLineEnd > 20 * 60 ? lastLineEnd / 1000 : lastLineEnd;
    const duration = (Number.isFinite(rawDuration) && rawDuration > 1 && rawDuration <= 20 * 60)
      ? rawDuration
      : Math.min(Math.max(lineEnd, 8), 20 * 60);
    let finished = false;
    film.ended.then(() => { finished = true; });
    const startedAt = performance.now();
    while (!finished && performance.now() - startedAt < duration * 1000 + 1000) {
      const t = film.currentTime?.() || 0;
      const elapsed = (performance.now() - startedAt) / 1000;
      const shown = t > 0.2 ? t : elapsed;
      setExportProgress(30 + Math.min(60, (shown / duration) * 60), 'Gerando o vídeo');
      if (t > 0.4 && t >= duration - 0.12) break;
      await wait(200);
    }
    setExportProgress(90, 'Finalizando');
  } finally {
    if (recordingStarted && recorder) {
      if (recorder.state === 'recording') {
        recorder.requestData();
        await wait(400);
        recorder.stop();
      }
      await stopped;
    }
    stops.forEach((stop) => stop?.());
    bed?.stop();
    film?.stop();
    dest.stream.getTracks().forEach((track) => track.stop());
    await audioCtx.close().catch(() => undefined);
    setExportPreview(false);
  }

  const blob = new Blob(chunks, { type: recorder?.mimeType || mimeType || 'video/webm' });
  if (blob.size < 8000) {
    throw new Error(getLang() === 'en'
      ? 'Could not record the video. On Chrome, keep this tab open and try again.'
      : 'Não consegui gravar o vídeo. No Chrome, deixe esta aba aberta e toque em gerar de novo.');
  }
  return blob;
}

export async function loadFfmpeg() {
  if (state.ffmpeg?.isLoaded?.()) return state.ffmpeg;
  let lastError;
  for (const cdn of FFMPEG_CDNS) {
    try {
      await loadScript(cdn.script);
      const { createFFmpeg } = window.FFmpeg || {};
      if (!createFFmpeg) throw new Error('FFmpeg não apareceu no navegador.');
      const ffmpeg = createFFmpeg({
        log: false,
        mainName: 'createFFmpegCore',
        corePath: cdn.core
      });
      await ffmpeg.load();
      state.ffmpeg = ffmpeg;
      return ffmpeg;
    } catch (error) {
      lastError = error;
      state.ffmpeg = null;
    }
  }
  throw lastError || new Error('Não deu para carregar o conversor MP4.');
}

export async function convertToMp4(blob) {
  const mobile = isPhone();
  const work = (async () => {
    setExportProgress(92, 'Carregando conversor MP4');
    const ffmpeg = await loadFfmpeg();
    const { fetchFile } = window.FFmpeg;
    ffmpeg.setProgress?.(({ ratio }) => {
      setExportProgress(93 + Math.round(Math.min(6, Math.max(0, Number(ratio) || 0) * 6)), 'Convertendo para MP4');
    });
    const input = blob.type.includes('mp4') ? 'input.mp4' : 'input.webm';
    ffmpeg.FS('writeFile', input, await fetchFile(blob));
    const recipes = mobile
      ? [
        ['-i', input, '-vf', 'scale=-2:480', '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '30', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart', 'output.mp4'],
        ['-i', input, '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-movflags', '+faststart', 'output.mp4']
      ]
      : [
        ['-i', input, '-vf', 'scale=-2:720', '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '28', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', 'output.mp4'],
        ['-i', input, '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-movflags', '+faststart', 'output.mp4']
      ];
    let converted = false;
    let lastError;
    for (const args of recipes) {
      try {
        await ffmpeg.run(...args);
        converted = true;
        break;
      } catch (error) {
        lastError = error;
        try { ffmpeg.FS('unlink', 'output.mp4'); } catch { /* ignore */ }
      }
    }
    try { ffmpeg.FS('unlink', input); } catch { /* ignore */ }
    if (!converted) {
      throw new Error(lastError?.message || 'FFmpeg não conseguiu gerar o MP4.');
    }
    const data = ffmpeg.FS('readFile', 'output.mp4');
    try { ffmpeg.FS('unlink', 'output.mp4'); } catch { /* ignore */ }
    if (!data?.length) throw new Error('O MP4 saiu vazio.');
    return new Blob([data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)], { type: 'video/mp4' });
  })();
  return Promise.race([
    work,
    wait(mobile ? 300000 : 180000).then(() => {
      throw new Error('Conversão MP4 demorou demais. Tente de novo com Wi‑Fi ligado.');
    })
  ]);
}
