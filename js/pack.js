import { t } from './i18n-bridge.js';
import { AUDIO_EXTS, IMAGE_EXTS, VIDEO_EXTS, EXPORT_WATERMARK_LABEL } from './constants.js';
import { state, els } from './state.js';
import { isLoggedIn, requireAuth } from './auth.js';
import { renderActivity } from './credits.js';
import { preloadFfmpeg } from './export.js';
import { scheduleSave } from './persist.js';
import { bindSceneVisual, stopActivePlayback, stopProjectPreview, warmSceneAudio } from './playback.js';
import { abortCapture, profileTakeAudio, setVoiceMeter } from './recorder.js';
import { renderTakeRail, setTab, timingMessage, updateScoreCard, updateTimingDesk } from './ui.js';
import { clampDuration, detectCharacter, estimateDuration, findBackingTrack, findSceneArt, findSharedVideo, finishCtaLabel, forgetUrl, formatSeconds, getMediaDuration, isIOS, isJunkPath, mimeFor, namesMatch, normalizeEmail, packIsComplete, packIsExpired, parseChoicerFields, readPackMeta, readSidecarText, rememberUrl, revokeAllObjectUrls, spokenLineFromName, toast, visualUrlFor, wait } from './utils.js';

export function releasePackSession() {
  abortCapture();
  state.packs.forEach((pack) => revokePackMedia(pack));
  state.packs = [];
  state.activePackId = null;
  revokeAllObjectUrls();
}

export function pruneExpiredPacks() {
  const kept = [];
  let dropped = 0;
  state.packs.forEach((pack) => {
    if (packIsExpired(pack)) {
      revokePackMedia(pack);
      dropped += 1;
    } else kept.push(pack);
  });
  if (!dropped) return;
  state.packs = kept;
  if (!currentPack()) state.activePackId = state.packs[0]?.id || null;
  scheduleSave();
  toast(`${dropped} pack${dropped > 1 ? 's' : ''} expiraram depois de 2 dias.`);
  renderPackGrid();
}

export function sessionStoreKey() {
  const email = normalizeEmail(state.user?.email);
  return email ? `user:${email}` : 'current';
}

export async function importPack(event) {
  if (!isLoggedIn()) {
    event.target.value = '';
    requireAuth();
    return;
  }
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) return;
  toast('Abrindo o ZIP…');
  await wait(20);

  try {
    const zipBytes = new Uint8Array(await file.arrayBuffer());
    if (zipBytes.length < 4 || zipBytes[0] !== 0x50 || zipBytes[1] !== 0x4b) {
      throw new Error('Isso não é um ZIP. Importe o pack em .zip.');
    }
    toast('Lendo arquivos do pack…');
    const packName = file.name.replace(/\.zip$/i, '');
    const pack = await buildPack(packName, zipBytes);
    upsertPack(pack);
    state.activePackId = pack.id;
    state.activeIndex = 0;
    renderPackGrid();
    updateScoreCard();
    selectScene(0);
    setTab('record');
    scheduleSave();
    warmSceneAudio(pack.scenes);
    const count = pack.scenes.length;
    toast(`${count} ${count === 1 ? 'fala' : 'falas'} em “${pack.name}”.`);
  } catch (error) {
    toast(error.message || 'Não foi possível abrir este ZIP.');
  }
}

export async function buildPack(name, zipBytes) {
  await wait(0);
  let files;
  try {
    files = await new Promise((resolve, reject) => {
      window.setTimeout(() => {
        try {
          resolve(fflate.unzipSync(zipBytes));
        } catch (error) {
          reject(error);
        }
      }, 0);
    });
  } catch {
    throw new Error('ZIP inválido ou corrompido.');
  }

  const entries = Object.entries(files)
    .filter(([entryName]) => !isJunkPath(entryName))
    .map(([entryName, data]) => ({
      name: entryName,
    data,
      ext: entryName.split('.').pop()?.toLowerCase() ?? ''
    }));

  const audio = entries
    .filter((entry) => AUDIO_EXTS.includes(entry.ext) && !/backing/i.test(entry.name))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
  const images = entries.filter((entry) => IMAGE_EXTS.includes(entry.ext));
  const videos = entries.filter((entry) => VIDEO_EXTS.includes(entry.ext));
  const backing = findBackingTrack(entries);
  const sharedVideo = findSharedVideo(videos) || (videos.length === 1 ? videos[0] : null);
  const meta = readPackMeta(entries);

  if (!audio.length && !meta?.length) {
    throw new Error('Este ZIP não tem áudios de fala (mp3, wav, ogg ou m4a).');
  }

  const urlCache = new Map();
  const objectUrl = (entry) => {
    if (!entry) return '';
    if (urlCache.has(entry.name)) return urlCache.get(entry.name);
    const blob = new Blob([entry.data], { type: mimeFor(entry.ext) });
    const url = rememberUrl(URL.createObjectURL(blob), blob);
    urlCache.set(entry.name, url);
    return url;
  };

  const sourceAudio = meta?.length
    ? meta.map((line, index) => {
        const match = audio.find((entry) => namesMatch(entry.name, line.file || line.audio || line.src || '')) || audio[index];
        return { entry: match, line };
      }).filter((item) => item.entry)
    : audio.map((entry) => ({ entry, line: null }));

  if (!sourceAudio.length) {
    throw new Error('Não achei os arquivos de áudio descritos no pack.');
  }

  const sharedUrl = sharedVideo ? objectUrl(sharedVideo) : '';
  const firstVideo = videos[0] ? objectUrl(videos[0]) : '';

  const scenes = await Promise.all(sourceAudio.map(async ({ entry, line }, index) => {
    const baseName = entry.name.split('/').pop()?.replace(/\.[^.]+$/, '') ?? `Fala ${index + 1}`;
    const audioUrl = objectUrl(entry);
    const sidecar = readSidecarText(entry, entries);
    const choicer = parseChoicerFields([baseName, sidecar, line?.caption, line?.text, JSON.stringify(line || {})].join('\n'));
    const metaDuration = line?.duration ?? (line?.end != null && line?.start != null ? line.end - line.start : null);
    const measured = metaDuration
      ? Number(metaDuration)
      : await getMediaDuration(audioUrl).catch(() => estimateDuration(choicer?.caption || baseName));
    const nextStamp = parseChoicerFields(sourceAudio[index + 1]?.entry.name.split('/').pop() || '')?.timestamps?.[0];
    const stamp = choicer?.timestamps?.[0];
    const span = Number.isFinite(stamp) && Number.isFinite(nextStamp) && nextStamp > stamp
      ? nextStamp - stamp
      : null;
    const duration = clampDuration(span && Math.abs(span - measured) < 8 ? Math.min(span, measured + 0.35) : measured);
    const character = choicer?.character || line?.character || line?.speaker || detectCharacter(choicer?.caption || baseName);
    const subtitle = choicer?.caption || line?.text || line?.line || line?.subtitle || line?.dialogue || sidecar || spokenLineFromName(baseName, character);
    const imageUrl = findSceneArt(choicer, index, images, objectUrl, entry);
    const matchedVideo = visualUrlFor(entry, index, videos, objectUrl);
    return {
      id: `${index}-${baseName}`,
      title: baseName,
      character,
      subtitle,
      duration,
      durationLabel: formatSeconds(duration),
      audioUrl,
      imageUrl,
      videoUrl: matchedVideo || sharedUrl || firstVideo,
      videoOffset: Number(stamp ?? line?.start ?? line?.offset ?? 0)
    };
  }));

  const sharedTimeline = scenes.length > 1 && scenes.every((scene) => scene.videoUrl && scene.videoUrl === scenes[0].videoUrl);
  const hasExplicitOffsets = scenes.some((scene) => scene.videoOffset > 0);
  if (sharedTimeline && !hasExplicitOffsets) {
    let cursor = 0;
    scenes.forEach((scene) => {
      scene.videoOffset = cursor;
      cursor += scene.duration;
    });
  }

  return {
    id: crypto.randomUUID ? crypto.randomUUID() : `pack-${Date.now()}`,
    name,
    zipBytes,
    scenes,
    takes: {},
    importedAt: Date.now(),
    filmUrl: sharedVideo ? objectUrl(sharedVideo) : '',
    backingUrl: backing ? objectUrl(backing) : ''
  };
}

export function upsertPack(pack) {
  const existing = state.packs.findIndex((item) => item.name.toLowerCase() === pack.name.toLowerCase());
  if (existing >= 0) {
    revokePackMedia(state.packs[existing]);
    pack.id = state.packs[existing].id;
    state.packs[existing] = pack;
    return;
  }
  state.packs.push(pack);
}

export function currentPack() {
  return state.packs.find((pack) => pack.id === state.activePackId) ?? null;
}

export function currentScene() {
  const pack = currentPack();
  return decorateScene(pack?.scenes[state.activeIndex] ?? null);
}

export function decorateScene(scene) {
  if (!scene) return scene;
  const parsed = parseChoicerFields(`${scene.subtitle || ''}\n${scene.title || ''}`);
  if (!parsed?.caption) return scene;
  return {
    ...scene,
    character: parsed.character || scene.character,
    subtitle: parsed.caption,
    videoOffset: Number.isFinite(parsed.timestamps[0]) ? parsed.timestamps[0] : scene.videoOffset
  };
}

export function selectScene(index, { keepCapture = false } = {}) {
  const pack = currentPack();
  if (!pack?.scenes.length) return;
  if (!keepCapture) abortCapture({ keepPreview: state.previewing });
  state.activeIndex = Math.max(0, Math.min(index, pack.scenes.length - 1));
  const scene = currentScene();
  const take = pack.takes[scene.id];
  const counter = `Fala ${state.activeIndex + 1} de ${pack.scenes.length}`;
  const canGoPrev = state.activeIndex > 0;
  const canGoNext = state.activeIndex < pack.scenes.length - 1;

  els.topCounter.textContent = counter;
  els.counter.textContent = counter;
  els.projectTitle.textContent = pack.name;
  els.projectMeta.textContent = take ? `${counter} · gravado` : `${counter} · original`;
  if (els.sidePackTitle) els.sidePackTitle.textContent = pack.name;
  if (els.sideSceneTitle) els.sideSceneTitle.textContent = counter;
  els.character.textContent = scene.character;
  els.subtitle.textContent = scene.subtitle;
  els.frameCharacter.textContent = scene.character;
  els.frameSubtitle.textContent = scene.subtitle;
  els.overlayCharacter.textContent = scene.character;
  els.overlayText.textContent = scene.subtitle;
  els.durationLabel.textContent = scene.durationLabel;
  els.elapsedLabel.textContent = '00:00';
  els.timerValue.textContent = scene.duration.toFixed(1);
  els.micHint.textContent = take ? 'Toque no microfone para regravar' : 'Toque no microfone para começar';
  if (take?.peak != null) setVoiceMeter(take.peak, false);
  else if (els.voiceMeter) els.voiceMeter.hidden = true;
  if (els.recordingStatus) els.recordingStatus.textContent = take ? 'Gravado' : 'Pronto';
  els.videoProgress.style.width = '0%';
  if (els.wavePlayhead) els.wavePlayhead.style.left = '0%';
  els.stageState.textContent = take ? 'Take gravado' : 'Pronto para gravar';
  els.stageState.className = `stage-state ${take ? 'recorded' : ''}`;
  const canFinish = !canGoNext && packIsComplete(pack);
  els.nextBtn.disabled = !(canGoNext || canFinish);
  els.nextSceneBtn.disabled = !(canGoNext || canFinish);
  els.prevSceneBtn.disabled = !canGoPrev;
  els.nextBtn.textContent = canFinish ? 'Finalizar dublagem' : 'Próxima cena →';
  els.nextSceneBtn.textContent = canFinish ? 'Finalizar dublagem' : 'Próxima cena →';
  els.nextBtn.classList.toggle('pulse-next', (Boolean(take) && canGoNext) || canFinish);
  els.nextSceneBtn.classList.toggle('pulse-next', (Boolean(take) && canGoNext) || canFinish);
  els.previewBtn.disabled = !take;
  els.listenTakeBtn.disabled = !take;
  els.listenTakeBtn.classList.toggle('is-hidden', !take);
  els.previewHint.textContent = take
    ? 'Ouça seu take com o fundo da cena'
    : 'Grave este take para ouvir aqui';
  if (els.takeResult) els.takeResult.style.display = take ? 'flex' : 'none';
  if (els.takeAudio) els.takeAudio.src = take?.url ?? '';
  updateFinishCta(pack);
  if (els.timingHint) {
    els.timingHint.textContent = take
      ? timingMessage(scene, take)
      : 'Grave um take para medir duração contra a referência.';
  }
  updateTimingDesk(scene, take);
  if (take?.blob && take.onset == null) {
    profileTakeAudio(take.blob).then((profile) => {
      Object.assign(take, profile);
      if (currentScene()?.id === scene.id) {
        if (els.timingHint) els.timingHint.textContent = timingMessage(scene, take);
        updateTimingDesk(scene, take);
      }
    }).catch(() => undefined);
  }

  bindSceneVisual(scene);

  renderTakeRail();
  updateScoreCard();
  els.topbarHint.textContent = `${pack.name} · ${pack.scenes.filter((item) => pack.takes[item.id]).length}/${pack.scenes.length} gravadas`;
}

export function updateFinishCta(pack) {
  const done = packIsComplete(pack);
  const label = finishCtaLabel(pack);
  els.exportVideoBtn?.classList.toggle('is-hidden', !done);
  els.exportVideoBtn?.classList.toggle('pulse-next', done && !pack?.finalUrl);
  if (els.exportVideoBtn) {
    els.exportVideoBtn.disabled = false;
    els.exportVideoBtn.textContent = label;
  }
  if (els.generateMp4Btn) {
    els.generateMp4Btn.classList.toggle('is-hidden', !done);
    els.generateMp4Btn.disabled = false;
    els.generateMp4Btn.textContent = label;
  }
  if (done && isIOS()) void preloadFfmpeg();
}

export function goNextScene() {
  const pack = currentPack();
  const scene = currentScene();
  if (!pack || !scene) return;
  if (!pack.takes[scene.id]) {
    els.recordBtn.classList.add('attention');
    setTimeout(() => els.recordBtn.classList.remove('attention'), 900);
  }
  if (state.activeIndex >= pack.scenes.length - 1) {
    const finished = pack.scenes.every((item) => pack.takes[item.id]);
    if (finished) {
      setTab('dub');
      toast('Tudo gravado. Toque em Finalizar dublagem.');
    } else {
      toast('Última fala. Grave as que faltam para finalizar.');
    }
    return;
  }
  selectScene(state.activeIndex + 1);
}

export function packCover(pack) {
  const visual = pack.scenes.find((scene) => scene.imageUrl || scene.videoUrl);
  if (visual?.imageUrl) return { type: 'img', src: visual.imageUrl };
  if (visual?.videoUrl) return { type: 'video', src: visual.videoUrl };
  if (pack.filmUrl) return { type: 'video', src: pack.filmUrl };
  return { type: 'empty' };
}

export function renderPackGrid() {
  const packs = state.packs;
  els.packEmpty.classList.toggle('is-hidden', state.packs.length > 0);
  els.packGrid.replaceChildren();
  const tones = ['', 'tone-orange', 'tone-violet'];
  packs.forEach((pack, index) => {
    const recorded = pack.scenes.filter((scene) => pack.takes[scene.id]).length;
    const percent = pack.scenes.length ? Math.round((recorded / pack.scenes.length) * 100) : 0;
    const card = document.createElement('article');
    card.className = `pack-card ${tones[index % 3]}${pack.id === state.activePackId ? ' active' : ''}`.trim();
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'pack-delete';
    deleteBtn.type = 'button';
    deleteBtn.setAttribute('aria-label', `Apagar ${pack.name}`);
    deleteBtn.title = 'Apagar pack';
    deleteBtn.textContent = '✕';
    deleteBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      deletePack(pack.id);
    });
    const preview = document.createElement('div');
    preview.className = 'pack-preview';
    const cover = packCover(pack);
    if (cover.type === 'img') {
      const img = document.createElement('img');
      img.src = cover.src;
      img.alt = '';
      preview.append(img);
    } else if (cover.type === 'video') {
      const video = document.createElement('video');
      video.src = cover.src;
      video.muted = true;
      video.playsInline = true;
      video.preload = 'metadata';
      preview.append(video);
    } else {
      preview.classList.add('is-empty');
      preview.textContent = '🎙';
    }
    const title = document.createElement('h3');
    title.textContent = pack.name;
    const subtitle = document.createElement('p');
    subtitle.textContent = `${pack.scenes.length} ${pack.scenes.length === 1 ? 'cena' : 'cenas'} · ${recorded} ${recorded === 1 ? 'dublada' : 'dubladas'}`;
    const progress = document.createElement('div');
    progress.className = 'progress-line';
    const bar = document.createElement('i');
    bar.style.width = `${percent}%`;
    progress.append(bar);
    const button = document.createElement('button');
    button.className = 'primary wide';
    button.type = 'button';
    button.textContent = recorded ? '▷ Continuar' : '▷ Começar';
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      openPack(pack.id);
    });
    card.addEventListener('click', () => openPack(pack.id));
    card.append(deleteBtn, preview, title, subtitle, progress, button);
    els.packGrid.append(card);
  });
  if (els.packRailNext) {
    els.packRailNext.hidden = packs.length < 3;
  }
  renderActivity();
}

export function openPack(id) {
  const pack = state.packs.find((item) => item.id === id);
  if (pack && packIsExpired(pack)) {
    pruneExpiredPacks();
    toast('Este pack expirou depois de 2 dias. Importe o ZIP de novo.');
    return;
  }
  state.activePackId = id;
  state.activeIndex = 0;
  renderPackGrid();
  selectScene(0);
  setTab('record');
}

export function deletePack(id) {
  const pack = state.packs.find((item) => item.id === id);
  if (!pack) return;
  const ok = confirm(`Apagar “${pack.name}”?\n\nTakes e exportação serão removidos deste aparelho.`);
  if (!ok) return;

  abortCapture();
  stopActivePlayback();
  if (state.previewing) stopProjectPreview();
  revokePackMedia(pack);

  const wasActive = state.activePackId === id;
  const packName = pack.name;
  state.packs = state.packs.filter((item) => item.id !== id);

  if (wasActive) {
    state.activePackId = state.packs[0]?.id || null;
    state.activeIndex = 0;
  }

  scheduleSave();
  renderPackGrid();
  updateScoreCard();
  showFinalVideo(currentPack());

  if (wasActive) {
    if (currentPack()) {
      selectScene(0);
      setTab('record');
    } else {
      setTab('packs');
    }
  }

  toast(`Pack “${packName}” apagado.`);
}

export function revokePackMedia(pack) {
  const seen = new Set();
  const drop = (url) => {
    if (!url || seen.has(url)) return;
    seen.add(url);
    forgetUrl(url);
  };
  pack.scenes.forEach((scene) => {
    drop(scene.audioUrl);
    drop(scene.imageUrl);
    drop(scene.videoUrl);
  });
  Object.values(pack.takes).forEach((take) => drop(take.url));
  drop(pack.filmUrl);
  drop(pack.backingUrl);
  drop(pack.finalUrl);
}

export function showFinalVideo(pack) {
  const has = Boolean(pack?.finalUrl);
  const isMp4 = pack?.finalExt === 'mp4' || pack?.finalBlob?.type?.includes('mp4');
  if (els.finalVideo) {
    els.finalVideo.loop = false;
    els.finalVideo.muted = false;
    els.finalVideo.controls = true;
    els.finalVideo.src = pack?.finalUrl || '';
    if (has) els.finalVideo.load();
  }
  if (els.finalVideoEmpty) els.finalVideoEmpty.style.display = has ? 'none' : 'grid';
  if (els.downloadMp4Btn) {
    els.downloadMp4Btn.classList.toggle('is-hidden', !has);
    els.downloadMp4Btn.textContent = isMp4 ? t('dub.download.mp4') : t('dub.download.webm');
  }
  if (els.exportStatus && has) {
    els.exportStatus.textContent = pack.watermarked
      ? (isMp4
        ? t('export.ready.watermark', { brand: EXPORT_WATERMARK_LABEL })
        : t('export.ready.watermark.webm', { brand: EXPORT_WATERMARK_LABEL }))
      : (isMp4 ? t('export.ready') : t('export.ready.webm'));
  } else if (els.exportStatus && !has) {
    els.exportStatus.textContent = t('dub.status.none');
  }
  updateFinishCta(pack);
}
