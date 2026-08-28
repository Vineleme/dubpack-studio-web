import { t, getLang } from './i18n-bridge.js';
import { AUDIO_EXTS, MAX_LINE_SECONDS, TAKE_PEAK_TARGET, PACK_TTL_MS } from './constants.js';
import { state, els } from './state.js';
import { profileTakeAudio } from './recorder.js';

export function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function displayNameFromEmail(email) {
  const local = String(email || '').split('@')[0];
  return local || 'Conta';
}

export function packExpiresAt(pack) {
  return (Number(pack?.importedAt) || 0) + PACK_TTL_MS;
}

export function packIsExpired(pack) {
  return Date.now() > packExpiresAt(pack);
}

export function remainingLabel(pack) {
  const ms = packExpiresAt(pack) - Date.now();
  if (ms <= 0) return 'Expirou';
  const hours = Math.ceil(ms / 36e5);
  if (hours < 24) return `Expira em ${hours}h`;
  return `Expira em ${Math.ceil(hours / 24)}d`;
}

export function packIsComplete(pack) {
  return Boolean(pack?.scenes.length && pack.scenes.every((scene) => pack.takes[scene.id]));
}

export function finishCtaLabel(pack) {
  return pack?.finalUrl ? t('record.regenerate') : t('record.finish');
}

export function iosAudioHint() {
  return isIOS()
    ? 'Sem som? Desligue o modo silencioso do iPhone (chave lateral) e toque de novo.'
    : 'Não consegui tocar o áudio. Toque de novo.';
}

export function isPhone() {
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    || window.matchMedia('(pointer: coarse)').matches;
}

export function isIOS() {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function takeLooksLikeWebm(take) {
  if (!take) return false;
  return take.ext === 'webm'
    || String(take.blob?.type || '').includes('webm')
    || String(take.url || '').includes('webm');
}

export function takePlaceholder(text) {
  const card = document.createElement('div');
  card.className = 'take-card';
  card.textContent = text;
  return card;
}

export function voiceLevelFromPeak(peak) {
  const n = Number(peak) || 0;
  if (n < 0.14) return { id: 'low', hint: 'Fale mais perto do microfone' };
  if (n > 0.78) return { id: 'high', hint: 'Um pouco alto — afaste um pouco' };
  return { id: 'good', hint: 'Volume bom para a dublagem' };
}

export function bufferPeak(buffer) {
  let peak = 0;
  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < data.length; i += 1) peak = Math.max(peak, Math.abs(data[i]));
  }
  return peak;
}

export function gainForTake(buffer) {
  const peak = bufferPeak(buffer);
  if (peak < 0.02) return 2.4;
  return Math.min(3.4, Math.max(0.85, TAKE_PEAK_TARGET / peak));
}

export async function measureBlobPeak(blob) {
  const profile = await profileTakeAudio(blob);
  return profile.peak || 0;
}

export function formatClock(value) {
  const total = Math.max(0, Number(value) || 0);
  const minutes = Math.floor(total / 60);
  const seconds = Math.floor(total % 60);
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function rememberUrl(url, blob) {
  if (url) state.objectUrls.push(url);
  if (url && blob) state.blobByUrl.set(url, blob);
  return url;
}

export function forgetUrl(url) {
  if (!url) return;
  try {
    URL.revokeObjectURL(url);
  } catch {
    // ignore
  }
  state.objectUrls = state.objectUrls.filter((item) => item !== url);
  state.blobByUrl.delete(url);
}

export function revokeAllObjectUrls() {
  const urls = [...new Set(state.objectUrls)];
  state.objectUrls = [];
  state.blobByUrl.clear();
  urls.forEach((url) => {
    try {
      URL.revokeObjectURL(url);
    } catch {
      // ignore
    }
  });
}

export function toast(message) {
  els.appToast.textContent = message;
  els.appToast.hidden = false;
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => {
    els.appToast.hidden = true;
  }, 3200);
}

export function formatBrl(value, { monthly = false } = {}) {
  const amount = Number.isInteger(value)
    ? `R$ ${value},00`
    : `R$ ${value.toFixed(2).replace('.', ',')}`;
  if (!monthly) return amount;
  return `${amount}/${getLang() === 'en' ? 'mo' : 'mês'}`;
}

export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

export function coverDraw(ctx, media, width, height) {
  const mw = media.videoWidth || media.naturalWidth || media.width || width;
  const mh = media.videoHeight || media.naturalHeight || media.height || height;
  const scale = Math.max(width / mw, height / mh);
  const dw = mw * scale;
  const dh = mh * scale;
  ctx.drawImage(media, (width - dw) / 2, (height - dh) / 2, dw, dh);
}

export function roundRectPath(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

export function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = String(text || '').split(' ');
  let line = '';
  let offset = 0;
  words.forEach((word, index) => {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, y + offset);
      line = word;
      offset += lineHeight;
    } else {
      line = test;
    }
    if (index === words.length - 1) ctx.fillText(line, x, y + offset);
  });
}

export function loadScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-src="${src}"]`);
    if (existing) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.crossOrigin = 'anonymous';
    script.dataset.src = src;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`Não carreguei ${src}`));
    document.head.appendChild(script);
  });
}

export function findSceneArt(choicer, index, images, objectUrl, audioEntry) {
  if (!images.length) return '';
  const wanted = choicer?.image || '';
  if (wanted) {
    const wantedBase = normalizeBaseName(wanted);
    const wantedFile = wanted.split('/').pop();
    const exact = images.find((entry) => {
      const file = entry.name.split('/').pop() || '';
      return file === wantedFile
        || file.endsWith(wantedFile)
        || normalizeBaseName(file) === wantedBase;
    });
    if (exact) return objectUrl(exact);
  }
  const takeNumber = index + 1;
  const numbered = images.find((entry) => extractTakeNumber(entry.name) === takeNumber);
  if (numbered) return objectUrl(numbered);
  return visualUrlFor(audioEntry, index, images, objectUrl);
}

export function visualUrlFor(audioEntry, index, visualEntries, objectUrl) {
  if (!visualEntries.length) return '';
  const audioBase = normalizeBaseName(audioEntry.name);
  const takeNumber = index + 1;
  const exact = visualEntries.find((entry) => normalizeBaseName(entry.name) === audioBase);
  const numbered = visualEntries.find((entry) => extractTakeNumber(entry.name) === takeNumber);
  const partial = visualEntries.find((entry) => {
    const visualBase = normalizeBaseName(entry.name);
    return visualBase.includes(audioBase) || audioBase.includes(visualBase);
  });
  const selected = exact || numbered || partial || visualEntries[index];
  return selected ? objectUrl(selected) : '';
}

export function extractTakeNumber(name) {
  const file = name.split('/').pop() || '';
  const match = file.match(/(?:^|[^\d])(\d{1,3})(?=[^\d]|$)/);
  return match ? Number(match[1]) : null;
}

export function findSharedVideo(videos) {
  const fileName = (entry) => entry.name.split('/').pop() || '';
  const playable = ['mp4', 'webm', 'm4v', 'ogv'];
  const named = videos.filter((entry) => /dub[_-]?video/i.test(fileName(entry)));
  return named.find((entry) => playable.includes(entry.ext))
    || videos.find((entry) => playable.includes(entry.ext) && /full[_-]?video|^video$/i.test(normalizeBaseName(entry.name)))
    || named[0]
    || videos.find((entry) => /full[_-]?video|^video$/i.test(normalizeBaseName(entry.name)))
    || videos.find((entry) => playable.includes(entry.ext))
    || null;
}

export function findBackingTrack(entries) {
  return entries.find((entry) => (
    AUDIO_EXTS.includes(entry.ext)
    && /backing/i.test(entry.name.split('/').pop() || '')
  )) || null;
}

export function readPackMeta(entries) {
  const jsonFiles = entries.filter((entry) => entry.ext === 'json');
  for (const json of jsonFiles) {
    try {
      const parsed = JSON.parse(new TextDecoder().decode(json.data));
      if (Array.isArray(parsed) && parsed.some((item) => item && (item.text || item.line || item.subtitle))) {
        return parsed;
      }
      const lines = parsed.lines || parsed.clips || parsed.scenes || parsed.dialogues || parsed.takes;
      if (Array.isArray(lines) && lines.length) return lines;
    } catch {
      // Tenta o próximo JSON do pack.
    }
  }
  return null;
}

export function readSidecarText(audioEntry, entries) {
  const audioBase = normalizeBaseName(audioEntry.name);
  const sidecar = entries.find((entry) => (
    (entry.ext === 'txt' || entry.ext === 'srt')
    && normalizeBaseName(entry.name) === audioBase
  ));
  if (!sidecar) return '';
  const raw = new TextDecoder().decode(sidecar.data).replace(/\r/g, '').trim();
  if (sidecar.ext === 'srt') {
    return raw
      .split(/\n\s*\n/)
      .map((block) => block.split('\n').filter((line) => !/^\d+$/.test(line) && !/-->/.test(line)).join(' ').trim())
      .filter(Boolean)
      .join(' ')
      .trim();
  }
  return raw;
}

export function isJunkPath(name) {
  return name.startsWith('__MACOSX') || name.includes('/.') || name.split('/').pop()?.startsWith('.');
}

export function namesMatch(path, wanted) {
  if (!wanted) return false;
  return normalizeBaseName(path) === normalizeBaseName(wanted) || path.endsWith(wanted);
}

export function normalizeBaseName(name) {
  return (name.split('/').pop() || name)
    .replace(/\.[^.]+$/, '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '');
}

export function mimeFor(ext) {
  const map = {
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    ogg: 'audio/ogg',
    m4a: 'audio/mp4',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    gif: 'image/gif',
    mp4: 'video/mp4',
    mov: 'video/quicktime',
    webm: 'video/webm',
    ogv: 'video/ogg',
  };
  return map[ext] ?? 'application/octet-stream';
}

export function pickRecorderMime() {
  const iosTypes = ['audio/mp4', 'audio/mp4;codecs=mp4a.40.2', 'audio/aac'];
  const defaultTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4;codecs=mp4a.40.2', 'audio/mp4'];
  const types = isIOS() ? [...iosTypes, ...defaultTypes] : defaultTypes;
  return types.find((type) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) || '';
}

export function detectCharacter(name) {
  const choicer = parseChoicerFields(name);
  if (choicer?.character) return choicer.character;
  const parts = name.replace(/\.[^.]+$/, '').split(/[_-]/).filter(Boolean);
  return parts.find((part) => /[a-zA-ZÀ-ÿ]/.test(part) && !/^\d+$/.test(part) && !/^(data|caption|image)$/i.test(part)) ?? 'Personagem';
}

export function parseChoicerFields(raw) {
  const text = String(raw || '');
  if (!/caption\s*=|dub_characters\s*=|dub_timestamps\s*=/i.test(text)) return null;

  const unquote = (value) => String(value || '')
    .replace(/\\"/g, '"')
    .replace(/\\'/g, "'")
    .replace(/^"+|"+$/g, '')
    .replace(/^'+|'+$/g, '')
    .trim();

  const captionMatch = text.match(/caption\s*=\s*""([^"]+)""/i)
    || text.match(/caption\s*=\s*"((?:\\.|[^"\\])+)"/i)
    || text.match(/caption\s*=\s*'((?:\\.|[^'\\])+)'/i)
    || text.match(/caption\s*=\s*(?:\\*")?([^"\n]+?)(?:\\*")?\s+image=/i);
  const imageMatch = text.match(/image\s*=\s*"((?:\\.|[^"\\])*)"/i);
  const timesMatch = text.match(/dub_timestamps\s*=\s*\[([^\]]*)\]/i);
  const charsMatch = text.match(/dub_characters\s*=\s*\[([^\]]*)\]/i);
  const timestamps = timesMatch
    ? timesMatch[1].split(',').map((item) => Number(String(item).trim().replace(/['"]/g, ''))).filter((item) => Number.isFinite(item))
    : [];
  const characters = charsMatch
    ? charsMatch[1].split(',').map((item) => unquote(item.trim())).filter(Boolean)
    : [];

  return {
    caption: unquote(captionMatch?.[1] || ''),
    image: unquote(imageMatch?.[1] || ''),
    timestamps,
    character: characters[0] || ''
  };
}


export function spokenLineFromName(name, character) {
  const choicer = parseChoicerFields(name);
  if (choicer?.caption) return choicer.caption;
  const raw = String(name || '').replace(/\.[^.]+$/, '');
  const parts = raw
    .split(/\s*[-–—_|]\s*|__/)
    .map((part) => part.trim())
    .filter(Boolean);
  const withoutIndex = parts.filter((part, index) => !(index === 0 && /^\d+$/.test(part)));
  const characterName = String(character || '').trim().toLowerCase();
  const leftover = withoutIndex.filter((part) => part.toLowerCase() !== characterName && !/^\d+$/.test(part));
  if (leftover.length) return leftover.join(' ');
  return cleanSubtitle(name);
}

export function cleanSubtitle(name) {
  return String(name || '').replace(/\.[^.]+$/, '').replace(/^\d+[_-]?/, '').replace(/[_-]+/g, ' ').trim();
}

export function estimateDuration(name) {
  const match = name.match(/(\d+(?:[.,]\d+)?)s/i);
  if (match) return Math.max(1.2, Number(match[1].replace(',', '.')));
  return Math.min(12, Math.max(1.8, cleanSubtitle(name).length / 16));
}

export function clampDuration(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return 2;
  return Math.min(MAX_LINE_SECONDS, Math.max(0.8, number));
}

export function formatSeconds(value) {
  const total = Math.max(0, Math.round(Number(value) || 0));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function getMediaDuration(url) {
  return new Promise((resolve, reject) => {
    const audio = new Audio();
    const timer = setTimeout(() => {
      audio.src = '';
      reject(new Error('timeout'));
    }, 8000);
    audio.preload = 'metadata';
    audio.onloadedmetadata = () => {
      clearTimeout(timer);
      const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
      resolve(clampDuration(duration || 0));
    };
    audio.onerror = () => {
      clearTimeout(timer);
      reject(new Error('media'));
    };
    audio.src = url;
  });
}

export function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function interruptibleWait(ms, gen) {
  const step = 120;
  let left = ms;
  while (left > 0) {
    if (!state.previewing || state.previewGen !== gen) return false;
    const chunk = Math.min(step, left);
    await wait(chunk);
    left -= chunk;
  }
  return state.previewing && state.previewGen === gen;
}

export function safeFile(value) {
  return String(value || 'take').replace(/[^\w\-]+/g, '_').slice(0, 40);
}
