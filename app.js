const AUDIO_EXTS = ['mp3', 'wav', 'ogg', 'm4a'];
const IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'webp', 'gif'];
const VIDEO_EXTS = ['mp4', 'mov', 'webm', 'ogv', 'm4v'];
const MAX_LINE_SECONDS = 600;
const GUIDE_VOLUME = 0.08;
const BED_VOLUME = 0.14;
const BED_EXPORT = 0.4;
const BED_DUCK = 0.09;
const TAKE_PEAK_TARGET = 0.62;
const PACK_TTL_MS = 2 * 24 * 60 * 60 * 1000;
const SESSION_USER_KEY = 'dubpack-user';
const USERS_KEY = 'dubpack-users';
const OWNER_CLAIM_CODE = 'DUBPACK-OWNER';
const OWNER_EMAILS = [
  'viniciusleme@gmail.com',
  'vinicius.leme@gmail.com',
  'vineleme@gmail.com'
];

const state = {
  packs: [],
  activePackId: null,
  activeIndex: 0,
  recorder: null,
  chunks: [],
  liveStream: null,
  meterStream: null,
  recordStream: null,
  recordPeak: 0,
  analyser: null,
  audioContext: null,
  meterRaf: 0,
  ignoreRecorderStop: false,
  countdownTimer: null,
  countdownStartTimer: null,
  recordingTimer: null,
  recordStopTimer: null,
  progressTimer: null,
  playbackTimer: null,
  videoTimer: null,
  activeAudio: null,
  activeAudios: [],
  previewing: false,
  previewGen: 0,
  toastTimer: null,
  saveTimer: null,
  objectUrls: [],
  ffmpeg: null,
  exporting: false,
  user: null
};

const els = {
  packInput: document.querySelector('#packInput'),
  packInputEmpty: document.querySelector('#packInputEmpty'),
  packGrid: document.querySelector('#packGrid'),
  packEmpty: document.querySelector('#packEmpty'),
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
  elapsedLabel: document.querySelector('#elapsedLabel'),
  durationLabel: document.querySelector('#durationLabel'),
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
  stopPreviewBtn: document.querySelector('#stopPreviewBtn'),
  listenTakeBtn: document.querySelector('#listenTakeBtn'),
  exportVideoBtn: document.querySelector('#exportVideoBtn'),
  exportVideoBtnSide: document.querySelector('#exportVideoBtnSide'),
  exportVideoBtnAlt: document.querySelector('#exportVideoBtnAlt'),
  recordingStatus: document.querySelector('#recordingStatus'),
  localTakes: document.querySelector('#localTakes'),
  sequenceCard: document.querySelector('#sequenceCard'),
  sidePackTitle: document.querySelector('#sidePackTitle'),
  sideSceneTitle: document.querySelector('#sideSceneTitle'),
  welcomeTitle: document.querySelector('#welcomeTitle'),
  userChipName: document.querySelector('#userChipName'),
  userChipRole: document.querySelector('#userChipRole'),
  profileName: document.querySelector('#profileName'),
  profileMeta: document.querySelector('#profileMeta'),
  authGate: document.querySelector('#authGate'),
  authForm: document.querySelector('#authForm'),
  authName: document.querySelector('#authName'),
  authEmail: document.querySelector('#authEmail'),
  authPassword: document.querySelector('#authPassword'),
  authOwnerCode: document.querySelector('#authOwnerCode'),
  logoutBtn: document.querySelector('#logoutBtn'),
  landingPage: document.querySelector('#landingPage'),
  studioApp: document.querySelector('#studioApp'),
  landingEnterBtn: document.querySelector('#landingEnterBtn'),
  landingEnterBtn2: document.querySelector('#landingEnterBtn2'),
  landingStartBtn: document.querySelector('#landingStartBtn'),
  landingDemo: document.querySelector('#landingDemo'),
  landingDemoHint: document.querySelector('#landingDemoHint'),
  authCloseBtn: document.querySelector('#authCloseBtn'),
  takeRail: document.querySelector('#takeRail'),
  wavePlayhead: document.querySelector('#wavePlayhead'),
  waveStartLabel: document.querySelector('#waveStartLabel'),
  waveEndLabel: document.querySelector('#waveEndLabel'),
  timingRefBar: document.querySelector('#timingRefBar'),
  timingTakeBar: document.querySelector('#timingTakeBar'),
  timingLabels: [...document.querySelectorAll('.timing-labels span')],
  timingHint: document.querySelector('#timingHint'),
  scoreAverage: document.querySelector('#scoreAverage'),
  scoreCaption: document.querySelector('#scoreCaption'),
  scoreCoverage: document.querySelector('#scoreCoverage'),
  scoreDuration: document.querySelector('#scoreDuration'),
  scoreOnTime: document.querySelector('#scoreOnTime'),
  scorePack: document.querySelector('#scorePack'),
  topbarHint: document.querySelector('#topbarHint'),
  appToast: document.querySelector('#appToast'),
  helpModal: document.querySelector('#helpModal'),
  helpBtn: document.querySelector('#helpBtn'),
  helpCloseBtn: document.querySelector('#helpCloseBtn'),
  proBtn: document.querySelector('#proBtn'),
  waveformBars: [...document.querySelectorAll('.hero-waveform i')],
  micBars: [...document.querySelectorAll('.mic-level span')],
  voiceMeter: document.querySelector('#voiceMeter'),
  voiceMeterFill: document.querySelector('#voiceMeterFill'),
  voiceMeterHint: document.querySelector('#voiceMeterHint'),
  generateMp4Btn: document.querySelector('#generateMp4Btn'),
  finalVideo: document.querySelector('#finalVideo'),
  finalVideoWrap: document.querySelector('#finalVideoWrap'),
  exportFilm: document.querySelector('#exportFilm'),
  finalVideoEmpty: document.querySelector('#finalVideoEmpty'),
  downloadMp4Btn: document.querySelector('#downloadMp4Btn'),
  exportStatus: document.querySelector('#exportStatus'),
  exportProgressWrap: document.querySelector('#exportProgressWrap'),
  exportProgressBar: document.querySelector('#exportProgressBar'),
  exportProgressLabel: document.querySelector('#exportProgressLabel'),
  activityList: document.querySelector('#activityList'),
  creditShop: document.querySelector('#creditShop'),
  creditBadge: document.querySelector('#creditBadge'),
  creditsBalance: document.querySelector('#creditsBalance'),
  profileCredits: document.querySelector('#profileCredits'),
  bellBtn: document.querySelector('#bellBtn')
};

bindUi();
bootApp();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => undefined);
}

function bindUi() {
  els.packInput.addEventListener('change', importPack);
  els.packInputEmpty.addEventListener('change', importPack);
  els.prevBtn.addEventListener('click', () => setTab('packs'));
  els.prevSceneBtn.addEventListener('click', () => selectScene(state.activeIndex - 1));
  els.nextSceneBtn.addEventListener('click', goNextScene);
  els.nextBtn.addEventListener('click', goNextScene);
  els.referenceBtn.addEventListener('click', playReference);
  els.referenceBtnBottom?.addEventListener('click', playReference);
  els.recordBtn.addEventListener('click', startTakeFlow);
  els.downloadTakeBtn?.addEventListener('click', downloadTake);
  els.previewBtn.addEventListener('click', playCurrentTake);
  els.listenTakeBtn.addEventListener('click', playCurrentTake);
  els.previewBtnAlt?.addEventListener('click', playProjectPreview);
  els.stopPreviewBtn?.addEventListener('click', stopProjectPreview);
  els.exportVideoBtn.addEventListener('click', requestFinalMp4);
  els.exportVideoBtnSide?.addEventListener('click', requestFinalMp4);
  els.generateMp4Btn?.addEventListener('click', requestFinalMp4);
  els.helpBtn.addEventListener('click', () => els.helpModal.classList.remove('is-hidden'));
  els.helpCloseBtn.addEventListener('click', () => els.helpModal.classList.add('is-hidden'));
  els.helpModal.addEventListener('click', (event) => {
    if (event.target === els.helpModal) els.helpModal.classList.add('is-hidden');
  });
  els.proBtn.addEventListener('click', () => setTab('credits'));
  els.bellBtn?.addEventListener('click', () => setTab('credits'));
  els.logoutBtn?.addEventListener('click', logoutUser);
  els.authForm?.addEventListener('submit', submitAuth);
  els.authCloseBtn?.addEventListener('click', () => showAuthGate(false));
  els.authGate?.addEventListener('click', (event) => {
    if (event.target === els.authGate) showAuthGate(false);
  });
  [els.landingEnterBtn, els.landingEnterBtn2, els.landingStartBtn].forEach((button) => {
    button?.addEventListener('click', () => showAuthGate(true));
  });
  els.landingDemo?.addEventListener('loadeddata', () => {
    if (els.landingDemo.videoWidth) els.landingDemoHint?.classList.add('is-hidden');
  });

  document.querySelectorAll('[data-tab]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.preventDefault();
      setTab(button.dataset.tab);
    });
  });
}

async function bootApp() {
  state.user = readSessionUser();
  if (!state.user) {
    showStudio(false);
    showAuthGate(false);
    renderCreditShop();
    return;
  }
  showAuthGate(false);
  showStudio(true);
  refreshAccountUi();
  try {
    await restoreSession();
  } catch {
    renderPackGrid();
  }
  pruneExpiredPacks();
  renderCreditShop();
  updateCreditUi();
  renderActivity();
  showFinalVideo(currentPack());
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function readUsers() {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY) || '{}');
  } catch {
    return {};
  }
}

function writeUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function readSessionUser() {
  try {
    const user = JSON.parse(localStorage.getItem(SESSION_USER_KEY) || 'null');
    return user?.email ? user : null;
  } catch {
    return null;
  }
}

function isOwner(user = state.user) {
  const email = normalizeEmail(user?.email);
  if (!email) return false;
  if (user?.owner) return true;
  return OWNER_EMAILS.includes(email);
}

function showAuthGate(on) {
  els.authGate?.classList.toggle('is-hidden', !on);
}

function showStudio(on) {
  els.landingPage?.classList.toggle('is-hidden', on);
  els.studioApp?.classList.toggle('is-hidden', !on);
  document.body.classList.toggle('in-studio', on);
}

function refreshAccountUi() {
  const user = state.user;
  const first = String(user?.name || 'dublador').split(' ')[0];
  const owner = isOwner(user);
  if (els.welcomeTitle) els.welcomeTitle.textContent = `Bem-vindo de volta, ${first}!`;
  if (els.userChipName) els.userChipName.textContent = user?.name || 'Conta';
  if (els.userChipRole) els.userChipRole.textContent = owner ? 'Dono' : 'Pro';
  if (els.profileName) els.profileName.textContent = user?.name || 'Conta';
  if (els.profileMeta) {
    els.profileMeta.textContent = owner
      ? `${user.email} · dono do estúdio · créditos infinitos`
      : `${user?.email || ''} · packs duram 2 dias nesta conta`;
  }
  updateCreditUi();
}

function finishLogin(account) {
  state.user = {
    name: account.name,
    email: account.email,
    owner: Boolean(account.owner)
  };
  localStorage.setItem(SESSION_USER_KEY, JSON.stringify(state.user));
  showAuthGate(false);
  showStudio(true);
  refreshAccountUi();
  toast(isOwner() ? 'Conta de dono ativa. Créditos infinitos.' : 'Conta pronta. Packs duram 2 dias.');
  state.packs = [];
  restoreSession().then(() => {
    pruneExpiredPacks();
    renderCreditShop();
    updateCreditUi();
    renderActivity();
  }).catch(() => renderPackGrid());
}

function submitAuth(event) {
  event.preventDefault();
  const email = normalizeEmail(els.authEmail?.value);
  let name = String(els.authName?.value || '').trim();
  let password = String(els.authPassword?.value || '');
  let ownerCode = String(els.authOwnerCode?.value || '').trim();
  if (password === OWNER_CLAIM_CODE) ownerCode = OWNER_CLAIM_CODE;
  if (!email) {
    toast('Informe o e-mail.');
    return;
  }
  const users = readUsers();
  const existing = users[email];
  const claimOwner = ownerCode === OWNER_CLAIM_CODE || OWNER_EMAILS.includes(email);

  if (claimOwner) {
    const account = {
      ...(existing || {}),
      name: name || existing?.name || email.split('@')[0],
      email,
      password: existing?.password && existing.password !== OWNER_CLAIM_CODE
        ? existing.password
        : (password && password !== OWNER_CLAIM_CODE ? password : existing?.password || OWNER_CLAIM_CODE),
      owner: true,
      createdAt: existing?.createdAt || new Date().toISOString()
    };
    users[email] = account;
    writeUsers(users);
    finishLogin(account);
    return;
  }

  if (existing) {
    if (existing.password !== password) {
      toast('Senha não confere. Se for o dono, use o código do estúdio.');
      return;
    }
    finishLogin(existing);
    return;
  }

  if (!name || password.length < 4) {
    toast('Para criar conta: nome, e-mail e senha com pelo menos 4 caracteres.');
    return;
  }
  const created = {
    name,
    email,
    password,
    owner: false,
    createdAt: new Date().toISOString()
  };
  users[email] = created;
  writeUsers(users);
  localStorage.setItem(`dubpack-credits:${email}`, '1');
  finishLogin(created);
}

function logoutUser() {
  localStorage.removeItem(SESSION_USER_KEY);
  state.user = null;
  state.packs = [];
  state.activePackId = null;
  showAuthGate(false);
  showStudio(false);
  toast('Você saiu. Até a próxima dublagem.');
}

function packExpiresAt(pack) {
  return (Number(pack?.importedAt) || 0) + PACK_TTL_MS;
}

function packIsExpired(pack) {
  return Date.now() > packExpiresAt(pack);
}

function remainingLabel(pack) {
  const ms = packExpiresAt(pack) - Date.now();
  if (ms <= 0) return 'Expirou';
  const hours = Math.ceil(ms / 36e5);
  if (hours < 24) return `Expira em ${hours}h`;
  return `Expira em ${Math.ceil(hours / 24)}d`;
}

function pruneExpiredPacks() {
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

function sessionStoreKey() {
  const email = normalizeEmail(state.user?.email);
  return email ? `user:${email}` : 'current';
}

async function importPack(event) {
  if (!state.user) {
    showAuthGate(true);
    toast('Crie sua conta para importar um pack.');
    return;
  }
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) return;

  try {
    const zipBytes = new Uint8Array(await file.arrayBuffer());
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
    const count = pack.scenes.length;
    toast(`${count} ${count === 1 ? 'fala' : 'falas'} em “${pack.name}”.`);
  } catch (error) {
    toast(error.message || 'Não foi possível abrir este ZIP.');
  }
}

async function buildPack(name, zipBytes) {
  let files;
  try {
    files = fflate.unzipSync(zipBytes);
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
    const url = rememberUrl(URL.createObjectURL(new Blob([entry.data], { type: mimeFor(entry.ext) })));
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
    const sharedUrl = sharedVideo ? objectUrl(sharedVideo) : '';
    const firstVideo = videos[0] ? objectUrl(videos[0]) : '';
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

function upsertPack(pack) {
  const existing = state.packs.findIndex((item) => item.name.toLowerCase() === pack.name.toLowerCase());
  if (existing >= 0) {
    revokePackMedia(state.packs[existing]);
    pack.id = state.packs[existing].id;
    state.packs[existing] = pack;
    return;
  }
  state.packs.push(pack);
}

function currentPack() {
  return state.packs.find((pack) => pack.id === state.activePackId) ?? null;
}

function currentScene() {
  const pack = currentPack();
  return decorateScene(pack?.scenes[state.activeIndex] ?? null);
}

function decorateScene(scene) {
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

function setTab(tab) {
  if (!state.user) {
    showStudio(false);
    showAuthGate(true);
    return;
  }
  if ((tab === 'record' || tab === 'dub') && !currentPack()) {
    toast('Importe um pack para gravar.');
    tab = 'packs';
  }
  document.querySelectorAll('.tab-view').forEach((view) => view.classList.remove('active'));
  document.querySelector(`#${tab}Tab`)?.classList.add('active');
  document.querySelectorAll('[data-tab]').forEach((button) => {
    button.classList.toggle('active', button.dataset.tab === tab);
  });
  document.querySelector('.dashboard')?.classList.toggle('final-mode', tab === 'dub');
  if (tab === 'record' && !state.previewing) selectScene(state.activeIndex);
  if (tab === 'dub') showFinalVideo(currentPack());
  if (tab === 'credits' || tab === 'profile') updateCreditUi();
  if (tab === 'packs') renderActivity();
}

function selectScene(index) {
  const pack = currentPack();
  if (!pack?.scenes.length) return;
  abortCapture({ keepPreview: state.previewing });
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

function packIsComplete(pack) {
  return Boolean(pack?.scenes.length && pack.scenes.every((scene) => pack.takes[scene.id]));
}

function finishCtaLabel(pack) {
  return pack?.finalUrl ? 'Gerar de novo' : 'Finalizar dublagem';
}

function updateFinishCta(pack) {
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
}

function goNextScene() {
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

function playReference() {
  const scene = currentScene();
  if (!scene?.audioUrl) {
    toast('Importe um pack para ouvir a referência.');
    return;
  }
  playTimedAudio(scene.audioUrl, scene.duration);
  playSceneMedia(scene, scene.duration);
  animateProgress(scene.duration);
}

async function startTakeFlow() {
  const scene = currentScene();
  if (!scene) {
    toast('Importe um pack para gravar.');
    return;
  }
  if (state.previewing) stopProjectPreview();
  if (state.countdownTimer || state.countdownStartTimer) {
    abortCapture();
    selectScene(state.activeIndex);
    toast('Countdown cancelado.');
    return;
  }
  if (state.recorder?.state === 'recording') {
    try {
      state.recorder.requestData();
    } catch {
      // ignore
    }
    state.recorder.stop();
    return;
  }

  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1
      }
    });
  } catch {
    toast('Permita o microfone no navegador para gravar.');
    return;
  }

  state.liveStream = stream;
  stream.getAudioTracks().forEach((track) => {
    track.enabled = true;
  });
  els.countdownBadge.style.display = 'grid';
  els.recordingOverlay.style.display = 'grid';
  els.stageState.textContent = 'Prepare a fala...';
  els.stageState.className = 'stage-state recording';
  els.recordBtn.classList.add('recording');
  els.micHint.textContent = 'Toque de novo para cancelar';
  if (els.recordingStatus) els.recordingStatus.textContent = 'Preparando';

  let count = 3;
  els.countdownBadge.textContent = String(count);
  els.timerValue.textContent = String(count);
  state.countdownTimer = setInterval(() => {
    count -= 1;
    els.countdownBadge.textContent = count === 0 ? 'DUBLE!' : String(count);
    els.timerValue.textContent = String(Math.max(0, count));
    if (count <= 0) {
      clearInterval(state.countdownTimer);
      state.countdownTimer = null;
      state.countdownStartTimer = setTimeout(() => {
        state.countdownStartTimer = null;
        recordActiveScene();
      }, 220);
    }
  }, 1000);
}

function isPhone() {
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    || window.matchMedia('(pointer: coarse)').matches;
}

function recordActiveScene() {
  const scene = currentScene();
  const stream = state.liveStream;
  if (!scene || !stream) return;

  const mimeType = pickRecorderMime();
  state.chunks = [];
  state.recordPeak = 0;
  state.ignoreRecorderStop = false;
  try {
    state.recorder = mimeType
      ? new MediaRecorder(stream, isPhone() ? { mimeType } : { mimeType, audioBitsPerSecond: 128000 })
      : new MediaRecorder(stream);
  } catch {
    state.recorder = new MediaRecorder(stream);
  }
  const startedAt = Date.now();
  const recMs = Math.round(Math.max(1.6, Number(scene.duration) || 2) * 1000);

  state.recorder.ondataavailable = (event) => {
    if (event.data?.size) state.chunks.push(event.data);
  };
  state.recorder.onstop = async () => {
    await wait(180);
    const elapsed = (Date.now() - startedAt) / 1000;
    const livePeak = state.recordPeak;
    stopStream();
    stopMeter();
    const discarded = state.ignoreRecorderStop;
    state.ignoreRecorderStop = false;
    state.recorder = null;
    if (discarded) return;

    const pack = currentPack();
    if (!pack) return;
    const blob = new Blob(state.chunks, { type: state.chunks[0]?.type || mimeType || 'audio/webm' });
    if (blob.size < 400) {
      toast('Essa fala não gravou o áudio. Toque no microfone e fale de novo, sem o filme tocando.');
      selectScene(state.activeIndex);
      return;
    }
    let decodedPeak = 0;
    let decoded = false;
    try {
      decodedPeak = await measureBlobPeak(blob);
      decoded = true;
    } catch {
      decodedPeak = 0;
    }
    const profile = await profileTakeAudio(blob).catch(() => ({}));
    const voicePeak = Math.max(livePeak, decodedPeak, profile.peak || 0);
    if (pack.takes[scene.id]?.url) URL.revokeObjectURL(pack.takes[scene.id].url);
    const url = rememberUrl(URL.createObjectURL(blob));
    pack.takes[scene.id] = {
      url,
      blob,
      character: scene.character,
      subtitle: scene.subtitle,
      createdAt: new Date().toISOString(),
      duration: elapsed,
      ext: blob.type.includes('mp4') ? 'm4a' : 'webm',
      peak: voicePeak,
      onset: profile.onset,
      release: profile.release,
      voiced: profile.voiced
    };
    selectScene(state.activeIndex);
    scheduleSave();
    if (voicePeak < 0.14) {
      toast('Volume baixo. Fale mais perto do microfone e grave de novo.');
    } else if (voicePeak > 0.78) {
      toast('Um pouco alto. Afaste um pouco o microfone.');
    } else {
      toast('Take gravado. Volume bom para a dublagem.');
    }
    setVoiceMeter(voicePeak, false);
    const finished = pack.scenes.every((item) => pack.takes[item.id]);
    if (finished) {
      toast('Pack concluído. Toque em Finalizar dublagem.');
    }
  };

  els.countdownBadge.style.display = 'none';
  els.recordingOverlay.style.display = 'grid';
  els.stageState.textContent = 'Gravando take...';
  els.stageState.className = 'stage-state recording';
  els.recordBtn.classList.add('recording');
  els.micHint.textContent = 'Fale agora · o filme fica parado nesta fala';
  if (els.recordingStatus) els.recordingStatus.textContent = 'Gravando';
  els.sceneVideo?.pause();
  animateProgress(recMs / 1000);

  state.recordingTimer = setInterval(() => {
    const remaining = Math.max(0, (recMs / 1000) - ((Date.now() - startedAt) / 1000));
    els.timerValue.textContent = remaining.toFixed(1);
  }, 100);

  try {
    state.recorder.start();
  } catch {
    state.recorder.start(250);
  }
  state.recordStopTimer = setTimeout(() => {
    if (state.recorder?.state === 'recording') {
      try {
        state.recorder.requestData();
      } catch {
        // Alguns browsers só entregam o áudio no stop.
      }
      state.recorder.stop();
    }
  }, recMs);
}

async function playProjectPreview() {
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
    if (take) {
      playLayers([
        { url: take.url, volume: 1 },
        { url: scene.audioUrl, volume: BED_VOLUME }
      ], scene.duration);
    } else {
      playTimedAudio(scene.audioUrl, scene.duration);
    }
    await wait((scene.duration * 1000) + 180);
  }

  if (state.previewGen === gen) stopProjectPreview();
}

function stopProjectPreview() {
  state.previewing = false;
  state.previewGen += 1;
  els.previewBtnAlt && (els.previewBtnAlt.textContent = '▶ Assistir resultado');
  els.stopPreviewBtn?.classList.add('is-hidden');
  abortCapture();
}

function playCurrentTake() {
  const pack = currentPack();
  const scene = currentScene();
  const take = scene ? pack?.takes[scene.id] : null;
  if (!scene || !take) {
    els.previewHint.textContent = 'Grave este take primeiro';
    return;
  }
  playLayers([
    { url: take.url, volume: 1 },
    { url: scene.audioUrl, volume: BED_VOLUME }
  ], scene.duration);
  playSceneMedia(scene, scene.duration);
  animateProgress(scene.duration);
}

function bindSceneVisual(scene) {
  const video = els.sceneVideo;
  const image = els.sceneImage;
  const empty = els.emptyFrame;
  if (!video || !image || !empty) return;

  if (scene.imageUrl) {
    video.pause();
    video.style.display = 'none';
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
    video.style.display = 'block';
    video.muted = true;
    video.playsInline = true;
    if (video.src !== scene.videoUrl) video.src = scene.videoUrl;
    showSceneStill(scene);
    return;
  }

  video.pause();
  if (video.src) video.removeAttribute('src');
  video.style.display = 'none';
  image.style.display = 'none';
  paintEmptyScene(scene);
}

function playSceneMedia(scene, duration) {
  if (scene.imageUrl && els.sceneImage) {
    els.sceneImage.style.display = 'block';
    if (els.sceneVideo) els.sceneVideo.style.display = 'none';
    return;
  }
  if (!scene.videoUrl || !els.sceneVideo) return;
  const video = els.sceneVideo;
  video.muted = true;
  video.playsInline = true;
  video.style.display = 'block';
  const start = Number(scene.videoOffset) || 0;
  try {
    video.currentTime = start;
  } catch {
    // ignore
  }
  video.play().catch(() => undefined);
  clearTimeout(state.videoTimer);
  state.videoTimer = setTimeout(() => {
    video.pause();
    showSceneStill(scene);
  }, duration * 1000);
}

function showSceneStill(scene) {
  const video = els.sceneVideo;
  if (!video || !scene.videoUrl) return;
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
}

function paintEmptyScene(scene) {
  const empty = els.emptyFrame;
  empty.replaceChildren();
  const kicker = document.createElement('small');
  kicker.textContent = 'Cena desta fala';
  const title = document.createElement('strong');
  title.textContent = scene.character || 'Pack';
  empty.append(kicker, title);
  empty.style.display = 'grid';
}

function playTimedAudio(url, duration, volume = 1) {
  playLayers([{ url, volume }], duration);
}

function playLayers(layers, duration) {
  stopActivePlayback();
  state.activeAudios = layers.filter((layer) => layer.url).map((layer) => {
    const audio = new Audio(layer.url);
    audio.volume = layer.volume;
    audio.play().catch(() => undefined);
    return audio;
  });
  state.activeAudio = state.activeAudios[0] || null;
  clearTimeout(state.playbackTimer);
  state.playbackTimer = setTimeout(stopActivePlayback, duration * 1000);
}

function stopActivePlayback() {
  clearTimeout(state.playbackTimer);
  state.playbackTimer = null;
  const list = state.activeAudios?.length
    ? state.activeAudios
    : (state.activeAudio ? [state.activeAudio] : []);
  list.forEach((audio) => {
    audio.pause();
    audio.currentTime = 0;
  });
  state.activeAudios = [];
  state.activeAudio = null;
}

function animateProgress(duration) {
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

function downloadTake() {
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

async function exportTakesZip() {
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

function renderPackGrid() {
  const packs = state.packs;
  els.packEmpty.classList.toggle('is-hidden', state.packs.length > 0);
  els.packGrid.replaceChildren();
  packs.forEach((pack) => {
    const recorded = pack.scenes.filter((scene) => pack.takes[scene.id]).length;
    const percent = pack.scenes.length ? Math.round((recorded / pack.scenes.length) * 100) : 0;
    const card = document.createElement('article');
    card.className = `pack-card${pack.id === state.activePackId ? ' active' : ''}`;
    const preview = document.createElement('div');
    preview.className = 'pack-preview';
    const visual = pack.scenes.find((scene) => scene.imageUrl || scene.videoUrl);
    if (visual?.imageUrl) {
      const img = document.createElement('img');
      img.src = visual.imageUrl;
      img.alt = '';
      preview.append(img);
    }
    const play = document.createElement('button');
    play.type = 'button';
    play.textContent = '▷';
    play.addEventListener('click', (event) => {
      event.stopPropagation();
      openPack(pack.id);
      playReference();
    });
    const label = document.createElement('span');
    label.textContent = 'PRÉVIA DO PACK';
    preview.append(play, label);
    const title = document.createElement('h3');
    title.textContent = pack.name;
    const subtitle = document.createElement('p');
    subtitle.textContent = `${pack.scenes.length} ${pack.scenes.length === 1 ? 'fala' : 'falas'} · ${recorded} gravadas · ${remainingLabel(pack)}`;
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
    card.append(preview, title, subtitle, progress, button);
    els.packGrid.append(card);
  });
  renderActivity();
}

function openPack(id) {
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

function renderTakeRail() {
  if (!els.takeRail) return;
  const pack = currentPack();
  els.takeRail.replaceChildren();
  if (!pack) return;
  pack.scenes.forEach((scene, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'rail-dot';
    button.classList.toggle('is-active', index === state.activeIndex);
    button.classList.toggle('is-recorded', Boolean(pack.takes[scene.id]));
    button.title = scene.subtitle;
    button.textContent = String(index + 1);
    button.addEventListener('click', () => selectScene(index));
    els.takeRail.append(button);
  });
}

function renderLocalTakes() {
  if (!els.localTakes) return;
  const pack = currentPack();
  els.localTakes.replaceChildren();
  if (!pack) {
    els.localTakes.append(takePlaceholder('Importe um pack para ver os takes.'));
    return;
  }
  const takes = Object.entries(pack.takes);
  if (!takes.length) {
    els.localTakes.append(takePlaceholder('Nenhum take gravado ainda.'));
    return;
  }
  takes.forEach(([id, take]) => {
    const sceneIndex = pack.scenes.findIndex((scene) => scene.id === id);
    const card = document.createElement('div');
    card.className = 'take-card';
    const title = document.createElement('strong');
    title.textContent = `Fala ${sceneIndex + 1} · ${take.character}`;
    const line = document.createElement('p');
    line.textContent = take.subtitle;
    const audio = document.createElement('audio');
    audio.controls = true;
    audio.src = take.url;
    card.append(title, line, audio);
    els.localTakes.append(card);
  });
}

function takePlaceholder(text) {
  const card = document.createElement('div');
  card.className = 'take-card';
  card.textContent = text;
  return card;
}

function abortCapture({ keepPreview = false } = {}) {
  clearInterval(state.countdownTimer);
  clearTimeout(state.countdownStartTimer);
  clearInterval(state.recordingTimer);
  clearTimeout(state.recordStopTimer);
  clearInterval(state.progressTimer);
  clearTimeout(state.playbackTimer);
  clearTimeout(state.videoTimer);
  state.countdownTimer = null;
  state.countdownStartTimer = null;
  state.recordingTimer = null;
  state.recordStopTimer = null;
  state.progressTimer = null;
  state.playbackTimer = null;
  state.videoTimer = null;
  els.countdownBadge.style.display = 'none';
  els.recordingOverlay.style.display = 'none';
  els.recordBtn.classList.remove('recording');
  stopActivePlayback();
  if (els.sceneVideo) els.sceneVideo.pause();
  if (state.recorder?.state === 'recording') {
    state.ignoreRecorderStop = true;
    state.recorder.stop();
  } else if (!state.recorder) {
    stopStream();
    stopMeter();
  }
  if (!keepPreview) {
    state.previewing = false;
    if (els.previewBtnAlt) els.previewBtnAlt.textContent = '▶ Assistir resultado';
    els.stopPreviewBtn?.classList.add('is-hidden');
  }
}

function stopStream() {
  state.liveStream?.getTracks().forEach((track) => track.stop());
  if (state.meterStream && state.meterStream !== state.liveStream) {
    state.meterStream.getTracks().forEach((track) => track.stop());
  }
  state.liveStream = null;
  state.meterStream = null;
}

function voiceLevelFromPeak(peak) {
  const n = Number(peak) || 0;
  if (n < 0.14) return { id: 'low', hint: 'Fale mais perto do microfone' };
  if (n > 0.78) return { id: 'high', hint: 'Um pouco alto — afaste um pouco' };
  return { id: 'good', hint: 'Volume bom para a dublagem' };
}

function setVoiceMeter(peak, live) {
  const level = voiceLevelFromPeak(peak);
  if (els.voiceMeter) {
    els.voiceMeter.hidden = false;
    els.voiceMeter.classList.remove('is-low', 'is-good', 'is-high');
    els.voiceMeter.classList.add(`is-${level.id}`);
  }
  if (els.voiceMeterFill) {
    els.voiceMeterFill.style.width = `${Math.max(8, Math.min(100, Math.round((Number(peak) || 0) * 135)))}%`;
  }
  if (els.voiceMeterHint) {
    els.voiceMeterHint.textContent = live && level.id === 'good' ? 'Pode falar neste volume' : level.hint;
  }
}

function bufferPeak(buffer) {
  let peak = 0;
  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < data.length; i += 1) peak = Math.max(peak, Math.abs(data[i]));
  }
  return peak;
}

function gainForTake(buffer) {
  const peak = bufferPeak(buffer);
  if (peak < 0.02) return 2.4;
  return Math.min(3.4, Math.max(0.85, TAKE_PEAK_TARGET / peak));
}

function startMeter(stream) {
  stopMeter();
  if (!stream) return;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return;
  state.audioContext = new AudioCtx();
  state.audioContext.resume?.();
  const source = state.audioContext.createMediaStreamSource(stream);
  state.analyser = state.audioContext.createAnalyser();
  state.analyser.fftSize = 256;
  source.connect(state.analyser);
  const data = new Uint8Array(state.analyser.frequencyBinCount);
  const wave = new Uint8Array(state.analyser.fftSize);
  const tick = () => {
    if (!state.analyser) return;
    state.analyser.getByteFrequencyData(data);
    state.analyser.getByteTimeDomainData(wave);
    let peak = 0;
    for (let i = 0; i < wave.length; i += 1) {
      peak = Math.max(peak, Math.abs(wave[i] - 128) / 128);
    }
    if (state.recorder?.state === 'recording' || state.countdownTimer) {
      state.recordPeak = Math.max(state.recordPeak, peak);
      setVoiceMeter(Math.max(state.recordPeak, peak), true);
    }
    els.micBars.forEach((bar, index) => {
      const value = data[Math.min(index, data.length - 1)] / 255;
      bar.style.height = `${Math.max(4, value * 22)}px`;
      bar.style.opacity = String(0.35 + value * 0.65);
    });
    els.waveformBars.forEach((bar, index) => {
      const value = data[Math.min(index, data.length - 1)] / 255;
      bar.style.height = `${Math.max(10, 18 + value * 70)}px`;
    });
    state.meterRaf = requestAnimationFrame(tick);
  };
  tick();
}

async function measureBlobPeak(blob) {
  const profile = await profileTakeAudio(blob);
  return profile.peak || 0;
}

async function profileTakeAudio(blob) {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return { peak: 0, onset: 0, release: 0, voiced: 0 };
  const ctx = new AudioCtx();
  try {
    const decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
    const samples = decoded.getChannelData(0);
    const rate = decoded.sampleRate;
    const windowSize = Math.max(64, Math.floor(rate * 0.02));
    let peak = 0;
    let onset = decoded.duration;
    let release = 0;
    const threshold = 0.035;
    for (let i = 0; i < samples.length; i += windowSize) {
      let sum = 0;
      const end = Math.min(samples.length, i + windowSize);
      for (let j = i; j < end; j += 1) {
        const value = Math.abs(samples[j]);
        peak = Math.max(peak, value);
        sum += samples[j] * samples[j];
      }
      const rms = Math.sqrt(sum / Math.max(1, end - i));
      if (rms >= threshold) {
        const time = i / rate;
        onset = Math.min(onset, time);
        release = Math.max(release, time + (windowSize / rate));
      }
    }
    if (peak < threshold) {
      return { peak, onset: 0, release: 0, voiced: 0 };
    }
    const voiced = Math.max(0, release - onset);
    return { peak, onset, release, voiced };
  } finally {
    await ctx.close().catch(() => undefined);
  }
}

function stopMeter() {
  cancelAnimationFrame(state.meterRaf);
  state.meterRaf = 0;
  state.analyser = null;
  state.recordStream = null;
  state.audioContext?.close().catch(() => undefined);
  state.audioContext = null;
}

function updateScoreCard() {
  const pack = currentPack();
  if (!pack?.scenes.length) {
    els.scoreAverage.textContent = '—';
    els.scoreCaption.textContent = 'SEM PACK';
    els.scoreCoverage.textContent = '—';
    els.scoreDuration.textContent = '—';
    els.scoreOnTime.textContent = '—';
    els.scorePack.textContent = '—';
    return;
  }
  const recorded = pack.scenes.filter((scene) => pack.takes[scene.id]);
  const coverage = Math.round((recorded.length / pack.scenes.length) * 100);
  const durationScores = recorded.map((scene) => {
    const take = pack.takes[scene.id];
    const delta = Math.abs((take.duration || scene.duration) - scene.duration);
    return Math.max(0, 100 - (delta / Math.max(scene.duration, 0.8)) * 100);
  });
  const durationAvg = durationScores.length
    ? Math.round(durationScores.reduce((sum, value) => sum + value, 0) / durationScores.length)
    : 0;
  const onTime = durationScores.length
    ? Math.round((durationScores.filter((value) => value >= 80).length / durationScores.length) * 100)
    : 0;
  const overall = recorded.length ? Math.round((coverage * 0.45) + (durationAvg * 0.55)) : 0;
  els.scoreAverage.textContent = recorded.length ? String(overall) : '—';
  els.scoreCaption.textContent = recorded.length ? 'MÉDIA GERAL' : 'SEM TAKES';
  els.scoreCoverage.textContent = `${coverage}%`;
  els.scoreDuration.textContent = recorded.length ? `${durationAvg}%` : '—';
  els.scoreOnTime.textContent = recorded.length ? `${onTime}%` : '—';
  els.scorePack.textContent = pack.name;
}

function timingMessage(scene, take) {
  const onset = Number(take.onset);
  const voiced = Number(take.voiced);
  if (Number.isFinite(onset) && onset > 0.4) {
    return `Você entrou ${onset.toFixed(1)}s depois do início do take.`;
  }
  if (Number.isFinite(voiced) && voiced > 0.3) {
    const delta = voiced - scene.duration;
    if (delta < -0.35) return `Sua fala durou ${Math.abs(delta).toFixed(1)}s a menos que a referência.`;
    if (delta > 0.35) return `Sua fala durou ${delta.toFixed(1)}s a mais que a referência.`;
    return 'Duração alinhada com a referência.';
  }
  const delta = (take.duration || 0) - scene.duration;
  if (Math.abs(delta) <= 0.25) return 'Duração alinhada com a referência.';
  if (delta < 0) return `Take ${Math.abs(delta).toFixed(1)}s mais curto que a referência.`;
  return `Take ${delta.toFixed(1)}s mais longo que a referência.`;
}

function updateTimingDesk(scene, take) {
  if (!els.timingTakeBar && !els.waveEndLabel) return;
  if (els.waveStartLabel) els.waveStartLabel.textContent = '0:00';
  if (els.waveEndLabel) els.waveEndLabel.textContent = formatClock(scene.duration);
  if (els.timingRefBar) els.timingRefBar.style.width = '100%';
  if (els.timingTakeBar) {
    if (!take) {
      els.timingTakeBar.style.width = '0%';
      els.timingTakeBar.className = '';
    } else {
      const length = Number(take.voiced) > 0.2 ? take.voiced : take.duration;
      const ratio = Math.min(1.45, length / Math.max(scene.duration, 0.01));
      els.timingTakeBar.style.width = `${Math.max(8, ratio * 100)}%`;
      els.timingTakeBar.style.marginLeft = Number.isFinite(take.onset)
        ? `${Math.min(70, (take.onset / Math.max(scene.duration, 0.01)) * 100)}%`
        : '0';
      const status = timingStatus(scene, take);
      els.timingTakeBar.className = status;
    }
  }
  els.timingLabels.forEach((label) => label.classList.remove('is-active'));
  if (take) {
    const status = timingStatus(scene, take);
    const index = status === 'early' ? 0 : status === 'late' ? 2 : 1;
    els.timingLabels[index]?.classList.add('is-active');
  }
}

function timingStatus(scene, take) {
  const onset = Number(take.onset);
  const voiced = Number(take.voiced);
  if (Number.isFinite(onset) && onset > 0.4) return 'late';
  if (Number.isFinite(voiced) && voiced > 0.2) {
    const delta = voiced - scene.duration;
    if (delta < -0.35) return 'early';
    if (delta > 0.35) return 'late';
    return 'ok';
  }
  const delta = (take.duration || 0) - scene.duration;
  if (delta < -0.25) return 'early';
  if (delta > 0.25) return 'late';
  return 'ok';
}

function formatClock(value) {
  const total = Math.max(0, Number(value) || 0);
  const minutes = Math.floor(total / 60);
  const seconds = Math.floor(total % 60);
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function rememberUrl(url) {
  state.objectUrls.push(url);
  return url;
}

function revokePackMedia(pack) {
  const seen = new Set();
  const drop = (url) => {
    if (!url || seen.has(url)) return;
    seen.add(url);
    URL.revokeObjectURL(url);
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

function toast(message) {
  els.appToast.textContent = message;
  els.appToast.hidden = false;
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => {
    els.appToast.hidden = true;
  }, 3200);
}

const CREDIT_KEY = 'dubpack-credits';
const CREDIT_PACKS = [
  { id: 'c1', credits: 1, price: 3, label: '1 crédito', hint: 'Uma dublagem MP4' },
  { id: 'c2', credits: 2, price: 5, label: '2 créditos', hint: 'R$ 2,50 cada' },
  { id: 'c5', credits: 5, price: 11, label: '5 créditos', hint: 'Melhor custo', featured: true },
  { id: 'c10', credits: 10, price: 20, label: '10 créditos', hint: 'R$ 2,00 cada' }
];

function getCredits() {
  if (isOwner()) return Number.POSITIVE_INFINITY;
  const key = state.user?.email ? `dubpack-credits:${normalizeEmail(state.user.email)}` : CREDIT_KEY;
  const stored = localStorage.getItem(key);
  if (stored === null) {
    localStorage.setItem(key, '1');
    return 1;
  }
  const value = Number(stored);
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function setCredits(value) {
  if (isOwner()) {
    updateCreditUi();
    return;
  }
  const key = state.user?.email ? `dubpack-credits:${normalizeEmail(state.user.email)}` : CREDIT_KEY;
  localStorage.setItem(key, String(Math.max(0, value)));
  updateCreditUi();
}

function creditLabel(count) {
  if (!Number.isFinite(count) || count === Number.POSITIVE_INFINITY) return '∞ créditos';
  return `${count} ${count === 1 ? 'crédito' : 'créditos'}`;
}

function updateCreditUi() {
  const count = getCredits();
  const label = creditLabel(count);
  if (els.creditBadge) els.creditBadge.textContent = label;
  if (els.creditsBalance) els.creditsBalance.textContent = label;
  if (els.profileCredits) els.profileCredits.textContent = label;
}

function renderCreditShop() {
  if (!els.creditShop) return;
  els.creditShop.replaceChildren();
  if (isOwner()) {
    const note = document.createElement('p');
    note.className = 'hint-copy';
    note.textContent = 'Conta de dono: créditos infinitos. Quem usa o Studio gasta crédito de novo se quiser gerar o vídeo outra vez.';
    els.creditShop.append(note);
    return;
  }
  CREDIT_PACKS.forEach((pack) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `credit-card${pack.featured ? ' featured' : ''}`;
    const title = document.createElement('strong');
    title.textContent = pack.label;
    const price = document.createElement('b');
    price.textContent = `R$ ${pack.price},00`;
    const hint = document.createElement('span');
    hint.textContent = pack.hint;
    button.append(title, price, hint);
    button.addEventListener('click', () => buyCredits(pack));
    els.creditShop.append(button);
  });
}

function buyCredits(pack) {
  setCredits(getCredits() + pack.credits);
  toast(`${pack.label} adicionados. Pagamento real entra na próxima etapa.`);
}

function renderActivity() {
  if (!els.activityList) return;
  els.activityList.replaceChildren();
  const rows = [];
  state.packs.forEach((pack) => {
    Object.entries(pack.takes).forEach(([id, take]) => {
      const index = pack.scenes.findIndex((scene) => scene.id === id);
      rows.push({ pack, take, index, scene: pack.scenes[index] });
    });
  });
  rows.sort((a, b) => String(b.take.createdAt).localeCompare(String(a.take.createdAt)));
  if (!rows.length) {
    const empty = document.createElement('p');
    empty.className = 'hint-copy';
    empty.textContent = 'Suas gravações aparecem aqui depois do primeiro take.';
    els.activityList.append(empty);
    return;
  }
  rows.slice(0, 6).forEach((row) => {
    const item = document.createElement('article');
    item.className = 'activity-row';
    const thumb = document.createElement('div');
    thumb.className = 'activity-thumb';
    if (row.scene?.imageUrl) {
      const img = document.createElement('img');
      img.src = row.scene.imageUrl;
      img.alt = '';
      thumb.append(img);
    } else {
      thumb.textContent = '🎙';
    }
    const meta = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = `${row.pack.name} · fala ${row.index + 1}`;
    const when = document.createElement('small');
    when.textContent = row.take.createdAt ? new Date(row.take.createdAt).toLocaleString('pt-BR') : 'Agora';
    meta.append(title, when);
    const score = document.createElement('span');
    score.className = 'activity-score';
    const scene = row.scene;
    const delta = scene ? Math.abs((row.take.duration || scene.duration) - scene.duration) : 0;
    score.textContent = delta <= 0.35 ? 'BOM' : 'TAKE';
    item.append(thumb, meta, score);
    item.addEventListener('click', () => {
      state.activePackId = row.pack.id;
      selectScene(Math.max(0, row.index));
      setTab('record');
    });
    els.activityList.append(item);
  });
}

function showFinalVideo(pack) {
  const has = Boolean(pack?.finalUrl);
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
    if (has) {
      els.downloadMp4Btn.href = pack.finalUrl;
      els.downloadMp4Btn.download = `${safeFile(pack.name)}-dublagem.${pack.finalExt || 'mp4'}`;
    }
  }
  if (els.exportStatus && has) {
    els.exportStatus.textContent = 'Vídeo pronto. 1 crédito já foi usado. Assista acima ou baixe o arquivo.';
  }
  updateFinishCta(pack);
}

async function requestFinalMp4() {
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
  if (!isOwner() && getCredits() < 1) {
    toast('Sem créditos. Escolha um pacote para finalizar de novo.');
    setTab('credits');
    return;
  }
  if (state.exporting) {
    toast('Já estou montando o MP4.');
    return;
  }
  stopProjectPreview();
  abortCapture();
  state.exporting = true;
  setTab('dub');
  setExportProgress(2, 'Começando');
  if (els.generateMp4Btn) els.generateMp4Btn.disabled = true;
  els.exportVideoBtn.disabled = true;
  if (els.exportVideoBtnSide) els.exportVideoBtnSide.disabled = true;
  try {
    const composed = await composeDubbedVideo(pack, setExportProgress);
    let output = composed;
    if (!composed.type.includes('mp4')) {
      setExportProgress(92, 'Convertendo para MP4');
      try {
        output = await convertToMp4(composed);
      } catch (error) {
        output = composed;
        toast('O Chrome gravou em WebM. Abre no Chrome e no VLC.');
      }
    }
    setExportProgress(100, 'Pronto');
    if (pack.finalUrl) URL.revokeObjectURL(pack.finalUrl);
    pack.finalBlob = output;
    pack.finalExt = output.type.includes('mp4') ? 'mp4' : 'webm';
    pack.finalUrl = rememberUrl(URL.createObjectURL(output));
    if (!isOwner()) setCredits(getCredits() - 1);
    showFinalVideo(pack);
    scheduleSave();
    toast('Dublagem pronta. Assista com a sua voz.');
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

function pickVideoMime() {
  const types = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
  return types.find((type) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) || '';
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function setExportPreview(on) {
  els.finalVideoWrap?.classList.toggle('is-exporting', Boolean(on));
}

function setExportProgress(pct, text) {
  const n = Math.max(0, Math.min(100, Math.round(Number(pct) || 0)));
  els.exportProgressWrap?.classList.remove('is-hidden');
  if (els.exportProgressBar) els.exportProgressBar.style.width = `${n}%`;
  if (els.exportProgressLabel) els.exportProgressLabel.textContent = text ? `${text} ${n}%` : `${n}%`;
  if (els.exportStatus && text) els.exportStatus.textContent = `${text} ${n}%`;
}

function hideExportProgress() {
  els.exportProgressWrap?.classList.add('is-hidden');
}

async function urlLooksLikeOgg(url) {
  try {
    const blob = await fetch(url).then((response) => response.blob());
    if (/ogg|ogv|ogm|oga/i.test(blob.type)) return true;
    const head = new Uint8Array(await blob.slice(0, 4).arrayBuffer());
    return head[0] === 0x4f && head[1] === 0x67 && head[2] === 0x67 && head[3] === 0x53;
  } catch {
    return false;
  }
}

function filmCandidates(pack) {
  const urls = [];
  const add = (url) => {
    if (url && !urls.includes(url)) urls.push(url);
  };
  add(pack.filmUrl);
  pack.scenes.forEach((scene) => add(scene.videoUrl));
  return urls;
}

function loadExportVideo(src) {
  const video = els.exportFilm || document.createElement('video');
  video.crossOrigin = 'anonymous';
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

async function waitForVideoFrame(video) {
  const deadline = performance.now() + 6000;
  while (performance.now() < deadline) {
    if (!video.paused && video.readyState >= 2 && video.videoWidth > 1) return true;
    await wait(40);
  }
  return false;
}

async function ensureOgvPlayer() {
  if (window.OGVPlayer || window.ogv?.OGVPlayer) return window.OGVPlayer || window.ogv.OGVPlayer;
  window.OGVLoader = window.OGVLoader || {};
  window.OGVLoader.base = 'https://unpkg.com/ogv@1.8.9/dist/';
  await loadScript('https://unpkg.com/ogv@1.8.9/dist/ogv-support.js');
  await loadScript('https://unpkg.com/ogv@1.8.9/dist/ogv.js');
  const Player = window.OGVPlayer || window.ogv?.OGVPlayer;
  if (!Player) throw new Error('Não carregou o player de .ogv.');
  return Player;
}

async function openOgvFilm(url, onProgress) {
  onProgress?.(12, 'Abrindo o vídeo Choicer');
  const Player = await ensureOgvPlayer();
  onProgress?.(18, 'Preparando o filme da cena');
  const player = new Player({ wasm: true, webGL: false });
  player.muted = true;
  player.setAttribute('playsinline', '');
  player.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;z-index:3;background:#000';
  els.finalVideoWrap.appendChild(player);
  player.src = url;
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('O vídeo da cena demorou para abrir.')), 25000);
    const ok = () => {
      clearTimeout(timer);
      resolve();
    };
    player.addEventListener('loadedmetadata', ok, { once: true });
    player.addEventListener('canplay', ok, { once: true });
    player.addEventListener('error', () => {
      clearTimeout(timer);
      reject(new Error('Não deu para ler o vídeo da cena do pack.'));
    }, { once: true });
  });
  const paintCanvas = document.createElement('canvas');
  paintCanvas.width = Math.max(640, player.videoWidth || 1280);
  paintCanvas.height = Math.max(360, player.videoHeight || 720);
  paintCanvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;z-index:4';
  els.finalVideoWrap.appendChild(paintCanvas);
  const ctx = paintCanvas.getContext('2d', { alpha: false, desynchronized: true });
  let painting = true;
  const paint = () => {
    if (!painting) return;
    const from = player._canvas || player.querySelector('canvas');
    if (from) ctx.drawImage(from, 0, 0, paintCanvas.width, paintCanvas.height);
    requestAnimationFrame(paint);
  };
  paint();
  return {
    duration: Number(player.duration) || 0,
    srcUrl: url,
    currentTime: () => Number(player.currentTime) || 0,
    play: () => player.play(),
    pause: () => player.pause(),
    ended: new Promise((resolve) => player.addEventListener('ended', resolve, { once: true })),
    getTrack: () => paintCanvas.captureStream(30).getVideoTracks()[0],
    stop: () => {
      painting = false;
      try { player.pause(); } catch { /* ignore */ }
      player.remove();
      paintCanvas.remove();
    }
  };
}

async function openNativeFilm(url) {
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

async function openFilmPlayback(candidates, onProgress) {
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

async function decodeAudioFrom(audioCtx, blob, url) {
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

function startBufferAt(audioCtx, dest, buffer, when, gainValue) {
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

function duckDuringTakes(gainNode, t0, windows) {
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

function attachMediaBed(audioCtx, dest, srcUrl) {
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

function resolveFilmUrl(pack) {
  return filmCandidates(pack)[0] || '';
}

function coverDraw(ctx, media, width, height) {
  const mw = media.videoWidth || media.naturalWidth || width;
  const mh = media.videoHeight || media.naturalHeight || height;
  const scale = Math.max(width / mw, height / mh);
  const dw = mw * scale;
  const dh = mh * scale;
  ctx.drawImage(media, (width - dw) / 2, (height - dh) / 2, dw, dh);
}

async function composeDubbedVideo(pack, onProgress) {
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
    onProgress?.(4, 'Carregando o vídeo da cena');
    film = await openFilmPlayback(candidates, setExportProgress);

    const lastLineEnd = pack.scenes.reduce((max, raw) => {
      const scene = decorateScene(raw);
      return Math.max(max, (Number(scene.videoOffset) || 0) + (Number(scene.duration) || 0));
    }, 0);

    const takeWindows = pack.scenes.map((raw) => {
      const scene = decorateScene(raw);
      const take = pack.takes[scene.id];
      if (!take) return null;
      return {
        offset: Number(scene.videoOffset) || 0,
        duration: Number(scene.duration) || 2,
        take,
        scene
      };
    }).filter(Boolean);

    setExportProgress(20, 'Preparando as vozes');
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
      setExportProgress(20 + ((index + 1) / Math.max(1, takeWindows.length)) * 8, 'Preparando as vozes');
      try {
        takeBuffers.push({
          ...win,
          buffer: await decodeAudioFrom(audioCtx, win.take.blob, win.take.url)
        });
      } catch {
        // Sem take decodificado, a fala original do filme fica.
      }
    }

    if (!playBacking) {
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
      recorder = mimeType ? new MediaRecorder(mixed, { mimeType, videoBitsPerSecond: 3_500_000 }) : new MediaRecorder(mixed);
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

    const duration = film.duration > 0 ? film.duration : Math.max(lastLineEnd, 8);
    let finished = false;
    film.ended.then(() => { finished = true; });
    const startedAt = performance.now();
    while (!finished && performance.now() - startedAt < duration * 1000 + 1000) {
      const t = film.currentTime?.() || 0;
      setExportProgress(30 + Math.min(60, (t / duration) * 60), 'Gerando o vídeo');
      if (t >= duration - 0.12) break;
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
  if (blob.size < 8000) throw new Error('Não consegui montar o vídeo. Toque em gerar de novo.');
  return blob;
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
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

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-src="${src}"]`);
    if (existing) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.dataset.src = src;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

async function convertToMp4(blob) {
  const work = (async () => {
    setExportProgress(92, 'Carregando conversor MP4');
    await loadScript('https://unpkg.com/@ffmpeg/ffmpeg@0.11.6/dist/ffmpeg.min.js');
    const { createFFmpeg, fetchFile } = window.FFmpeg;
    if (!state.ffmpeg) {
      state.ffmpeg = createFFmpeg({
        log: false,
        mainName: 'createFFmpegCore',
        corePath: 'https://unpkg.com/@ffmpeg/core-st@0.11.1/dist/ffmpeg-core.js'
      });
    }
    if (!state.ffmpeg.isLoaded()) await state.ffmpeg.load();
    state.ffmpeg.setProgress?.(({ ratio }) => {
      setExportProgress(93 + Math.round(Math.min(6, Math.max(0, Number(ratio) || 0) * 6)), 'Convertendo para MP4');
    });
    const input = blob.type.includes('mp4') ? 'input.mp4' : 'input.webm';
    state.ffmpeg.FS('writeFile', input, await fetchFile(blob));
    await state.ffmpeg.run(
      '-i', input,
      '-vf', 'scale=-2:720',
      '-c:v', 'libx264',
      '-preset', 'ultrafast',
      '-crf', '28',
      '-pix_fmt', 'yuv420p',
      '-c:a', 'aac',
      '-b:a', '128k',
      '-movflags', '+faststart',
      'output.mp4'
    );
    const data = state.ffmpeg.FS('readFile', 'output.mp4');
    state.ffmpeg.FS('unlink', input);
    state.ffmpeg.FS('unlink', 'output.mp4');
    return new Blob([data.buffer], { type: 'video/mp4' });
  })();
  return Promise.race([
    work,
    wait(180000).then(() => {
      throw new Error('Conversão MP4 demorou demais');
    })
  ]);
}

function scheduleSave() {
  clearTimeout(state.saveTimer);
  state.saveTimer = setTimeout(() => {
    persistSession().catch(() => undefined);
  }, 400);
}

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('dubpack-studio', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('session');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function persistSession() {
  if (!state.user?.email) return;
  const payload = {
    activePackId: state.activePackId,
    activeIndex: state.activeIndex,
    packs: await Promise.all(state.packs.map(async (pack) => ({
      id: pack.id,
      name: pack.name,
      importedAt: pack.importedAt || Date.now(),
      zipBytes: pack.zipBytes,
      finalBlob: pack.finalBlob || null,
      finalExt: pack.finalExt || '',
      takes: Object.fromEntries(await Promise.all(Object.entries(pack.takes).map(async ([id, take]) => {
        const blob = take.blob || await fetch(take.url).then((response) => response.blob());
        return [id, {
          blob,
          character: take.character,
          subtitle: take.subtitle,
          createdAt: take.createdAt,
          duration: take.duration,
          ext: take.ext,
          onset: take.onset,
          release: take.release,
          voiced: take.voiced,
          peak: take.peak
        }];
      })))
    })))
  };
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction('session', 'readwrite');
    tx.objectStore('session').put(payload, sessionStoreKey());
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function restoreSession() {
  const db = await openDb();
  const store = db.transaction('session', 'readonly').objectStore('session');
  const payload = await new Promise((resolve, reject) => {
    const request = store.get(sessionStoreKey());
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  const fallback = payload || !isOwner() ? null : await new Promise((resolve, reject) => {
    const request = db.transaction('session', 'readonly').objectStore('session').get('current');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  db.close();
  const savedSession = payload || fallback;
  if (!savedSession?.packs?.length) {
    renderPackGrid();
    updateScoreCard();
    return;
  }

  for (const saved of savedSession.packs) {
    try {
      const pack = await buildPack(saved.name, saved.zipBytes);
      pack.id = saved.id;
      pack.importedAt = saved.importedAt || Date.now();
      pack.takes = {};
      Object.entries(saved.takes || {}).forEach(([id, take]) => {
        const url = rememberUrl(URL.createObjectURL(take.blob));
        pack.takes[id] = { ...take, url };
      });
      if (saved.finalBlob) {
        pack.finalBlob = saved.finalBlob;
        pack.finalExt = saved.finalExt || 'mp4';
        pack.finalUrl = rememberUrl(URL.createObjectURL(saved.finalBlob));
      }
      state.packs.push(pack);
    } catch {
      // Pack salvo inválido: ignora e segue.
    }
  }

  state.activePackId = savedSession.activePackId;
  state.activeIndex = savedSession.activeIndex || 0;
  if (!currentPack() && state.packs[0]) state.activePackId = state.packs[0].id;
  renderPackGrid();
  updateScoreCard();
  if (currentPack()) selectScene(state.activeIndex);
}

function findSceneArt(choicer, index, images, objectUrl, audioEntry) {
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

function visualUrlFor(audioEntry, index, visualEntries, objectUrl) {
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

function extractTakeNumber(name) {
  const file = name.split('/').pop() || '';
  const match = file.match(/(?:^|[^\d])(\d{1,3})(?=[^\d]|$)/);
  return match ? Number(match[1]) : null;
}

function findSharedVideo(videos) {
  const fileName = (entry) => entry.name.split('/').pop() || '';
  const playable = ['mp4', 'webm', 'm4v'];
  const named = videos.filter((entry) => /dub[_-]?video/i.test(fileName(entry)));
  return named.find((entry) => playable.includes(entry.ext))
    || videos.find((entry) => playable.includes(entry.ext) && /full[_-]?video|^video$/i.test(normalizeBaseName(entry.name)))
    || named[0]
    || videos.find((entry) => /full[_-]?video|^video$/i.test(normalizeBaseName(entry.name)))
    || videos.find((entry) => playable.includes(entry.ext))
    || null;
}

function findBackingTrack(entries) {
  return entries.find((entry) => (
    AUDIO_EXTS.includes(entry.ext)
    && /backing/i.test(entry.name.split('/').pop() || '')
  )) || null;
}

function readPackMeta(entries) {
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

function readSidecarText(audioEntry, entries) {
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

function isJunkPath(name) {
  return name.startsWith('__MACOSX') || name.includes('/.') || name.split('/').pop()?.startsWith('.');
}

function namesMatch(path, wanted) {
  if (!wanted) return false;
  return normalizeBaseName(path) === normalizeBaseName(wanted) || path.endsWith(wanted);
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
    gif: 'image/gif',
    mp4: 'video/mp4',
    mov: 'video/quicktime',
    webm: 'video/webm',
    ogv: 'video/ogg',
  };
  return map[ext] ?? 'application/octet-stream';
}

function pickRecorderMime() {
  const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4;codecs=mp4a.40.2', 'audio/mp4'];
  return types.find((type) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) || '';
}

function detectCharacter(name) {
  const choicer = parseChoicerFields(name);
  if (choicer?.character) return choicer.character;
  const parts = name.replace(/\.[^.]+$/, '').split(/[_-]/).filter(Boolean);
  return parts.find((part) => /[a-zA-ZÀ-ÿ]/.test(part) && !/^\d+$/.test(part) && !/^(data|caption|image)$/i.test(part)) ?? 'Personagem';
}

function parseChoicerFields(raw) {
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

function spokenLineFromName(name, character) {
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

function cleanSubtitle(name) {
  return String(name || '').replace(/\.[^.]+$/, '').replace(/^\d+[_-]?/, '').replace(/[_-]+/g, ' ').trim();
}

function estimateDuration(name) {
  const match = name.match(/(\d+(?:[.,]\d+)?)s/i);
  if (match) return Math.max(1.2, Number(match[1].replace(',', '.')));
  return Math.min(12, Math.max(1.8, cleanSubtitle(name).length / 16));
}

function clampDuration(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return 2;
  return Math.min(MAX_LINE_SECONDS, Math.max(0.8, number));
}

function formatSeconds(value) {
  const total = Math.max(0, Math.round(Number(value) || 0));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function getMediaDuration(url) {
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

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function safeFile(value) {
  return String(value || 'take').replace(/[^\w\-]+/g, '_').slice(0, 40);
}
