import { state, els } from './state.js';
import { loadScript, wait } from './utils.js';

const oggCache = new Map();
let stageOgvPlayer = null;
let stageOgvUrl = '';

export async function urlLooksLikeOgg(url) {
  if (!url) return false;
  if (oggCache.has(url)) return oggCache.get(url);

  const known = state.blobByUrl?.get(url);
  if (known && /ogg|ogv|ogm|oga/i.test(known.type || '')) {
    oggCache.set(url, true);
    return true;
  }

  try {
    const blob = known || await fetch(url).then((response) => response.blob());
    if (/ogg|ogv|ogm|oga/i.test(blob.type || '')) {
      oggCache.set(url, true);
      return true;
    }
    const head = new Uint8Array(await blob.slice(0, 4).arrayBuffer());
    const isOgg = head[0] === 0x4f && head[1] === 0x67 && head[2] === 0x67 && head[3] === 0x53;
    oggCache.set(url, isOgg);
    return isOgg;
  } catch {
    oggCache.set(url, false);
    return false;
  }
}

export async function ensureOgvPlayer() {
  if (window.OGVPlayer || window.ogv?.OGVPlayer) return window.OGVPlayer || window.ogv.OGVPlayer;
  window.OGVLoader = window.OGVLoader || {};
  // Decoder fica no app (uma vez). O ZIP do usuário nunca sobe para o nosso servidor.
  const base = new URL('./vendor/ogv/', window.location.href).href;
  window.OGVLoader.base = base;
  await loadScript(`${base}ogv-support.js`);
  await loadScript(`${base}ogv.js`);
  const Player = window.OGVPlayer || window.ogv?.OGVPlayer;
  if (!Player) throw new Error('Não carregou o player de .ogv.');
  return Player;
}

export function warmOgvDecoder() {
  void ensureOgvPlayer().catch(() => undefined);
}

export function destroyStageOgv() {
  if (!stageOgvPlayer) return;
  try { stageOgvPlayer.pause(); } catch { /* ignore */ }
  stageOgvPlayer.remove();
  stageOgvPlayer = null;
  stageOgvUrl = '';
}

/** Move o player do palco para o export (um decoder WASM só). */
export function takeStageOgvForExport(targetWrap) {
  if (!stageOgvPlayer || !targetWrap) return null;
  const player = stageOgvPlayer;
  const url = stageOgvUrl;
  stageOgvPlayer = null;
  stageOgvUrl = '';
  try { player.pause(); } catch { /* ignore */ }
  targetWrap.querySelectorAll('ogvjs, canvas.export-ogv-paint').forEach((node) => node.remove());
  player.muted = true;
  player.setAttribute('playsinline', '');
  player.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;z-index:3;background:#000';
  targetWrap.appendChild(player);
  return { player, url };
}

export async function ensureStageOgv(url) {
  const shell = els.sceneVideo?.parentElement;
  if (!shell || !url) return null;
  const Player = await ensureOgvPlayer();
  if (stageOgvPlayer && stageOgvUrl === url) return stageOgvPlayer;

  destroyStageOgv();
  const player = new Player({ wasm: true, webGL: false });
  player.muted = true;
  player.setAttribute('playsinline', '');
  player.className = 'scene-ogv';
  shell.appendChild(player);
  player.src = url;
  stageOgvPlayer = player;
  stageOgvUrl = url;
  await new Promise((resolve) => {
    const timer = setTimeout(resolve, 8000);
    const done = () => {
      clearTimeout(timer);
      resolve();
    };
    player.addEventListener('loadedmetadata', done, { once: true });
    player.addEventListener('canplay', done, { once: true });
    player.addEventListener('error', done, { once: true });
  });
  return player;
}

export async function seekStageOgv(time = 0) {
  if (!stageOgvPlayer) return;
  try { stageOgvPlayer.currentTime = Math.max(0, Number(time) || 0); } catch { /* ignore */ }
  await wait(40);
}

export function playStageOgv() {
  return stageOgvPlayer?.play?.()?.catch?.(() => undefined);
}

export function pauseStageOgv() {
  try { stageOgvPlayer?.pause?.(); } catch { /* ignore */ }
}

export function getStageOgv() {
  return stageOgvPlayer;
}

export function stageOgvMatches(url) {
  return Boolean(stageOgvPlayer && stageOgvUrl && stageOgvUrl === url);
}

export function ogvDecoderCanvas(player) {
  const from = player?._canvas || player?.querySelector?.('canvas');
  if (from && from.width > 1 && from.height > 1) return from;
  return null;
}

export function ogvPaintSource(player) {
  return ogvDecoderCanvas(player);
}

export async function waitForOgvFrame(player, fallbackCanvas, timeoutMs = 45000) {
  if (!player) return false;
  await player.play?.()?.catch?.(() => undefined);
  const deadline = performance.now() + timeoutMs;
  while (performance.now() < deadline) {
    const from = ogvDecoderCanvas(player);
    if (from) return true;
    const w = player.videoWidth || fallbackCanvas?.width || 0;
    const h = player.videoHeight || fallbackCanvas?.height || 0;
    if (w > 1 && h > 1 && player.readyState >= 2) {
      await wait(120);
      if (ogvDecoderCanvas(player)) return true;
    }
    await wait(60);
  }
  return false;
}
