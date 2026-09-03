const AUDIO_EXTS = ['mp3', 'wav', 'ogg', 'm4a', 'webm'];
const IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'webp', 'gif'];
const VIDEO_EXTS = ['mp4', 'mov', 'webm', 'ogv', 'm4v'];
const CREATE_SCENE_MAX_SEC = 80;
const MAX_LINE_SECONDS = 600;
const GUIDE_VOLUME = 0.08;
const BED_VOLUME = 0.03;
const BED_EXPORT = 0.06;
const BED_DUCK = 0.012;
const TAKE_PEAK_TARGET = 0.62;
const PACK_TTL_MS = 2 * 24 * 60 * 60 * 1000;
const EXPORT_WATERMARK_LABEL = 'DubPack Studio';
const PRO_MONTHLY_PRICE = 9.9;
const PRO_MONTHLY_PRICE_USD = 2.99;
const PRO_MONTHLY_CREDITS = 200;
const PRO_PERIOD_MS = 30 * 24 * 60 * 60 * 1000;
const SESSION_USER_KEY = 'dubpack-user';
const REMEMBER_ME_KEY = 'dubpack-remember-me';
const USERS_KEY = 'dubpack-users';
const OWNER_EMAILS = [
  'viniciusleme@gmail.com',
  'vinicius.leme@gmail.com',
  'vineleme@gmail.com',
  'vineleme@icloud.com',
  'viniciusleme@icloud.com'
];
const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyBl-eePA-sXfI6JR6wVlx3m2BLTpfyMFSE',
  authDomain: 'dub-pack-studio.firebaseapp.com',
  projectId: 'dub-pack-studio',
  storageBucket: 'dub-pack-studio.firebasestorage.app',
  messagingSenderId: '856569139818',
  appId: '1:856569139818:web:0a715060112d1fc779b013'
};

let firebaseAuth = null;
let firebaseAuthReady = Promise.resolve();
let authListenerBound = false;
let authBootDone = false;

try {
  if (window.firebase?.apps?.length) {
    firebaseAuth = window.firebase.auth();
  } else if (window.firebase?.initializeApp) {
    window.firebase.initializeApp(FIREBASE_CONFIG);
    firebaseAuth = window.firebase.auth();
  }
  if (firebaseAuth) {
    firebaseAuth.languageCode = 'pt';
    firebaseAuthReady = ensureAuthPersistence(readRememberMe());
  }
} catch (error) {
  console.error(error);
  firebaseAuth = null;
}

function readRememberMe() {
  try {
    return localStorage.getItem(REMEMBER_ME_KEY) !== '0';
  } catch {
    return true;
  }
}

function writeRememberMe(remember) {
  try {
    localStorage.setItem(REMEMBER_ME_KEY, remember ? '1' : '0');
  } catch {
    // ignore
  }
}

async function ensureAuthPersistence(remember = readRememberMe()) {
  if (!firebaseAuth?.setPersistence || !window.firebase?.auth?.Auth?.Persistence) return;
  try {
    const mode = remember
      ? window.firebase.auth.Auth.Persistence.LOCAL
      : window.firebase.auth.Auth.Persistence.SESSION;
    await firebaseAuth.setPersistence(mode);
  } catch (error) {
    console.error(error);
  }
}

function readSessionUser() {
  try {
    const raw = localStorage.getItem(SESSION_USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function bindFirebaseAuthListener() {
  if (!firebaseAuth || authListenerBound) return;
  authListenerBound = true;
  firebaseAuth.onAuthStateChanged(async (fbUser) => {
    if (fbUser) {
      const account = accountFromFirebase(fbUser);
      if (state.user?.uid === account.uid) {
        showAuthGate(false);
        return;
      }
      await finishLogin(account, { toast: false });
      return;
    }
    if (!authBootDone) return;
    if (state.user) {
      state.user = null;
      localStorage.removeItem(SESSION_USER_KEY);
      refreshAccountUi();
    }
  });
}

async function restoreAuthSession() {
  if (!firebaseAuth) return false;
  try {
    await firebaseAuthReady;
    bindFirebaseAuthListener();
    if (typeof firebaseAuth.authStateReady === 'function') {
      try {
        await firebaseAuth.authStateReady();
      } catch (error) {
        console.error(error);
      }
    }

    let fbUser = firebaseAuth.currentUser;
    if (!fbUser) {
      await new Promise((resolve) => setTimeout(resolve, 400));
      fbUser = firebaseAuth.currentUser;
    }
    if (!fbUser) return false;

    if (state.user?.uid === fbUser.uid) {
      showAuthGate(false);
      return true;
    }
    await finishLogin(accountFromFirebase(fbUser), { toast: false });
    return true;
  } finally {
    authBootDone = true;
  }
}

function getStudioTips() {
  return [1, 2, 3, 4].map((index) => ({
    title: t(`tip.${index}.title`),
    body: t(`tip.${index}.body`)
  }));
}

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
  captureGen: 0,
  recordingTimer: null,
  recordStopTimer: null,
  progressTimer: null,
  playbackTimer: null,
  videoTimer: null,
  clipVideoPlaying: false,
  sceneOgv: null,
  sceneOgvSrc: '',
  activeAudio: null,
  activeAudios: [],
  playbackCtx: null,
  playbackStops: [],
  previewing: false,
  previewGen: 0,
  toastTimer: null,
  saveTimer: null,
  objectUrls: [],
  blobByUrl: new Map(),
  ffmpeg: null,
  exporting: false,
  user: null,
  authMode: 'login',
  tipIndex: 0,
  tipTimer: 0,
  exportLayout: 'original',
  pendingCena: null,
  waveGen: 0,
  create: {
    videoFile: null,
    videoBytes: null,
    videoUrl: '',
    zipBytes: null,
    lines: [],
    busy: false,
    sceneStart: 0,
    sceneEnd: CREATE_SCENE_MAX_SEC,
    previewTimer: 0,
    previewLineId: null,
    previewOnTimeUpdate: null,
    vocalsFile: null,
    vocalsBytes: null,
    vocalsName: '',
    linesConfirmed: false,
    lang: 'pt',
    whisperBusy: false
  }
};

/** Cached Whisper ASR pipeline (loaded once per session). */
let createWhisperTranscriber = null;
let createWhisperLoadPromise = null;
const CREATE_WHISPER_MODEL = 'Xenova/whisper-base';
const CREATE_WHISPER_CDN = 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2';

const els = {
  packInput: document.querySelector('#packInput'),
  packInputEmpty: document.querySelector('#packInputEmpty'),
  packSelect: document.querySelector('#packSelect'),
  packGrid: document.querySelector('#packGrid'),
  packRailNext: document.querySelector('#packRailNext'),
  packEmpty: document.querySelector('#packEmpty'),
  sceneVideo: document.querySelector('#sceneVideo'),
  sceneOgvHost: document.querySelector('#sceneOgvHost'),
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
  cueLabel: document.querySelector('#cueLabel'),
  durationLabel: document.querySelector('#durationLabel'),
  waveCanvas: document.querySelector('#waveCanvas'),
  topCounter: document.querySelector('#topCounter'),
  projectTitle: document.querySelector('#projectTitle'),
  projectMeta: document.querySelector('#projectMeta'),
  counter: document.querySelector('#counter'),
  clipPad: document.querySelector('#clipPad'),
  clipPadTotal: document.querySelector('#clipPadTotal'),
  tapeLamp: document.querySelector('#tapeLamp'),
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
  userChipAvatar: document.querySelector('#userChipAvatar'),
  profileAvatar: document.querySelector('#profileAvatar'),
  profileAvatarInput: document.querySelector('#profileAvatarInput'),
  profileName: document.querySelector('#profileName'),
  profileMeta: document.querySelector('#profileMeta'),
  profileCreditsLine: document.querySelector('#profileCreditsLine'),
  authGate: document.querySelector('#authGate'),
  authForm: document.querySelector('#authForm'),
  authEmail: document.querySelector('#authEmail'),
  authRememberWrap: document.querySelector('#authRememberWrap'),
  authRememberMe: document.querySelector('#authRememberMe'),
  authPassword: document.querySelector('#authPassword'),
  authName: document.querySelector('#authName'),
  authNameWrap: document.querySelector('#authNameWrap'),
  authTitle: document.querySelector('#authTitle'),
  authLead: document.querySelector('#authLead'),
  authSubmitBtn: document.querySelector('#authSubmitBtn'),
  authSwitchBtn: document.querySelector('#authSwitchBtn'),
  authForgotBtn: document.querySelector('#authForgotBtn'),
  authPasswordWrap: document.querySelector('#authPasswordWrap'),
  authPasswordLabel: document.querySelector('#authPasswordLabel'),
  authPasswordToggle: document.querySelector('#authPasswordToggle'),
  authRememberLabel: document.querySelector('#authRememberLabel'),
  authError: document.querySelector('#authError'),
  userChip: document.querySelector('#userChip'),
  profileNavBtn: document.querySelector('#profileNavBtn'),
  tipTitle: document.querySelector('#tipTitle'),
  tipBody: document.querySelector('#tipBody'),
  tipDots: document.querySelector('#tipDots'),
  profileLoginBtn: document.querySelector('#profileLoginBtn'),
  logoutBtn: document.querySelector('#logoutBtn'),
  userLogoutBtn: document.querySelector('#userLogoutBtn'),
  studioApp: document.querySelector('#studioApp'),
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
  howToPlayBtn: document.querySelector('#howToPlayBtn'),
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

try {
  bindUi();
} catch (error) {
  console.error(error);
}
bootApp();

if ('serviceWorker' in navigator) {
  const swVersion = '165';
  navigator.serviceWorker.getRegistrations()
    .then((regs) => Promise.all(regs.map((reg) => {
      const script = String(reg.active?.scriptURL || reg.waiting?.scriptURL || '');
      return script.includes(`sw.js?v=${swVersion}`) ? Promise.resolve() : reg.unregister();
    })))
    .then(() => navigator.serviceWorker.register(`./sw.js?v=${swVersion}`))
    .catch(() => undefined);
}

function bindUi() {
  els.authForm?.addEventListener('submit', submitAuth);
  els.authSubmitBtn?.addEventListener('click', (event) => {
    event.preventDefault();
    submitAuth(event);
  });
  els.authSwitchBtn?.addEventListener('click', () => {
    if (state.authMode === 'reset') {
      clearAuthError();
      setAuthMode('login');
      return;
    }
    clearAuthError();
    setAuthMode(state.authMode === 'signup' ? 'login' : 'signup');
  });
  els.authForgotBtn?.addEventListener('click', showPasswordReset);
  els.authEmail?.addEventListener('input', () => {
    clearAuthError();
    suggestSignupName();
  });
  els.authPassword?.addEventListener('input', clearAuthError);
  els.authPasswordToggle?.addEventListener('click', togglePasswordVisibility);
  els.authGate?.addEventListener('click', (event) => {
    if (event.target === els.authGate) showAuthGate(false);
  });
  els.packInput?.addEventListener('change', importPack);
  els.packInputEmpty?.addEventListener('change', importPack);
  document.querySelector('#openImportBtn')?.addEventListener('click', openImportModal);
  document.querySelector('#importCloseBtn')?.addEventListener('click', closeImportModal);
  document.querySelector('#importModal')?.addEventListener('click', (event) => {
    if (event.target.id === 'importModal') closeImportModal();
  });
  const drop = document.querySelector('#importDrop');
  drop?.addEventListener('dragover', (event) => {
    event.preventDefault();
    drop.classList.add('is-over');
  });
  drop?.addEventListener('dragleave', () => drop.classList.remove('is-over'));
  drop?.addEventListener('drop', (event) => {
    event.preventDefault();
    drop.classList.remove('is-over');
    const file = event.dataTransfer?.files?.[0];
    if (file) void importPackFile(file);
  });
  els.packSelect?.addEventListener('change', () => {
    if (els.packSelect.value) openPack(els.packSelect.value);
  });
  document.querySelector('#helpIntroBtn')?.addEventListener('click', () => els.helpModal?.classList.remove('is-hidden'));
  window.addEventListener('keydown', (event) => {
    if (event.key !== 'r' && event.key !== 'R') return;
    const tag = event.target?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || event.target?.isContentEditable) return;
    event.preventDefault();
    els.recordBtn?.click();
  });
  document.querySelectorAll('label.text-link, .pack-empty label.primary').forEach((label) => {
    label.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      openImportModal();
    });
  });
  els.userChip?.addEventListener('click', () => {
    applyTab('profile');
  });
  els.profileNavBtn?.addEventListener('click', () => setTab('profile'));
  els.prevBtn?.addEventListener('click', () => setTab('packs'));
  els.prevSceneBtn?.addEventListener('click', goPrevScene);
  els.nextSceneBtn?.addEventListener('click', goNextScene);
  els.nextBtn?.addEventListener('click', goNextScene);
  document.querySelector('#rolesBtn')?.addEventListener('click', () => openRolesModal());
  document.querySelector('#rolesCloseBtn')?.addEventListener('click', closeRolesModal);
  document.querySelector('#rolesAllBtn')?.addEventListener('click', selectAllRoles);
  document.querySelector('#rolesApplyBtn')?.addEventListener('click', applyRolesModal);
  document.querySelector('#rolesModal')?.addEventListener('click', (event) => {
    if (event.target.id === 'rolesModal') closeRolesModal();
  });
  els.referenceBtn?.addEventListener('click', playReference);
  els.referenceBtnBottom?.addEventListener('click', playReference);
  els.recordBtn?.addEventListener('click', startTakeFlow);
  els.downloadTakeBtn?.addEventListener('click', downloadTake);
  els.previewBtn?.addEventListener('click', playCurrentTake);
  els.listenTakeBtn?.addEventListener('click', playCurrentTake);
  els.previewBtnAlt?.addEventListener('click', playProjectPreview);
  els.stopPreviewBtn?.addEventListener('click', stopProjectPreview);
  els.exportVideoBtn?.addEventListener('click', () => void requestFinalMp4());
  els.exportVideoBtnSide?.addEventListener('click', () => void requestFinalMp4());
  els.generateMp4Btn?.addEventListener('click', () => void requestFinalMp4());
  els.downloadMp4Btn?.addEventListener('click', () => void downloadFinalMp4());
  document.querySelector('#exportOriginalBtn')?.addEventListener('click', () => void requestFinalMp4('original'));
  document.querySelector('#exportVerticalBtn')?.addEventListener('click', () => void requestFinalMp4('vertical'));
  document.querySelector('#copySceneLinkBtn')?.addEventListener('click', () => void copySceneLink());
  document.querySelector('#shareSceneBtn')?.addEventListener('click', () => void shareSceneLink());
  document.querySelector('#redubBtn')?.addEventListener('click', () => {
    setTab('record');
  });
  document.querySelector('#cenaImportBtn')?.addEventListener('click', openImportModal);
  document.querySelector('#createVideoInput')?.addEventListener('change', onCreateVideoPicked);
  document.querySelector('#createZipInput')?.addEventListener('change', onCreateZipPicked);
  document.querySelector('#createDetectBtn')?.addEventListener('click', () => void detectCreateSpeechLines());
  document.querySelector('#createVocalsInput')?.addEventListener('change', onCreateVocalsPicked);
  document.querySelector('#createVocalsClearBtn')?.addEventListener('click', clearCreateVocals);
  document.querySelector('#createMarkStartBtn')?.addEventListener('click', () => markCreateTime('start'));
  document.querySelector('#createMarkEndBtn')?.addEventListener('click', () => markCreateTime('end'));
  document.querySelector('#createSceneFromPlayheadBtn')?.addEventListener('click', setCreateSceneFromPlayhead);
  document.querySelector('#createMarkSceneStartBtn')?.addEventListener('click', () => markCreateSceneBoundary('start'));
  document.querySelector('#createMarkSceneEndBtn')?.addEventListener('click', () => markCreateSceneBoundary('end'));
  document.querySelector('#createSceneStart')?.addEventListener('change', onCreateSceneInputsChanged);
  document.querySelector('#createSceneEnd')?.addEventListener('change', onCreateSceneInputsChanged);
  bindCreateSceneScrub();
  document.querySelector('#createAddLineBtn')?.addEventListener('click', addCreateLine);
  document.querySelector('#createConfirmLinesBtn')?.addEventListener('click', confirmCreateLines);
  document.querySelector('#createEditLinesBtn')?.addEventListener('click', unconfirmCreateLines);
  document.querySelector('#createTranscribeBtn')?.addEventListener('click', () => void transcribeCreateCaptions());
  document.querySelector('#createLangToggle')?.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-create-lang]');
    if (!btn) return;
    setCreatePackLang(btn.dataset.createLang);
  });
  document.querySelector('#createDownloadBtn')?.addEventListener('click', () => void exportCreatePack({ open: false }));
  document.querySelector('#createOpenBtn')?.addEventListener('click', () => void exportCreatePack({ open: true }));
  document.querySelector('#createResetBtn')?.addEventListener('click', resetCreatePack);
  document.querySelector('#createNewProjectBtn')?.addEventListener('click', resetCreatePack);
  const createDrop = document.querySelector('#createDrop');
  createDrop?.addEventListener('click', () => document.querySelector('#createVideoInput')?.click());
  createDrop?.addEventListener('dragover', (event) => {
    event.preventDefault();
    createDrop.classList.add('is-over');
  });
  createDrop?.addEventListener('dragleave', () => createDrop.classList.remove('is-over'));
  createDrop?.addEventListener('drop', (event) => {
    event.preventDefault();
    createDrop.classList.remove('is-over');
    const file = event.dataTransfer?.files?.[0];
    if (file) void handleCreateIncomingFile(file);
  });
  document.querySelector('#createLineList')?.addEventListener('click', (event) => {
    const playBtn = event.target.closest('[data-create-play]');
    if (playBtn) {
      void previewCreateLine(playBtn.dataset.createPlay);
      return;
    }
    const btn = event.target.closest('[data-create-remove]');
    if (!btn) return;
    removeCreateLine(btn.dataset.createRemove);
  });
  document.querySelector('#createLineList')?.addEventListener('input', (event) => {
    const field = event.target.closest('[data-create-field]');
    if (!field) return;
    updateCreateLineField(field.dataset.createLine, field.dataset.createField, field.value);
  });
  document.querySelectorAll('[data-lang]').forEach((button) => {
    button.addEventListener('click', () => changeLang(button.dataset.lang));
  });
  els.helpBtn?.addEventListener('click', () => els.helpModal?.classList.remove('is-hidden'));
  els.howToPlayBtn?.addEventListener('click', () => els.helpModal?.classList.remove('is-hidden'));
  els.helpCloseBtn?.addEventListener('click', () => els.helpModal?.classList.add('is-hidden'));
  els.helpModal?.addEventListener('click', (event) => {
    if (event.target === els.helpModal) els.helpModal.classList.add('is-hidden');
  });
  els.proBtn?.addEventListener('click', () => setTab('credits'));
  els.bellBtn?.addEventListener('click', () => setTab('credits'));
  els.logoutBtn?.addEventListener('click', logoutUser);
  els.userLogoutBtn?.addEventListener('click', logoutUser);
  els.profileLoginBtn?.addEventListener('click', () => requireAuth());
  els.profileAvatarInput?.addEventListener('change', handleAvatarUpload);
  els.packRailNext?.addEventListener('click', () => {
    els.packGrid?.scrollBy({ left: 240, behavior: 'smooth' });
  });
  const unlockAudioOnce = () => {
    unlockAudio().catch(() => undefined);
  };
  document.addEventListener('touchstart', unlockAudioOnce, { once: true, passive: true });
  document.addEventListener('click', unlockAudioOnce, { once: true });
  startStudioTips();
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && !state.exporting) abortCapture();
  });
  window.addEventListener('pagehide', () => {
    if (!state.exporting) abortCapture();
  });
  window.addEventListener('resize', () => {
    const pack = currentPack();
    const scene = currentScene();
    if (scene) void paintOverlapWave(scene, pack?.takes[scene.id]);
  });

  document.addEventListener('click', (event) => {
    const tabBtn = event.target.closest('[data-tab]');
    if (!tabBtn) return;
    if (tabBtn.id === 'userChip' || tabBtn.id === 'profileNavBtn') return;
    if (tabBtn.tagName === 'A') event.preventDefault();
    const tab = tabBtn.dataset.tab;
    if (tab) setTab(tab);
  });
}

async function bootApp() {
  applyI18n();
  initAuthRememberUi();
  revealStudio();
  refreshAccountUi();
  window.DubpackAds?.init();
  capturePendingCena();
  applyPendingCena();
  window.DubpackCart?.initCart({
    toast,
    t,
    getUser: () => state.user,
    requireAuth
  });
  captureCheckoutReturn();
  if (!firebaseAuth) {
    toast('Firebase não carregou. Recarregue a página.');
    return;
  }
  try {
    await firebaseAuthReady;
    let restored = await restoreAuthSession();
    if (!restored && readSessionUser()?.email && readRememberMe()) {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      if (firebaseAuth.currentUser) {
        await finishLogin(accountFromFirebase(firebaseAuth.currentUser), { toast: false });
        restored = true;
      }
    }
    if (!restored) refreshAccountUi();
    await applyPendingCheckout();
    if (!isLoggedIn()) {
      try { await restoreSession(); } catch { /* guest session optional */ }
    }
    capturePendingCena();
    applyPendingCena();
    trackFunnel('visitor');
  } finally {
    authBootDone = true;
  }
}

function initAuthRememberUi() {
  if (els.authRememberMe) els.authRememberMe.checked = readRememberMe();
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
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

function accountFromFirebase(fbUser) {
  const email = normalizeEmail(fbUser.email);
  const local = readUsers()[email] || {};
  const owner = OWNER_EMAILS.includes(email) || Boolean(local.owner);
  const name = String(fbUser.displayName || local.name || '').trim() || displayNameFromEmail(email);
  const next = { ...local, name, email, owner, uid: fbUser.uid };
  delete next.password;
  const users = readUsers();
  users[email] = next;
  writeUsers(users);
  return { name, email, owner, uid: fbUser.uid };
}

function isOwner(user = state.user) {
  const email = normalizeEmail(user?.email);
  if (!email) return false;
  if (user?.owner) return true;
  return OWNER_EMAILS.includes(email);
}

function proStorageKey(email = state.user?.email) {
  const normalized = normalizeEmail(email);
  return normalized ? `dubpack-pro:${normalized}` : '';
}

function readProState(email = state.user?.email) {
  const key = proStorageKey(email);
  if (!key) return null;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeProState(stateObj, email = state.user?.email) {
  const key = proStorageKey(email);
  if (!key) return;
  localStorage.setItem(key, JSON.stringify(stateObj));
}

function isPro(user = state.user) {
  if (isOwner(user)) return true;
  const pro = readProState(user?.email);
  if (!pro?.active) return false;
  return Date.now() < Number(pro.periodEnd || 0);
}

function ensureProMonthlyCredits() {
  if (!isPro() || isOwner()) return;
  const pro = readProState();
  if (!pro) return;
  const monthKey = new Date().toISOString().slice(0, 7);
  if (pro.lastCreditMonth === monthKey) return;
  setCredits(getCredits() + PRO_MONTHLY_CREDITS);
  writeProState({ ...pro, lastCreditMonth: monthKey });
}

function subscribePro() {
  if (isOwner() || isPro()) {
    if (isPro() && !isOwner()) toast(t('toast.pro.already'));
    return;
  }
  addProToCart();
}

function proStatusLabel() {
  if (isOwner()) return t('pro.card.title');
  if (!isPro()) return t('plan.free');
  const pro = readProState();
  const days = pro?.periodEnd
    ? Math.max(0, Math.ceil((Number(pro.periodEnd) - Date.now()) / (24 * 60 * 60 * 1000)))
    : 0;
  return `DubPack PRO · ${t('plan.pro.days', { days })}`;
}

function isLoggedIn() {
  return Boolean(state.user?.email || firebaseAuth?.currentUser?.email);
}

function requireAuth() {
  showAuthGate(true);
  toast(t('auth.required'));
}

function revealStudio() {
  els.studioApp?.classList.remove('is-hidden');
  document.body.classList.add('in-studio');
}

function showAuthGate(on) {
  els.authGate?.classList.toggle('is-hidden', !on);
  if (on) setAuthMode(state.authMode === 'signup' || state.authMode === 'reset' ? state.authMode : 'login');
}

function changeLang(lang) {
  setLang(lang);
  applyI18n();
  refreshAuthI18n();
  if (state.user) refreshAccountUi();
  renderCreditShop();
  refreshStudioTips();
  window.DubpackCart?.renderCart();
  const pack = currentPack();
  if (pack) {
    updateFinishCta(pack);
    showFinalVideo(pack);
  }
}

function refreshAuthI18n() {
  const reset = state.authMode === 'reset';
  const login = state.authMode === 'login';
  if (els.authTitle) {
    els.authTitle.textContent = t(reset ? 'auth.title.reset' : login ? 'auth.title.login' : 'auth.title.signup');
  }
  if (els.authLead) {
    els.authLead.textContent = t(reset ? 'auth.lead.reset' : login ? 'auth.lead.login' : 'auth.lead.signup');
  }
  if (els.authSubmitBtn) {
    els.authSubmitBtn.textContent = t(reset ? 'auth.submit.reset' : login ? 'auth.submit.login' : 'auth.submit.signup');
  }
  if (els.authSwitchBtn) {
    els.authSwitchBtn.textContent = t(login ? 'auth.switch.signup' : 'auth.switch.login');
  }
  if (els.authPasswordLabel) els.authPasswordLabel.textContent = t('auth.password');
  if (els.authPassword) els.authPassword.placeholder = t('auth.password.placeholder');
  if (els.authPasswordToggle && els.authPassword?.type === 'password') {
    els.authPasswordToggle.setAttribute('aria-label', t('auth.password.show'));
  }
  if (els.authRememberLabel) els.authRememberLabel.textContent = t('auth.remember');
}

function togglePasswordVisibility() {
  const input = els.authPassword;
  const button = els.authPasswordToggle;
  if (!input || !button) return;
  const show = input.type === 'password';
  input.type = show ? 'text' : 'password';
  button.setAttribute('aria-pressed', show ? 'true' : 'false');
  button.setAttribute('aria-label', t(show ? 'auth.password.hide' : 'auth.password.show'));
  button.classList.toggle('is-visible', show);
}

function setPasswordVisible(show) {
  const input = els.authPassword;
  const button = els.authPasswordToggle;
  if (!input || !button) return;
  input.type = show ? 'text' : 'password';
  button.setAttribute('aria-pressed', show ? 'true' : 'false');
  button.setAttribute('aria-label', t(show ? 'auth.password.hide' : 'auth.password.show'));
  button.classList.toggle('is-visible', show);
}

function setAuthMode(mode) {
  state.authMode = mode === 'reset' ? 'reset' : mode === 'login' ? 'login' : 'signup';
  const login = state.authMode === 'login';
  const reset = state.authMode === 'reset';
  if (els.authNameWrap) els.authNameWrap.classList.toggle('is-hidden', login || reset);
  if (els.authName) {
    els.authName.required = false;
    if (login || reset) els.authName.value = '';
  }
  if (els.authPasswordWrap) els.authPasswordWrap.classList.toggle('is-hidden', reset);
  if (els.authPassword) {
    els.authPassword.autocomplete = 'current-password';
    if (reset) els.authPassword.value = '';
  }
  setPasswordVisible(false);
  refreshAuthI18n();
  if (els.authForgotBtn) els.authForgotBtn.classList.toggle('is-hidden', reset);
  if (els.authRememberWrap) els.authRememberWrap.classList.toggle('is-hidden', reset);
  if (!login && !reset) suggestSignupName();
}

function displayNameFromEmail(email) {
  const local = String(email || '').split('@')[0];
  return local || 'Conta';
}

function suggestSignupName() {
  if (state.authMode === 'login' || !els.authName) return;
  const suggested = displayNameFromEmail(els.authEmail?.value);
  els.authName.placeholder = suggested && suggested !== 'Conta'
    ? `Sugestão: ${suggested}`
    : 'Como você quer ser chamado?';
}

function openProfileTab() {
  if (!state.user && firebaseAuth?.currentUser) {
    void finishLogin(accountFromFirebase(firebaseAuth.currentUser), { toast: false }).then(() => applyTab('profile'));
    return;
  }
  applyTab('profile');
}

function refreshAccountUi() {
  const loggedIn = isLoggedIn();
  const user = state.user || (loggedIn && firebaseAuth?.currentUser
    ? accountFromFirebase(firebaseAuth.currentUser)
    : null);
  const first = String(user?.name || 'dublador').split(' ')[0];
  const owner = isOwner(user);
  const pro = isPro(user);
  if (els.welcomeTitle) {
    els.welcomeTitle.textContent = loggedIn
      ? t('welcome.back', { name: first })
      : t('welcome');
  }
  if (els.userChipName) {
    els.userChipName.textContent = loggedIn ? user?.name : t('auth.chip.login');
  }
  if (els.creditBadge) els.creditBadge.hidden = !loggedIn;
  if (els.profileName) {
    els.profileName.textContent = loggedIn ? user?.name : t('auth.chip.login');
  }
  if (els.profileMeta) {
    els.profileMeta.textContent = loggedIn
      ? `${user?.email || ''} · ${proStatusLabel()}`
      : t('profile.guest');
  }
  if (els.logoutBtn) els.logoutBtn.classList.toggle('is-hidden', !loggedIn);
  if (els.userLogoutBtn) els.userLogoutBtn.classList.toggle('is-hidden', !loggedIn);
  if (els.profileLoginBtn) els.profileLoginBtn.classList.toggle('is-hidden', loggedIn);
  if (els.proBtn) {
    els.proBtn.textContent = owner ? t('pro.btn.owner') : pro ? t('pro.btn.manage') : t('pro.btn');
  }
  if (loggedIn) ensureProMonthlyCredits();
  window.DubpackAds?.syncHidden(owner || pro);
  renderAvatars();
  updateCreditUi();
}

const AVATAR_MAX_PX = 320;

function avatarStorageKey(email = state.user?.email) {
  const normalized = normalizeEmail(email);
  return normalized ? `dubpack-avatar:${normalized}` : '';
}

function readAvatarUrl(email = state.user?.email) {
  const key = avatarStorageKey(email);
  return key ? localStorage.getItem(key) || '' : '';
}

function paintAvatarShell(shell, url) {
  if (!shell) return;
  const img = shell.querySelector('img');
  const fallback = shell.querySelector('.avatar-fallback');
  if (!img) return;
  if (url) {
    img.src = url;
    img.hidden = false;
    if (fallback) fallback.hidden = true;
  } else {
    img.removeAttribute('src');
    img.hidden = true;
    if (fallback) fallback.hidden = false;
  }
}

function renderAvatars() {
  const url = readAvatarUrl();
  paintAvatarShell(els.userChipAvatar, url);
  paintAvatarShell(els.profileAvatar, url);
}

async function handleAvatarUpload(event) {
  if (!isLoggedIn()) {
    requireAuth();
    return;
  }
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) return;
  if (!state.user?.email) {
    toast('Entre na conta para trocar a foto.');
    return;
  }
  if (!file.type.startsWith('image/')) {
    toast('Escolha uma imagem (jpg, png ou webp).');
    return;
  }
  try {
    const url = await resizeAvatarFile(file);
    localStorage.setItem(avatarStorageKey(), url);
    renderAvatars();
    toast('Foto de perfil atualizada.');
  } catch {
    toast('Não foi possível usar esta imagem. Tente outra foto.');
  }
}

function resizeAvatarFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read-failed'));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error('image-failed'));
      image.onload = () => {
        const scale = Math.min(1, AVATAR_MAX_PX / Math.max(image.width, image.height, 1));
        const width = Math.max(1, Math.round(image.width * scale));
        const height = Math.max(1, Math.round(image.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('canvas-failed'));
          return;
        }
        ctx.drawImage(image, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.86));
      };
      image.src = String(reader.result || '');
    };
    reader.readAsDataURL(file);
  });
}

async function finishLogin(account, options = {}) {
  const showToast = options.toast !== false;
  state.user = {
    name: account.name,
    email: account.email,
    owner: Boolean(account.owner),
    uid: account.uid || null
  };
  localStorage.setItem(SESSION_USER_KEY, JSON.stringify(state.user));
  showAuthGate(false);
  refreshAccountUi();
  if (showToast) {
    toast('Conta pronta. Packs duram 2 dias.');
  }
  releasePackSession();
  try {
    await restoreSession();
  } catch {
    renderPackGrid();
  }
  pruneExpiredPacks();
  renderCreditShop();
  updateCreditUi();
  window.DubpackCart?.loadCart();
  window.DubpackCart?.renderCart();
  renderActivity();
  showFinalVideo(currentPack());
  applyPendingCena();
  await applyPendingCheckout();
  if (options.signup) trackFunnel('signup');
}

function setAuthBusy(on) {
  if (els.authSubmitBtn) els.authSubmitBtn.disabled = Boolean(on);
  if (els.authSwitchBtn) els.authSwitchBtn.disabled = Boolean(on);
  if (els.authForgotBtn) els.authForgotBtn.disabled = Boolean(on);
}

function authErrorMessage(error) {
  const code = String(error?.code || '');
  if (code === 'auth/wrong-password' || code === 'auth/invalid-credential' || code === 'auth/invalid-login-credentials') {
    return 'wrong-password';
  }
  if (code === 'auth/user-not-found') return 'Conta não encontrada. Toque em Criar conta nova.';
  if (code === 'auth/email-already-in-use') return 'Este e-mail já tem conta. Entre com a senha.';
  if (code === 'auth/weak-password') return 'A senha precisa ter pelo menos 6 caracteres.';
  if (code === 'auth/too-many-requests') return 'Muitas tentativas. Espere um pouco e tente de novo.';
  if (code === 'auth/network-request-failed') return 'Sem conexão com o Firebase. Confira a internet.';
  if (code === 'auth/operation-not-allowed') {
    return 'E-mail/senha ainda não está ligado no Firebase. Ative em Authentication.';
  }
  if (code === 'auth/unauthorized-domain') {
    return 'Domínio não autorizado no Firebase. Adicione dubpackstudio.com em Authentication → Settings.';
  }
  return error?.message || 'Não foi possível entrar agora.';
}

async function submitAuth(event) {
  event.preventDefault();
  if (!firebaseAuth) {
    toast('Firebase não carregou. Recarregue a página.');
    return;
  }
  const email = normalizeEmail(els.authEmail?.value);
  const password = String(els.authPassword?.value || '').trim();
  if (!email) {
    toast('Informe o e-mail.');
    return;
  }
  if (!isValidEmail(email)) {
    toast('E-mail incompleto. Use o @, tipo voce@icloud.com.');
    return;
  }
  if (state.authMode === 'reset') {
    setAuthBusy(true);
    try {
      await firebaseAuth.sendPasswordResetEmail(email, {
        url: `${location.origin}${location.pathname}`,
        handleCodeInApp: false
      });
      clearAuthError();
      toast('E-mail enviado. Abra a caixa de entrada e toque no link para criar a senha nova.');
      setAuthMode('login');
    } catch (error) {
      toast(authErrorMessage(error));
    } finally {
      setAuthBusy(false);
    }
    return;
  }
  if (!password || password.length < 6) {
    toast('A senha precisa ter pelo menos 6 caracteres.');
    return;
  }

  setAuthBusy(true);
  try {
    const remember = els.authRememberMe?.checked !== false;
    writeRememberMe(remember);
    await ensureAuthPersistence(remember);
    if (state.authMode === 'signup') {
      const name = String(els.authName?.value || '').trim() || displayNameFromEmail(email);
      const cred = await firebaseAuth.createUserWithEmailAndPassword(email, password);
      await cred.user.updateProfile({ displayName: name });
      const owner = OWNER_EMAILS.includes(email);
      if (!owner) localStorage.setItem(`dubpack-credits:${email}`, '1');
      clearAuthError();
      await finishLogin(accountFromFirebase(cred.user), { signup: true });
      return;
    }

    const cred = await firebaseAuth.signInWithEmailAndPassword(email, password);
    clearAuthError();
    await finishLogin(accountFromFirebase(cred.user));
  } catch (error) {
    if (authErrorMessage(error) === 'wrong-password') {
      showWrongPassword();
    } else {
      const message = authErrorMessage(error);
      if (String(error?.code || '') === 'auth/email-already-in-use') setAuthMode('login');
      if (String(error?.code || '') === 'auth/user-not-found') setAuthMode('signup');
      toast(message);
    }
  } finally {
    setAuthBusy(false);
  }
}

function clearAuthError() {
  els.authError?.classList.add('is-hidden');
  els.authForgotBtn?.classList.remove('is-alert');
  els.authPassword?.classList.remove('is-invalid');
}

function showWrongPassword() {
  setAuthMode('login');
  if (els.authError) {
    els.authError.textContent = 'Senha errada. Toque em Esqueci a senha para receber o e-mail.';
    els.authError.classList.remove('is-hidden');
  }
  els.authPassword?.classList.add('is-invalid');
  els.authForgotBtn?.classList.remove('is-hidden');
  els.authForgotBtn?.classList.add('is-alert');
  toast('Senha errada. Toque em Esqueci a senha para receber o e-mail.');
}

function showPasswordReset() {
  clearAuthError();
  setAuthMode('reset');
  els.authEmail?.focus();
}

async function logoutUser() {
  try {
    if (firebaseAuth) await firebaseAuth.signOut();
  } catch {
    /* ignore */
  }
  localStorage.removeItem(SESSION_USER_KEY);
  state.user = null;
  releasePackSession();
  setAuthMode('login');
  showAuthGate(false);
  applyTab('packs');
  refreshAccountUi();
  toast('Você saiu. Até a próxima dublagem.');
}

function releasePackSession() {
  abortCapture();
  state.packs.forEach((pack) => revokePackMedia(pack));
  state.packs = [];
  state.activePackId = null;
  revokeAllObjectUrls();
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
  return email ? `user:${email}` : 'guest';
}

async function importPack(event) {
  const file = event.target?.files?.[0];
  if (event.target) event.target.value = '';
  if (file) await importPackFile(file);
}

function openImportModal() {
  document.querySelector('#importModal')?.classList.remove('is-hidden');
  document.querySelector('#importProgressWrap')?.classList.add('is-hidden');
}

function closeImportModal() {
  document.querySelector('#importModal')?.classList.add('is-hidden');
}

function setCreateStatus(message) {
  const el = document.querySelector('#createStatus');
  if (el) el.textContent = message || '';
}

function createPackName() {
  const raw = document.querySelector('#createPackName')?.value?.trim();
  return raw || 'meu-pack';
}

function showCreateLanding(show) {
  document.querySelector('#createLanding')?.classList.toggle('is-hidden', !show);
  document.querySelector('#createWorkspace')?.classList.toggle('is-hidden', show);
}

function syncCreateActions() {
  const hasVideo = Boolean(state.create.videoFile);
  const hasLines = state.create.lines.length > 0;
  const confirmed = Boolean(state.create.linesConfirmed);
  const captionsReady = createCaptionsReady();
  const busy = state.create.busy;
  showCreateLanding(!hasVideo);
  document.querySelector('#createDetectBtn')?.toggleAttribute('disabled', !hasVideo || busy);
  document.querySelector('#createMarkStartBtn')?.toggleAttribute('disabled', !hasVideo || busy);
  document.querySelector('#createMarkEndBtn')?.toggleAttribute('disabled', !hasVideo || busy);
  document.querySelector('#createSceneFromPlayheadBtn')?.toggleAttribute('disabled', !hasVideo || busy);
  document.querySelector('#createMarkSceneStartBtn')?.toggleAttribute('disabled', !hasVideo || busy);
  document.querySelector('#createMarkSceneEndBtn')?.toggleAttribute('disabled', !hasVideo || busy);
  document.querySelector('#createDownloadBtn')?.toggleAttribute('disabled', !hasVideo || !captionsReady || busy);
  document.querySelector('#createOpenBtn')?.toggleAttribute('disabled', !hasVideo || !captionsReady || busy);
  document.querySelector('#createAddLineBtn')?.toggleAttribute('disabled', busy || confirmed);
  document.querySelector('#createConfirmLinesBtn')?.toggleAttribute('disabled', !hasLines || busy);
  document.querySelector('#createTranscribeBtn')?.toggleAttribute('disabled', !confirmed || !hasLines || busy);
  document.querySelector('#createVocalsInput')?.toggleAttribute('disabled', !hasVideo || busy);
  document.querySelector('#createVocalsClearBtn')?.toggleAttribute('disabled', !state.create.vocalsBytes || busy);
  document.querySelector('label.create-file-btn')?.classList.toggle('is-disabled', !hasVideo || busy);
  document.querySelector('#createLineForm')?.classList.toggle('is-hidden', confirmed);
  syncCreateVocalsUi();
  syncCreateCaptionsUi();
  syncCreateSceneUi();
}

function createCaptionsReady() {
  if (!state.create.linesConfirmed || !state.create.lines.length) return false;
  return state.create.lines.every((line) => String(line.character || '').trim() && String(line.text || '').trim());
}

function syncCreateCaptionsUi() {
  const hasLines = state.create.lines.length > 0;
  const confirmed = Boolean(state.create.linesConfirmed);
  document.querySelector('#createConfirmBox')?.classList.toggle('is-hidden', !hasLines || confirmed);
  document.querySelector('#createCaptionsBox')?.classList.toggle('is-hidden', !hasLines || !confirmed);
  document.querySelectorAll('#createLangToggle [data-create-lang]').forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.createLang === state.create.lang);
  });
}

function confirmCreateLines() {
  if (!state.create.lines.length) {
    setCreateStatus(t('create.status.needLines'));
    toast(t('create.status.needLines'));
    return;
  }
  state.create.linesConfirmed = true;
  state.create.zipBytes = null;
  // Clear auto placeholders so the user writes real captions.
  state.create.lines = state.create.lines.map((line, index) => {
    const placeholder = t('create.detect.line', { n: index + 1 });
    const charPlaceholder = t('create.character.placeholder');
    const text = String(line.text || '').trim();
    const character = String(line.character || '').trim();
    return {
      ...line,
      text: text && text !== placeholder ? text : '',
      character: character && character !== charPlaceholder ? character : ''
    };
  });
  renderCreateLines();
  setCreateStatus(t('create.confirm.done'));
  toast(t('create.confirm.done'));
}

function unconfirmCreateLines() {
  state.create.linesConfirmed = false;
  state.create.zipBytes = null;
  renderCreateLines();
  setCreateStatus(t('create.confirm.editDone'));
}

function setCreatePackLang(lang) {
  const next = lang === 'en' ? 'en' : 'pt';
  if (state.create.lang === next) return;
  state.create.lang = next;
  state.create.zipBytes = null;
  syncCreateCaptionsUi();
  setCreateStatus(t(next === 'en' ? 'create.lang.en' : 'create.lang.pt'));
}

function updateCreateLineField(id, field, value) {
  const line = state.create.lines.find((item) => item.id === id);
  if (!line || (field !== 'character' && field !== 'text')) return;
  line[field] = value;
  state.create.zipBytes = null;
  syncCreateActions();
}

function whisperLangCode() {
  return state.create.lang === 'en' ? 'english' : 'portuguese';
}

async function getCreateWhisperTranscriber(onProgress) {
  if (createWhisperTranscriber) return createWhisperTranscriber;
  if (!createWhisperLoadPromise) {
    createWhisperLoadPromise = (async () => {
      const { pipeline, env } = await import(/* webpackIgnore: true */ CREATE_WHISPER_CDN);
      env.allowLocalModels = false;
      env.useBrowserCache = true;
      const transcriber = await pipeline('automatic-speech-recognition', CREATE_WHISPER_MODEL, {
        progress_callback: (data) => {
          if (!onProgress) return;
          if (data.status === 'progress' || data.status === 'download') {
            onProgress(Math.round(data.progress || 0));
          }
        }
      });
      createWhisperTranscriber = transcriber;
      return transcriber;
    })();
  }
  return createWhisperLoadPromise;
}

async function resampleCreateAudioTo16k(audioSlice) {
  const WHISPER_RATE = 16000;
  const inRate = audioSlice.sampleRate;
  const data = audioSlice.getChannelData(0);
  if (inRate === WHISPER_RATE) return data;
  const duration = data.length / inRate;
  const offline = new OfflineAudioContext(1, Math.ceil(duration * WHISPER_RATE), WHISPER_RATE);
  const buffer = offline.createBuffer(1, data.length, inRate);
  buffer.copyToChannel(data, 0);
  const source = offline.createBufferSource();
  source.buffer = buffer;
  source.connect(offline.destination);
  source.start(0);
  const rendered = await offline.startRendering();
  return rendered.getChannelData(0);
}

function normalizeWhisperText(result) {
  if (!result) return '';
  if (typeof result === 'string') return result.trim();
  if (typeof result.text === 'string') return result.text.trim();
  if (Array.isArray(result.chunks)) {
    return result.chunks.map((chunk) => chunk?.text || '').join(' ').trim();
  }
  return '';
}

async function transcribeCreateCaptions() {
  if (state.create.busy) return;
  if (!state.create.linesConfirmed || !state.create.lines.length) {
    setCreateStatus(t('create.status.needConfirm'));
    toast(t('create.status.needConfirm'));
    return;
  }

  state.create.busy = true;
  state.create.whisperBusy = true;
  syncCreateActions();
  setCreateStatus(t('create.whisper.loading'));
  try {
    const transcriber = await getCreateWhisperTranscriber((pct) => {
      setCreateStatus(t('create.whisper.download', { pct }));
    });
    const fullAudio = await decodeCreateAudioBuffer();
    const language = whisperLangCode();
    const total = state.create.lines.length;

    for (let index = 0; index < total; index += 1) {
      const line = state.create.lines[index];
      setCreateStatus(t('create.whisper.line', { n: index + 1, total }));
      await wait(16);
      const slice = sliceAudioBufferWindow(fullAudio, line.start, line.end);
      const pcm = await resampleCreateAudioTo16k(slice);
      if (pcm.length < 800) {
        line.text = '';
        continue;
      }
      const result = await transcriber(pcm, {
        language,
        task: 'transcribe',
        return_timestamps: false
      });
      line.text = normalizeWhisperText(result);
    }

    state.create.zipBytes = null;
    renderCreateLines();
    setCreateStatus(t('create.whisper.done'));
    toast(t('create.whisper.done'));
  } catch (error) {
    console.error('Whisper transcription failed:', error);
    setCreateStatus(t('create.whisper.fail'));
    toast(t('create.whisper.fail'));
  } finally {
    state.create.busy = false;
    state.create.whisperBusy = false;
    syncCreateActions();
  }
}

function createVideoDuration() {
  const video = document.querySelector('#createVideo');
  const duration = Number(video?.duration);
  return Number.isFinite(duration) && duration > 0 ? duration : 0;
}

function getCreateSceneWindow() {
  const duration = createVideoDuration();
  let start = Number(state.create.sceneStart) || 0;
  let end = Number(state.create.sceneEnd) || 0;
  if (duration) {
    start = Math.max(0, Math.min(start, duration));
    end = Math.max(0, Math.min(end, duration));
  }
  if (end <= start) end = Math.min((duration || CREATE_SCENE_MAX_SEC), start + Math.min(CREATE_SCENE_MAX_SEC, 1));
  if (end - start > CREATE_SCENE_MAX_SEC) end = start + CREATE_SCENE_MAX_SEC;
  return { start, end, duration };
}

function syncCreateSceneUi(toastIfClamped = false) {
  const requestedStart = Number(document.querySelector('#createSceneStart')?.value);
  const requestedEnd = Number(document.querySelector('#createSceneEnd')?.value);
  const requestedLen = (Number.isFinite(requestedEnd) && Number.isFinite(requestedStart))
    ? requestedEnd - requestedStart
    : 0;
  const { start, end } = getCreateSceneWindow();
  state.create.sceneStart = start;
  state.create.sceneEnd = end;
  const startInput = document.querySelector('#createSceneStart');
  const endInput = document.querySelector('#createSceneEnd');
  if (startInput) startInput.value = start.toFixed(2);
  if (endInput) endInput.value = end.toFixed(2);
  const lengthEl = document.querySelector('#createSceneLength');
  if (lengthEl) {
    lengthEl.textContent = t('create.scene.length', {
      current: formatSeconds(end - start),
      max: formatSeconds(CREATE_SCENE_MAX_SEC)
    });
  }
  const startLabel = document.querySelector('#createScrubStartLabel');
  const endLabel = document.querySelector('#createScrubEndLabel');
  if (startLabel) startLabel.textContent = formatSeconds(start);
  if (endLabel) endLabel.textContent = formatSeconds(end);
  updateCreateSceneScrub();
  if (toastIfClamped && requestedLen > CREATE_SCENE_MAX_SEC + 0.01) {
    toast(t('create.scene.tooLong'));
    setCreateStatus(t('create.scene.tooLong'));
  }
}

function updateCreateSceneScrub() {
  const duration = createVideoDuration() || Math.max(state.create.sceneEnd, CREATE_SCENE_MAX_SEC);
  const { start, end } = getCreateSceneWindow();
  const left = (start / duration) * 100;
  const width = ((end - start) / duration) * 100;
  const selection = document.querySelector('#createScrubSelection');
  const handleStart = document.querySelector('#createScrubStart');
  const handleEnd = document.querySelector('#createScrubEnd');
  if (selection) {
    selection.style.left = `${left}%`;
    selection.style.width = `${Math.max(1.5, width)}%`;
  }
  if (handleStart) handleStart.style.left = `${left}%`;
  if (handleEnd) handleEnd.style.left = `${(end / duration) * 100}%`;
  updateCreateScrubPlayhead();
}

function updateCreateScrubPlayhead() {
  const video = document.querySelector('#createVideo');
  const playhead = document.querySelector('#createScrubPlayhead');
  const duration = createVideoDuration();
  if (!playhead || !duration) return;
  const time = Number(video?.currentTime || 0);
  playhead.style.left = `${Math.max(0, Math.min(100, (time / duration) * 100))}%`;
}

function bindCreateSceneScrub() {
  const track = document.querySelector('#createScrubTrack');
  if (!track || track.dataset.bound === '1') return;
  track.dataset.bound = '1';
  let mode = null;
  let dragOffset = 0;

  const timeFromClientX = (clientX) => {
    const rect = track.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / Math.max(1, rect.width)));
    const duration = createVideoDuration() || CREATE_SCENE_MAX_SEC;
    return ratio * duration;
  };

  const applyWindow = (start, end, { seek = false } = {}) => {
    const duration = createVideoDuration() || CREATE_SCENE_MAX_SEC;
    let nextStart = Math.max(0, Math.min(start, duration));
    let nextEnd = Math.max(0, Math.min(end, duration));
    if (nextEnd <= nextStart) nextEnd = Math.min(duration, nextStart + 0.5);
    if (nextEnd - nextStart > CREATE_SCENE_MAX_SEC) {
      if (mode === 'end' || mode === 'start') {
        if (mode === 'start') nextEnd = nextStart + CREATE_SCENE_MAX_SEC;
        else nextStart = nextEnd - CREATE_SCENE_MAX_SEC;
      } else {
        nextEnd = nextStart + CREATE_SCENE_MAX_SEC;
      }
      nextStart = Math.max(0, nextStart);
      nextEnd = Math.min(duration, nextEnd);
      if (nextEnd - nextStart > CREATE_SCENE_MAX_SEC) {
        nextEnd = nextStart + CREATE_SCENE_MAX_SEC;
      }
    }
    state.create.sceneStart = nextStart;
    state.create.sceneEnd = nextEnd;
    state.create.zipBytes = null;
    const startInput = document.querySelector('#createSceneStart');
    const endInput = document.querySelector('#createSceneEnd');
    if (startInput) startInput.value = nextStart.toFixed(2);
    if (endInput) endInput.value = nextEnd.toFixed(2);
    syncCreateSceneUi(false);
    if (seek) {
      const video = document.querySelector('#createVideo');
      if (video) {
        const target = mode === 'end' ? nextEnd : mode === 'move' ? (nextStart + nextEnd) / 2 : nextStart;
        video.currentTime = target;
      }
    }
  };

  const onPointerMove = (event) => {
    if (!mode) return;
    const time = timeFromClientX(event.clientX);
    const { start, end } = getCreateSceneWindow();
    if (mode === 'start') applyWindow(time, end, { seek: true });
    else if (mode === 'end') applyWindow(start, time, { seek: true });
    else if (mode === 'move') {
      const span = end - start;
      const nextStart = time - dragOffset;
      applyWindow(nextStart, nextStart + span, { seek: true });
    }
  };

  const onPointerUp = () => {
    mode = null;
    document.querySelector('#createScrubSelection')?.classList.remove('is-dragging');
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
  };

  const startDrag = (nextMode, event) => {
    if (!state.create.videoFile || state.create.busy) return;
    event.preventDefault();
    mode = nextMode;
    if (nextMode === 'move') {
      const time = timeFromClientX(event.clientX);
      dragOffset = time - getCreateSceneWindow().start;
      document.querySelector('#createScrubSelection')?.classList.add('is-dragging');
    }
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  document.querySelector('#createScrubStart')?.addEventListener('pointerdown', (event) => startDrag('start', event));
  document.querySelector('#createScrubEnd')?.addEventListener('pointerdown', (event) => startDrag('end', event));
  document.querySelector('#createScrubSelection')?.addEventListener('pointerdown', (event) => {
    if (event.target.closest('.create-scrub-handle')) return;
    startDrag('move', event);
  });

  document.querySelector('#createVideo')?.addEventListener('timeupdate', updateCreateScrubPlayhead);
  document.querySelector('#createVideo')?.addEventListener('seeked', updateCreateScrubPlayhead);
}

function onCreateSceneInputsChanged() {
  state.create.sceneStart = Number(document.querySelector('#createSceneStart')?.value || 0);
  state.create.sceneEnd = Number(document.querySelector('#createSceneEnd')?.value || 0);
  syncCreateSceneUi(true);
  state.create.zipBytes = null;
}

function markCreateSceneBoundary(which) {
  const video = document.querySelector('#createVideo');
  if (!video?.src) {
    setCreateStatus(t('create.status.needVideo'));
    return;
  }
  const time = Number(video.currentTime || 0);
  if (which === 'start') {
    state.create.sceneStart = time;
    state.create.sceneEnd = Math.min(createVideoDuration() || time + CREATE_SCENE_MAX_SEC, time + CREATE_SCENE_MAX_SEC);
  } else {
    state.create.sceneEnd = time;
    if (state.create.sceneEnd - state.create.sceneStart > CREATE_SCENE_MAX_SEC) {
      state.create.sceneStart = Math.max(0, state.create.sceneEnd - CREATE_SCENE_MAX_SEC);
    }
  }
  syncCreateSceneUi(true);
  state.create.zipBytes = null;
}

function setCreateSceneFromPlayhead() {
  const video = document.querySelector('#createVideo');
  if (!video?.src) {
    setCreateStatus(t('create.status.needVideo'));
    return;
  }
  const start = Number(video.currentTime || 0);
  const duration = createVideoDuration();
  state.create.sceneStart = start;
  state.create.sceneEnd = Math.min(duration || start + CREATE_SCENE_MAX_SEC, start + CREATE_SCENE_MAX_SEC);
  syncCreateSceneUi(true);
  state.create.zipBytes = null;
}

function renderCreateLines() {
  const list = document.querySelector('#createLineList');
  const empty = document.querySelector('#createLinesEmpty');
  const count = document.querySelector('#createLineCount');
  if (!list) return;
  list.replaceChildren();
  const confirmed = Boolean(state.create.linesConfirmed);
  state.create.lines.forEach((line, index) => {
    const item = document.createElement('li');
    item.className = `create-line-item${confirmed ? ' is-captioning' : ''}`;
    const playing = state.create.previewLineId === line.id;
    if (confirmed) {
      item.innerHTML = `
        <div class="create-line-main">
          <button type="button" class="create-play-btn ${playing ? 'is-playing' : ''}" data-create-play="${line.id}" aria-label="${playing ? t('create.stop') : t('create.play')}">
            ${playing ? '⏹' : '▶'}
          </button>
          <div class="create-line-caption-fields">
            <span class="create-line-index">${index + 1}. ${formatSeconds(line.start)} → ${formatSeconds(line.end)}</span>
            <label class="create-field">
              <span>${t('create.character')}</span>
              <input type="text" maxlength="60" data-create-line="${line.id}" data-create-field="character" value="${escapeHtml(line.character)}" placeholder="${escapeHtml(t('create.character.placeholder'))}" />
            </label>
            <label class="create-field create-field-wide">
              <span>${t('create.text')}</span>
              <textarea rows="2" maxlength="500" data-create-line="${line.id}" data-create-field="text" placeholder="${escapeHtml(t('create.text.placeholder'))}">${escapeHtml(line.text)}</textarea>
            </label>
          </div>
        </div>
        <div class="create-line-actions">
          <button type="button" class="secondary create-play-text" data-create-play="${line.id}">${playing ? t('create.stop') : t('create.play')}</button>
          <button type="button" class="ghost" data-create-remove="${line.id}">${t('create.remove')}</button>
        </div>
      `;
    } else {
      item.innerHTML = `
        <div class="create-line-main">
          <button type="button" class="create-play-btn ${playing ? 'is-playing' : ''}" data-create-play="${line.id}" aria-label="${playing ? t('create.stop') : t('create.play')}">
            ${playing ? '⏹' : '▶'}
          </button>
          <div>
            <strong>${index + 1}. ${escapeHtml(line.character || t('create.character.placeholder'))}</strong>
            <p>${escapeHtml(line.text || t('create.detect.line', { n: index + 1 }))}</p>
            <small>${formatSeconds(line.start)} → ${formatSeconds(line.end)} · ${formatSeconds(line.end - line.start)}</small>
          </div>
        </div>
        <div class="create-line-actions">
          <button type="button" class="secondary create-play-text" data-create-play="${line.id}">${playing ? t('create.stop') : t('create.play')}</button>
          <button type="button" class="ghost" data-create-remove="${line.id}">${t('create.remove')}</button>
        </div>
      `;
    }
    list.appendChild(item);
  });
  if (empty) empty.hidden = state.create.lines.length > 0;
  if (count) count.textContent = t('create.lines.count', { n: state.create.lines.length });
  syncCreateActions();
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function onCreateVideoPicked(event) {
  const file = event.target.files?.[0];
  if (event.target) event.target.value = '';
  if (file) await handleCreateIncomingFile(file);
}

async function onCreateZipPicked(event) {
  const file = event.target.files?.[0];
  if (event.target) event.target.value = '';
  if (file) await handleCreateIncomingFile(file);
}

async function handleCreateIncomingFile(file) {
  if (!file) return;
  const name = String(file.name || '').toLowerCase();
  const isZip = name.endsWith('.zip') || file.type === 'application/zip' || file.type === 'application/x-zip-compressed';
  const isVideo = VIDEO_EXTS.some((ext) => name.endsWith(`.${ext}`)) || String(file.type || '').startsWith('video/');
  if (isZip) {
    await importPackFile(file);
    return;
  }
  if (isVideo) {
    await loadCreateVideo(file);
    return;
  }
  setCreateStatus(t('create.status.badFile'));
  toast(t('create.status.badFile'));
}

async function loadCreateVideo(file) {
  stopCreatePreview();
  if (state.create.videoUrl) URL.revokeObjectURL(state.create.videoUrl);
  state.create.videoFile = file;
  state.create.videoBytes = new Uint8Array(await file.arrayBuffer());
  state.create.videoUrl = URL.createObjectURL(file);
  state.create.zipBytes = null;
  state.create.lines = [];
  state.create.linesConfirmed = false;
  clearCreateVocals({ silent: true });
  const video = document.querySelector('#createVideo');
  if (video) {
    video.src = state.create.videoUrl;
    video.load();
    await new Promise((resolve) => {
      const done = () => {
        video.removeEventListener('loadedmetadata', done);
        resolve();
      };
      video.addEventListener('loadedmetadata', done);
      if (video.readyState >= 1) done();
    });
  }
  const duration = createVideoDuration();
  state.create.sceneStart = 0;
  state.create.sceneEnd = Math.min(CREATE_SCENE_MAX_SEC, duration || CREATE_SCENE_MAX_SEC);
  syncCreateSceneUi(false);
  const title = document.querySelector('#createWorkspaceTitle');
  if (title) title.textContent = file.name.replace(/\.[^.]+$/, '');
  const meta = document.querySelector('#createVideoMeta');
  if (meta) {
    meta.textContent = t('create.video.ready', {
      name: file.name,
      duration: formatSeconds(duration || 0)
    });
  }
  const nameInput = document.querySelector('#createPackName');
  if (nameInput && !nameInput.value.trim()) {
    nameInput.value = file.name.replace(/\.[^.]+$/, '');
  }
  const lineStart = document.querySelector('#createStart');
  const lineEnd = document.querySelector('#createEnd');
  if (lineStart) lineStart.value = state.create.sceneStart.toFixed(2);
  if (lineEnd) lineEnd.value = Math.min(state.create.sceneStart + 1, state.create.sceneEnd).toFixed(2);
  renderCreateLines();
  syncCreateActions();
  setCreateStatus('');
  setTab('create');
}

function markCreateTime(which) {
  const video = document.querySelector('#createVideo');
  if (!video?.src) {
    setCreateStatus(t('create.status.needVideo'));
    return;
  }
  const { start: sceneStart, end: sceneEnd } = getCreateSceneWindow();
  let value = Number(video.currentTime || 0);
  value = Math.max(sceneStart, Math.min(sceneEnd, value));
  const input = document.querySelector(which === 'end' ? '#createEnd' : '#createStart');
  if (input) input.value = value.toFixed(2);
}

function stopCreatePreview() {
  if (state.create.previewTimer) {
    clearTimeout(state.create.previewTimer);
    state.create.previewTimer = 0;
  }
  const video = document.querySelector('#createVideo');
  if (video && state.create.previewOnTimeUpdate) {
    video.removeEventListener('timeupdate', state.create.previewOnTimeUpdate);
    state.create.previewOnTimeUpdate = null;
  }
  state.create.previewLineId = null;
  if (video && !video.paused) video.pause();
}

function sliceAudioBufferWindow(audioBuffer, startSec, endSec) {
  const sampleRate = audioBuffer.sampleRate;
  const mono = mixAudioBufferMono(audioBuffer);
  const start = Math.max(0, Math.floor(startSec * sampleRate));
  const end = Math.min(mono.length, Math.floor(endSec * sampleRate));
  const length = Math.max(1, end - start);
  const data = mono.subarray(start, end);
  return {
    sampleRate,
    length,
    duration: length / sampleRate,
    numberOfChannels: 1,
    getChannelData: () => data
  };
}

async function decodeCreateAudioBuffer() {
  const sourceBytes = state.create.vocalsBytes?.length
    ? state.create.vocalsBytes
    : state.create.videoBytes;
  if (!sourceBytes?.length) {
    throw new Error(t('create.status.needVideo'));
  }
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  try {
    const copy = sourceBytes.buffer.slice(
      sourceBytes.byteOffset,
      sourceBytes.byteOffset + sourceBytes.byteLength
    );
    return await ctx.decodeAudioData(copy);
  } catch {
    await ctx.close().catch(() => undefined);
    throw new Error(state.create.vocalsBytes?.length ? t('create.vocals.fail') : t('create.detect.fail'));
  } finally {
    if (ctx.state !== 'closed') await ctx.close().catch(() => undefined);
  }
}

function syncCreateVocalsUi() {
  const meta = document.querySelector('#createVocalsMeta');
  if (!meta) return;
  if (state.create.vocalsBytes?.length) {
    meta.textContent = t('create.vocals.ready', { name: state.create.vocalsName || 'vocals' });
    return;
  }
  meta.textContent = t('create.vocals.empty');
}

async function onCreateVocalsPicked(event) {
  const file = event.target?.files?.[0];
  event.target.value = '';
  if (!file) return;
  if (!state.create.videoFile) {
    setCreateStatus(t('create.status.needVideo'));
    toast(t('create.status.needVideo'));
    return;
  }
  const name = String(file.name || '').toLowerCase();
  const type = String(file.type || '').toLowerCase();
  const ok = type.startsWith('audio/')
    || /\.(wav|mp3|flac|m4a|ogg|aac|wma|aiff|aif)$/i.test(name);
  if (!ok) {
    setCreateStatus(t('create.vocals.badFile'));
    toast(t('create.vocals.badFile'));
    return;
  }
  try {
    state.create.busy = true;
    syncCreateActions();
    setCreateStatus(t('create.vocals.loading'));
    const bytes = new Uint8Array(await file.arrayBuffer());
    // Decode once to validate browser support before locking it in.
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    try {
      const copy = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
      await ctx.decodeAudioData(copy);
    } finally {
      if (ctx.state !== 'closed') await ctx.close().catch(() => undefined);
    }
    state.create.vocalsFile = file;
    state.create.vocalsBytes = bytes;
    state.create.vocalsName = file.name;
    state.create.zipBytes = null;
    syncCreateVocalsUi();
    setCreateStatus(t('create.vocals.ready', { name: file.name }));
    toast(t('create.vocals.ready', { name: file.name }));
  } catch {
    clearCreateVocals({ silent: true });
    setCreateStatus(t('create.vocals.fail'));
    toast(t('create.vocals.fail'));
  } finally {
    state.create.busy = false;
    syncCreateActions();
  }
}

function clearCreateVocals({ silent = false } = {}) {
  state.create.vocalsFile = null;
  state.create.vocalsBytes = null;
  state.create.vocalsName = '';
  syncCreateVocalsUi();
  if (!silent) {
    setCreateStatus(t('create.vocals.cleared'));
    toast(t('create.vocals.cleared'));
  }
  syncCreateActions();
}

function mixAudioBufferMono(audioBuffer) {
  const length = audioBuffer.length;
  if (audioBuffer.numberOfChannels === 1) return audioBuffer.getChannelData(0);
  const mixed = new Float32Array(length);
  const channels = audioBuffer.numberOfChannels;
  for (let c = 0; c < channels; c += 1) {
    const data = audioBuffer.getChannelData(c);
    for (let i = 0; i < length; i += 1) mixed[i] += data[i] / channels;
  }
  return mixed;
}

function onePoleHighpass(data, sampleRate, cutoffHz) {
  const rc = 1 / (2 * Math.PI * cutoffHz);
  const dt = 1 / sampleRate;
  const alpha = rc / (rc + dt);
  const out = new Float32Array(data.length);
  let prevX = 0;
  let prevY = 0;
  for (let i = 0; i < data.length; i += 1) {
    const x = data[i];
    const y = alpha * (prevY + x - prevX);
    out[i] = y;
    prevX = x;
    prevY = y;
  }
  return out;
}

function onePoleLowpass(data, sampleRate, cutoffHz) {
  const rc = 1 / (2 * Math.PI * cutoffHz);
  const dt = 1 / sampleRate;
  const alpha = dt / (rc + dt);
  const out = new Float32Array(data.length);
  let prev = 0;
  for (let i = 0; i < data.length; i += 1) {
    prev += alpha * (data[i] - prev);
    out[i] = prev;
  }
  return out;
}

function framePitchStrength(frame, sampleRate) {
  const minLag = Math.max(2, Math.floor(sampleRate / 320));
  const maxLag = Math.min(frame.length - 2, Math.floor(sampleRate / 75));
  if (maxLag <= minLag) return 0;
  let energy = 0;
  for (let i = 0; i < frame.length; i += 1) energy += frame[i] * frame[i];
  if (energy < 1e-8) return 0;
  let best = 0;
  for (let lag = minLag; lag <= maxLag; lag += 1) {
    let corr = 0;
    const limit = frame.length - lag;
    for (let i = 0; i < limit; i += 1) corr += frame[i] * frame[i + lag];
    best = Math.max(best, corr / energy);
  }
  return best;
}

function mergeFrameRanges(ranges, gapFrames) {
  const merged = [];
  ranges.forEach(([from, to]) => {
    if (!merged.length) {
      merged.push([from, to]);
      return;
    }
    const last = merged[merged.length - 1];
    if (from - last[1] <= gapFrames) last[1] = to;
    else merged.push([from, to]);
  });
  return merged;
}

/** Split oversized dialogue into dub-friendly takes at the quietest natural pauses. */
function splitLongSpeechRanges(ranges, {
  scores,
  active,
  frameDur,
  maxLineSec = 8.5,
  targetLineSec = 5.5,
  minSpeechSec = 0.55
} = {}) {
  const maxFrames = Math.max(2, Math.ceil(maxLineSec / frameDur));
  const targetFrames = Math.max(2, Math.ceil(targetLineSec / frameDur));
  const minFrames = Math.max(1, Math.ceil(minSpeechSec / frameDur));
  const out = [];

  ranges.forEach(([from, to]) => {
    let cursor = from;
    while (to - cursor > maxFrames) {
      const searchStart = cursor + minFrames;
      const searchEnd = Math.min(cursor + maxFrames, to - minFrames);
      if (searchEnd <= searchStart) {
        const hard = Math.min(to - minFrames, cursor + targetFrames);
        out.push([cursor, hard]);
        cursor = hard;
        continue;
      }

      const ideal = Math.min(searchEnd, Math.max(searchStart, cursor + targetFrames));
      let bestAt = ideal;
      let bestScore = -Infinity;

      for (let i = searchStart; i <= searchEnd; i += 1) {
        const rms = scores[i]?.rms || 0;
        const quiet = !active[i];
        // Look a little around i to prefer real pauses, not single soft frames.
        let valley = rms;
        let quietRun = quiet ? 1 : 0;
        for (let k = Math.max(searchStart, i - 2); k <= Math.min(searchEnd, i + 2); k += 1) {
          valley = Math.min(valley, scores[k]?.rms || 0);
          if (!active[k]) quietRun += 1;
        }
        const nearIdeal = 1 - (Math.abs(i - ideal) / Math.max(1, maxFrames));
        const score = (quiet ? 2.4 : 0) + quietRun * 0.35 + nearIdeal * 1.6 - valley * 40;
        if (score > bestScore) {
          bestScore = score;
          bestAt = i;
        }
      }

      out.push([cursor, bestAt]);
      cursor = bestAt;
    }
    if (to - cursor >= minFrames) out.push([cursor, to]);
    else if (out.length) out[out.length - 1][1] = to;
    else out.push([from, to]);
  });

  return out;
}

function detectSpeechSegments(audioBuffer, {
  frameMs = 25,
  minSpeechSec = 0.55,
  mergeGapSec = 1.05,
  phraseGapSec = 1.6,
  maxLineSec = 8.5,
  targetLineSec = 5.5,
  padSec = 0.18,
  maxClips = 24
} = {}) {
  const sampleRate = audioBuffer.sampleRate;
  const raw = mixAudioBufferMono(audioBuffer);
  const speechBand = onePoleLowpass(onePoleHighpass(raw, sampleRate, 100), sampleRate, 3800);
  const lowBand = onePoleLowpass(raw, sampleRate, 160);
  const frameSize = Math.max(1, Math.round(sampleRate * frameMs / 1000));
  const hop = frameSize;
  const scores = [];

  for (let i = 0; i < speechBand.length; i += hop) {
    const end = Math.min(speechBand.length, i + frameSize);
    const size = Math.max(1, end - i);
    let speechEnergy = 0;
    let fullEnergy = 0;
    let lowEnergy = 0;
    let zc = 0;
    let prev = speechBand[i] || 0;
    for (let j = i; j < end; j += 1) {
      const sample = speechBand[j];
      const full = raw[j] || 0;
      const low = lowBand[j] || 0;
      speechEnergy += sample * sample;
      fullEnergy += full * full;
      lowEnergy += low * low;
      if ((prev >= 0 && sample < 0) || (prev < 0 && sample >= 0)) zc += 1;
      prev = sample;
    }
    const rms = Math.sqrt(speechEnergy / size);
    const fullRms = Math.sqrt(fullEnergy / size) + 1e-9;
    const lowRms = Math.sqrt(lowEnergy / size);
    const bandRatio = rms / fullRms;
    const lowRatio = lowRms / fullRms;
    const zcr = zc / size;
    const pitch = framePitchStrength(speechBand.subarray(i, end), sampleRate);
    const prevScore = scores[scores.length - 1];
    const pitchDelta = prevScore ? Math.abs(pitch - prevScore.pitch) : 0;
    const rmsDelta = prevScore ? Math.abs(rms - prevScore.rms) : 0;
    scores.push({ rms, pitch, bandRatio, lowRatio, zcr, pitchDelta, rmsDelta });
  }

  if (!scores.length) return [];

  const allRms = scores.map((item) => item.rms).sort((a, b) => a - b);
  const noise = allRms[Math.floor(allRms.length * 0.15)] || 0;
  const peak = allRms[Math.floor(allRms.length * 0.9)] || 0;
  const energyGate = Math.max(0.0015, noise + (peak - noise) * 0.18);

  // Pass 1: any active speech-band energy (dialogue OR music). Soft on purpose.
  const active = scores.map((item) => item.rms >= energyGate && item.bandRatio >= 0.22);

  const rawRanges = [];
  let rangeStart = null;
  for (let i = 0; i < active.length; i += 1) {
    if (active[i] && rangeStart == null) rangeStart = i;
    if (!active[i] && rangeStart != null) {
      rawRanges.push([rangeStart, i]);
      rangeStart = null;
    }
  }
  if (rangeStart != null) rawRanges.push([rangeStart, active.length]);

  const frameDur = hop / sampleRate;
  // Keep tiny word blips so they can glue into a full phrase; drop them only after merge.
  const seedMinFrames = Math.max(1, Math.ceil(0.12 / frameDur));
  const minFrames = Math.max(1, Math.ceil(minSpeechSec / frameDur));
  const mergeGapFrames = Math.max(1, Math.ceil(mergeGapSec / frameDur));
  const phraseGapFrames = Math.max(mergeGapFrames, Math.ceil(phraseGapSec / frameDur));
  const seeded = rawRanges.filter(([from, to]) => to - from >= seedMinFrames);
  const merged = mergeFrameRanges(seeded, mergeGapFrames).filter(([from, to]) => to - from >= minFrames);

  // Pass 2: score each chunk — higher = more spoken-like, lower = soundtrack-like.
  const ranked = merged.map(([from, to]) => {
    const slice = scores.slice(from, to);
    const n = Math.max(1, slice.length);
    const avgPitch = slice.reduce((sum, item) => sum + item.pitch, 0) / n;
    const avgRms = slice.reduce((sum, item) => sum + item.rms, 0) / n;
    const avgLow = slice.reduce((sum, item) => sum + item.lowRatio, 0) / n;
    const avgBand = slice.reduce((sum, item) => sum + item.bandRatio, 0) / n;
    const avgZcr = slice.reduce((sum, item) => sum + item.zcr, 0) / n;
    const pitchStd = Math.sqrt(slice.reduce((sum, item) => sum + ((item.pitch - avgPitch) ** 2), 0) / n);
    const rmsStd = Math.sqrt(slice.reduce((sum, item) => sum + ((item.rms - avgRms) ** 2), 0) / n);
    const rmsCv = rmsStd / (avgRms + 1e-9);
    let transitions = 0;
    for (let i = from + 1; i < to; i += 1) {
      if (active[i] !== active[i - 1]) transitions += 1;
    }
    const transitionsPerSec = transitions / Math.max(0.2, (to - from) * frameDur);
    const musicPenalty = (
      (avgLow > 0.58 ? 1.2 : 0)
      + (pitchStd < 0.035 ? 1.1 : 0)
      + (rmsCv < 0.2 ? 1.0 : 0)
      + (transitionsPerSec < 0.8 ? 0.8 : 0)
      + (avgZcr < 0.015 ? 0.7 : 0)
    );
    const speechBonus = (
      pitchStd * 5
      + rmsCv * 2.8
      + transitionsPerSec * 1.1
      + Math.min(0.7, avgBand) * 1.2
      + (avgPitch > 0.15 && avgPitch < 0.85 ? 0.6 : 0)
    );
    const score = speechBonus - musicPenalty;
    return { from, to, score, musicPenalty, pitchStd, rmsCv };
  });

  ranked.sort((a, b) => b.score - a.score);

  // Prefer spoken-like chunks; if none clear, still return the least "music-like" actives
  // so the UI never goes empty when there is real audio in the scene.
  let chosen = ranked.filter((item) => item.score >= 0.55 && item.musicPenalty < 3.2);
  if (!chosen.length) {
    chosen = ranked.filter((item) => item.score >= 0.15).slice(0, Math.min(8, maxClips));
  }
  if (!chosen.length) {
    chosen = ranked.slice(0, Math.min(6, maxClips));
  }

  // Pass 3: stitch adjacent spoken chunks into complete dialogue turns.
  const ordered = chosen
    .slice(0, maxClips)
    .sort((a, b) => a.from - b.from);
  const phrases = [];
  ordered.forEach((item) => {
    if (!phrases.length) {
      phrases.push({ ...item });
      return;
    }
    const last = phrases[phrases.length - 1];
    if (item.from - last.to <= phraseGapFrames) {
      last.to = item.to;
      last.score = Math.max(last.score, item.score);
      last.musicPenalty = Math.min(last.musicPenalty, item.musicPenalty);
      return;
    }
    phrases.push({ ...item });
  });

  // Pass 4: long monologues are hard to dub in-game — cut at natural pauses.
  const dubSized = splitLongSpeechRanges(phrases.map((item) => [item.from, item.to]), {
    scores,
    active,
    frameDur,
    maxLineSec,
    targetLineSec,
    minSpeechSec
  }).map(([from, to]) => {
    const source = phrases.find((item) => from >= item.from && to <= item.to) || phrases[0];
    return {
      from,
      to,
      score: source?.score ?? 0,
      musicPenalty: source?.musicPenalty ?? 0
    };
  });

  const duration = Number(audioBuffer.duration) || (raw.length / sampleRate);
  return dubSized
    .slice(0, maxClips)
    .map(({ from, to }) => ({
      start: Math.max(0, from * frameDur - padSec),
      end: Math.min(duration, to * frameDur + padSec)
    }))
    .filter((segment) => segment.end - segment.start >= minSpeechSec * 0.85);
}

async function detectCreateSpeechLines() {
  if (state.create.busy) return;
  if (!state.create.videoFile) {
    setCreateStatus(t('create.status.needVideo'));
    toast(t('create.status.needVideo'));
    return;
  }

  syncCreateSceneUi(true);
  const { start: sceneStart, end: sceneEnd } = getCreateSceneWindow();
  state.create.busy = true;
  syncCreateActions();
  setCreateStatus(t('create.detect.working'));
  try {
    await wait(30);
    const audioBuffer = await decodeCreateAudioBuffer();
    const windowBuffer = sliceAudioBufferWindow(audioBuffer, sceneStart, sceneEnd);
    const segments = detectSpeechSegments(windowBuffer, {
      minSpeechSec: 0.55,
      mergeGapSec: 1.05,
      phraseGapSec: 1.6,
      maxLineSec: 8.5,
      targetLineSec: 5.5,
      padSec: 0.18,
      maxClips: 24
    });
    if (!segments.length) {
      setCreateStatus(t('create.detect.none'));
      toast(t('create.detect.none'));
      return;
    }
    state.create.lines = segments.map((segment, index) => ({
      id: crypto.randomUUID ? crypto.randomUUID() : `line-${Date.now()}-${index}`,
      character: t('create.character.placeholder'),
      text: t('create.detect.line', { n: index + 1 }),
      start: Number((sceneStart + segment.start).toFixed(2)),
      end: Number((sceneStart + segment.end).toFixed(2))
    }));
    state.create.linesConfirmed = false;
    state.create.zipBytes = null;
    stopCreatePreview();
    renderCreateLines();
    const doneKey = state.create.vocalsBytes?.length ? 'create.detect.doneVocals' : 'create.detect.done';
    setCreateStatus(t(doneKey, { n: segments.length }));
    toast(t(doneKey, { n: segments.length }));
  } catch (error) {
    setCreateStatus(error.message || t('create.detect.fail'));
    toast(error.message || t('create.detect.fail'));
  } finally {
    state.create.busy = false;
    syncCreateActions();
  }
}

function addCreateLine() {
  const character = document.querySelector('#createCharacter')?.value?.trim() || '';
  const text = document.querySelector('#createText')?.value?.trim() || '';
  let start = Number(document.querySelector('#createStart')?.value || 0);
  let end = Number(document.querySelector('#createEnd')?.value || 0);
  const { start: sceneStart, end: sceneEnd } = getCreateSceneWindow();
  if (!character || !text) {
    setCreateStatus(t('create.status.needText'));
    toast(t('create.status.needText'));
    return;
  }
  start = Math.max(sceneStart, Math.min(sceneEnd, start));
  end = Math.max(sceneStart, Math.min(sceneEnd, end));
  if (!(end > start)) {
    setCreateStatus(t('create.status.badTime'));
    toast(t('create.status.badTime'));
    return;
  }
  state.create.lines.push({
    id: crypto.randomUUID ? crypto.randomUUID() : `line-${Date.now()}-${Math.random()}`,
    character,
    text,
    start,
    end
  });
  state.create.zipBytes = null;
  const textEl = document.querySelector('#createText');
  if (textEl) textEl.value = '';
  document.querySelector('#createStart').value = end.toFixed(2);
  document.querySelector('#createEnd').value = Math.min(sceneEnd, end + 1).toFixed(2);
  renderCreateLines();
  setCreateStatus('');
}

function removeCreateLine(id) {
  if (state.create.previewLineId === id) stopCreatePreview();
  state.create.lines = state.create.lines.filter((line) => line.id !== id);
  state.create.zipBytes = null;
  if (!state.create.lines.length) state.create.linesConfirmed = false;
  renderCreateLines();
}

function resetCreatePack() {
  stopCreatePreview();
  if (state.create.videoUrl) URL.revokeObjectURL(state.create.videoUrl);
  state.create = {
    videoFile: null,
    videoBytes: null,
    videoUrl: '',
    zipBytes: null,
    lines: [],
    busy: false,
    sceneStart: 0,
    sceneEnd: CREATE_SCENE_MAX_SEC,
    previewTimer: 0,
    previewLineId: null,
    previewOnTimeUpdate: null,
    vocalsFile: null,
    vocalsBytes: null,
    vocalsName: '',
    linesConfirmed: false,
    lang: 'pt'
  };
  const video = document.querySelector('#createVideo');
  if (video) {
    video.removeAttribute('src');
    video.load();
  }
  const nameInput = document.querySelector('#createPackName');
  if (nameInput) nameInput.value = '';
  const character = document.querySelector('#createCharacter');
  if (character) character.value = '';
  const text = document.querySelector('#createText');
  if (text) text.value = '';
  const start = document.querySelector('#createStart');
  if (start) start.value = '0';
  const end = document.querySelector('#createEnd');
  if (end) end.value = '1';
  const sceneStart = document.querySelector('#createSceneStart');
  if (sceneStart) sceneStart.value = '0';
  const sceneEnd = document.querySelector('#createSceneEnd');
  if (sceneEnd) sceneEnd.value = String(CREATE_SCENE_MAX_SEC);
  const title = document.querySelector('#createWorkspaceTitle');
  if (title) title.textContent = '—';
  const meta = document.querySelector('#createVideoMeta');
  if (meta) meta.textContent = t('create.video.empty');
  syncCreateVocalsUi();
  renderCreateLines();
  syncCreateActions();
  setCreateStatus(t('create.status.ready'));
}

function encodeWavFromPCM(samples, sampleRate) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeStr = (offset, str) => {
    for (let i = 0; i < str.length; i += 1) view.setUint8(offset + i, str.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, samples.length * 2, true);
  let offset = 44;
  for (let i = 0; i < samples.length; i += 1) {
    const sample = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
    offset += 2;
  }
  return new Uint8Array(buffer);
}

function silenceWavBytes(durationSec, sampleRate = 22050) {
  const length = Math.max(1, Math.floor(Math.max(0.05, durationSec) * sampleRate));
  return encodeWavFromPCM(new Float32Array(length), sampleRate);
}

function seekMedia(media, time) {
  return new Promise((resolve) => {
    const target = Math.max(0, time);
    if (!media || !Number.isFinite(target)) {
      resolve();
      return;
    }
    if (Math.abs((media.currentTime || 0) - target) < 0.04 && media.readyState >= 2) {
      resolve();
      return;
    }
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      media.removeEventListener('seeked', finish);
      media.removeEventListener('loadeddata', finish);
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(finish, 700);
    media.addEventListener('seeked', finish);
    media.addEventListener('loadeddata', finish);
    try {
      media.currentTime = target;
    } catch {
      finish();
    }
  });
}

async function previewCreateLine(id) {
  const line = state.create.lines.find((item) => item.id === id);
  const video = document.querySelector('#createVideo');
  if (!line || !video?.src) {
    toast(t('create.status.needVideo'));
    return;
  }
  if (state.create.previewLineId === id) {
    stopCreatePreview();
    renderCreateLines();
    return;
  }

  stopCreatePreview();
  state.create.previewLineId = id;
  renderCreateLines();

  const onTimeUpdate = () => {
    if (state.create.previewLineId !== id) return;
    if (video.currentTime >= line.end - 0.03) {
      stopCreatePreview();
      renderCreateLines();
    }
  };
  state.create.previewOnTimeUpdate = onTimeUpdate;

  try {
    video.muted = false;
    video.volume = 1;
    video.pause();
    await seekMedia(video, line.start);
    if (state.create.previewLineId !== id) return;
    video.addEventListener('timeupdate', onTimeUpdate);
    await video.play();
    const ms = Math.max(250, Math.ceil((line.end - line.start) * 1000) + 120);
    state.create.previewTimer = setTimeout(() => {
      if (state.create.previewLineId === id) {
        stopCreatePreview();
        renderCreateLines();
      }
    }, ms);
  } catch (error) {
    stopCreatePreview();
    renderCreateLines();
    toast(error?.message || t('create.play.fail'));
  }
}

async function extractLineFrame(videoEl, time) {
  const duration = Number(videoEl.duration);
  let target = Math.max(0, Number(time) || 0);
  if (Number.isFinite(duration) && duration > 0) {
    target = Math.min(target, Math.max(0, duration - 0.05));
  }
  await seekMedia(videoEl, target);
  await wait(40);
  const width = videoEl.videoWidth || 0;
  const height = videoEl.videoHeight || 0;
  if (!width || !height) {
    throw new Error(t('create.status.frameFail'));
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error(t('create.status.frameFail'));
  ctx.drawImage(videoEl, 0, 0, width, height);
  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (result) => (result ? resolve(result) : reject(new Error(t('create.status.frameFail')))),
      'image/jpeg',
      0.94
    );
  });
  return { bytes: new Uint8Array(await blob.arrayBuffer()), ext: 'jpg' };
}

async function extractLineAudio(videoEl, start, end) {
  const duration = Math.max(0.05, end - start);
  const capture = videoEl.captureStream?.bind(videoEl) || videoEl.mozCaptureStream?.bind(videoEl);
  if (!capture || typeof MediaRecorder === 'undefined') {
    return { bytes: silenceWavBytes(duration), ext: 'wav' };
  }

  const stream = capture.call(videoEl);
  const audioTracks = stream.getAudioTracks();
  if (!audioTracks.length) {
    stream.getTracks().forEach((track) => track.stop());
    return { bytes: silenceWavBytes(duration), ext: 'wav' };
  }

  const audioStream = new MediaStream(audioTracks);
  const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg', 'audio/mp4']
    .find((type) => MediaRecorder.isTypeSupported(type)) || '';
  const recorder = new MediaRecorder(audioStream, mime ? { mimeType: mime } : undefined);
  const chunks = [];
  recorder.ondataavailable = (event) => {
    if (event.data?.size) chunks.push(event.data);
  };

  const wasMuted = videoEl.muted;
  const wasVolume = videoEl.volume;
  videoEl.muted = false;
  videoEl.volume = 0.001;
  await seekMedia(videoEl, start);
  const stopped = new Promise((resolve) => {
    recorder.onstop = () => resolve();
  });
  recorder.start(50);
  await videoEl.play().catch(() => undefined);
  await wait(Math.ceil(duration * 1000) + 80);
  videoEl.pause();
  if (recorder.state !== 'inactive') recorder.stop();
  await stopped;
  videoEl.muted = wasMuted;
  videoEl.volume = wasVolume;
  stream.getTracks().forEach((track) => track.stop());

  const blob = new Blob(chunks, { type: recorder.mimeType || mime || 'audio/webm' });
  if (!blob.size) return { bytes: silenceWavBytes(duration), ext: 'wav' };
  const type = recorder.mimeType || blob.type || '';
  const ext = /mp4|m4a|aac/i.test(type) ? 'm4a' : /ogg/i.test(type) ? 'ogg' : /wav/i.test(type) ? 'wav' : 'webm';
  return { bytes: new Uint8Array(await blob.arrayBuffer()), ext };
}

async function buildCreatePackZip() {
  if (!state.create.videoFile || !state.create.videoBytes) {
    throw new Error(t('create.status.needVideo'));
  }
  if (!state.create.lines.length) {
    throw new Error(t('create.status.needLines'));
  }
  if (!state.create.linesConfirmed) {
    throw new Error(t('create.status.needConfirm'));
  }
  if (!createCaptionsReady()) {
    throw new Error(t('create.status.needCaptions'));
  }

  const video = document.querySelector('#createVideo');
  if (!video?.src) throw new Error(t('create.status.needVideo'));

  const videoExt = (state.create.videoFile.name.split('.').pop() || 'mp4').toLowerCase();
  const safeExt = VIDEO_EXTS.includes(videoExt) ? videoExt : 'mp4';
  const files = {
    [`dub_video.${safeExt}`]: state.create.videoBytes
  };
  const linesMeta = [];

  for (let index = 0; index < state.create.lines.length; index += 1) {
    const line = state.create.lines[index];
    setCreateStatus(t('create.status.extract', { n: index + 1 }));
    const base = `${String(index + 1).padStart(2, '0')}-${safeFile(line.character)}`;
    const frameAt = line.start + Math.min(0.35, Math.max(0.08, (line.end - line.start) * 0.2));
    const frame = await extractLineFrame(video, frameAt);
    const imageName = `${base}.${frame.ext}`;
    files[imageName] = frame.bytes;

    const { bytes, ext } = await extractLineAudio(video, line.start, line.end);
    const fileName = `${base}.${ext}`;
    files[fileName] = bytes;
    linesMeta.push({
      file: fileName,
      image: imageName,
      character: line.character,
      text: line.text,
      start: Number(line.start.toFixed(3)),
      end: Number(line.end.toFixed(3)),
      duration: Number((line.end - line.start).toFixed(3))
    });
  }

  const meta = {
    name: createPackName(),
    lang: state.create.lang === 'en' ? 'en' : 'pt',
    lines: linesMeta
  };
  files['pack.json'] = new TextEncoder().encode(JSON.stringify(meta, null, 2));
  return fflate.zipSync(files);
}

async function exportCreatePack({ open = false } = {}) {
  if (state.create.busy) return;
  if (!state.create.videoFile) {
    setCreateStatus(t('create.status.needVideo'));
    toast(t('create.status.needVideo'));
    return;
  }
  if (!state.create.lines.length) {
    setCreateStatus(t('create.status.needLines'));
    toast(t('create.status.needLines'));
    return;
  }
  if (!state.create.linesConfirmed) {
    setCreateStatus(t('create.status.needConfirm'));
    toast(t('create.status.needConfirm'));
    return;
  }
  if (!createCaptionsReady()) {
    setCreateStatus(t('create.status.needCaptions'));
    toast(t('create.status.needCaptions'));
    return;
  }

  state.create.busy = true;
  syncCreateActions();
  setCreateStatus(t('create.status.building'));
  try {
    if (!state.create.zipBytes) {
      state.create.zipBytes = await buildCreatePackZip();
    }
    const name = createPackName();
    if (open) {
      const pack = await buildPack(name, state.create.zipBytes);
      upsertPack(pack);
      state.activePackId = pack.id;
      state.activeIndex = 0;
      renderPackGrid();
      updateScoreCard();
      selectScene(0);
      setTab('record');
      scheduleSave();
      warmSceneAudio(pack.scenes);
      setCreateStatus(t('create.status.opened'));
      toast(t('create.status.opened'));
    } else {
      const url = URL.createObjectURL(new Blob([state.create.zipBytes], { type: 'application/zip' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `${safeFile(name)}.zip`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      setCreateStatus(t('create.status.done'));
      toast(t('create.status.done'));
    }
  } catch (error) {
    setCreateStatus(error.message || t('create.status.error'));
    toast(error.message || t('create.status.error'));
  } finally {
    state.create.busy = false;
    syncCreateActions();
  }
}

function setImportProgress(current, total, label) {
  const wrap = document.querySelector('#importProgressWrap');
  const bar = document.querySelector('#importProgressBar');
  const text = document.querySelector('#importProgressText');
  if (!wrap) return;
  wrap.classList.remove('is-hidden');
  const ratio = total ? current / total : 0;
  if (bar) bar.style.width = `${Math.round(ratio * 100)}%`;
  if (text) text.textContent = label || `${t('studio.import.reading')} ${current}/${total}`;
}

async function importPackFile(file) {
  if (!file) return;
  openImportModal();
  setImportProgress(0, 1, t('studio.import.reading.zip'));
  toast('Abrindo o ZIP…');
  await wait(20);

  try {
    const zipBytes = new Uint8Array(await file.arrayBuffer());
    if (zipBytes.length < 4 || zipBytes[0] !== 0x50 || zipBytes[1] !== 0x4b) {
      throw new Error('Isso não é um ZIP. Importe o pack em .zip.');
    }
    const packName = file.name.replace(/\.zip$/i, '');
    setImportProgress(1, 4, t('studio.import.unpack'));
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
    applyPendingCena();
    const count = pack.scenes.length;
    setImportProgress(count, count, t('studio.import.done'));
    toast(`${count} ${count === 1 ? 'fala' : 'falas'} em “${pack.name}”.`);
    setTimeout(closeImportModal, 400);
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

  let loaded = 0;
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
    let imageUrl = '';
    if (line?.image) {
      const imageEntry = images.find((item) => namesMatch(item.name, line.image));
      if (imageEntry) imageUrl = objectUrl(imageEntry);
    }
    if (!imageUrl) imageUrl = findSceneArt(choicer, index, images, objectUrl, entry);
    const matchedVideo = visualUrlFor(entry, index, videos, objectUrl);
    const sharedUrl = sharedVideo ? objectUrl(sharedVideo) : '';
    const firstVideo = videos[0] ? objectUrl(videos[0]) : '';
    const scene = {
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
    loaded += 1;
    setImportProgress(loaded, sourceAudio.length);
    return scene;
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
    dubRoles: [],
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
  if (!state.user && firebaseAuth?.currentUser) {
    void finishLogin(accountFromFirebase(firebaseAuth.currentUser), { toast: false }).then(() => applyTab(tab));
    return;
  }
  applyTab(tab);
}

function applyTab(tab) {
  if ((tab === 'record' || tab === 'dub') && !currentPack()) {
    toast('Importe um pack para gravar.');
    tab = 'packs';
  }
  const studioMode = tab === 'packs' || tab === 'record';
  document.querySelector('#studioFloor')?.classList.toggle('is-hidden', !studioMode);
  document.querySelector('#studioIntro')?.classList.toggle('is-compact', Boolean(currentPack()) || tab === 'create');
  document.body.classList.toggle('has-pack', Boolean(currentPack()));
  document.querySelectorAll('.tab-view').forEach((view) => view.classList.remove('active'));
  if (studioMode) {
    document.querySelector('#packsTab')?.classList.add('active');
  } else {
    document.querySelector(`#${tab}Tab`)?.classList.add('active');
  }
  document.querySelectorAll('[data-tab]').forEach((button) => {
    const isStudio = button.dataset.tab === 'packs' || button.dataset.tab === 'record';
    button.classList.toggle('active', button.dataset.tab === tab || (studioMode && isStudio && button.dataset.tab === 'packs'));
  });
  document.querySelector('.dashboard')?.classList.toggle('final-mode', tab === 'dub' || tab === 'create');
  if (!studioMode) abortCapture();
  if (studioMode && currentPack() && !state.previewing) selectScene(state.activeIndex);
  if (tab === 'dub') {
    showFinalVideo(currentPack());
  }
  if (tab === 'create') {
    renderCreateLines();
    syncCreateActions();
  }
  if (tab === 'credits' || tab === 'profile') {
    updateCreditUi();
    renderCreditShop();
    refreshAccountUi();
  }
  if (studioMode) renderActivity();
  if (tab === 'profile' || tab === 'credits' || tab === 'create') {
    document.querySelector('.content')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

function selectScene(index, { keepCapture = false } = {}) {
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
  if (els.clipPad) els.clipPad.textContent = String(state.activeIndex + 1).padStart(2, '0');
  if (els.clipPadTotal) els.clipPadTotal.textContent = String(pack.scenes.length);
  if (els.tapeLamp) {
    els.tapeLamp.textContent = take ? 'Take' : 'Ready';
    els.tapeLamp.classList.toggle('is-rec', Boolean(take));
  }
  document.body.classList.add('has-pack');
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
  if (els.cueLabel) els.cueLabel.textContent = '00:00';
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
  els.nextBtn.textContent = canFinish ? t('studio.watch') : t('studio.next');
  els.nextSceneBtn.textContent = canFinish ? t('studio.watch') : t('studio.next');
  els.nextBtn.classList.toggle('pulse-next', (Boolean(take) && canGoNext) || canFinish);
  els.nextSceneBtn.classList.toggle('pulse-next', (Boolean(take) && canGoNext) || canFinish);
  els.previewBtn.disabled = !take;
  els.listenTakeBtn.disabled = !take;
  if (els.previewHint) {
    els.previewHint.textContent = take
      ? 'Ouça seu take com o fundo da cena'
      : 'Grave este take para ouvir aqui';
  }
  if (els.takeResult) els.takeResult.style.display = take ? 'flex' : 'none';
  if (els.takeAudio) els.takeAudio.src = take?.url ?? '';
  updateFinishCta(pack);
  if (els.timingHint) {
    els.timingHint.textContent = take
      ? timingMessage(scene, take)
      : 'Grave um take para medir duração contra a referência.';
  }
  updateTimingDesk(scene, take);
  void paintOverlapWave(scene, take);
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
  updatePackDock();
  els.topbarHint.textContent = `${pack.name} · ${pack.scenes.filter((item) => pack.takes[item.id]).length}/${pack.scenes.length} gravadas`;
}

function packRoles(pack) {
  const names = [];
  (pack?.scenes || []).forEach((scene) => {
    const name = String(decorateScene(scene)?.character || 'Personagem').trim() || 'Personagem';
    if (!names.includes(name)) names.push(name);
  });
  return names;
}

function ensureDubRoles(pack) {
  if (!pack) return [];
  const available = packRoles(pack);
  if (!Array.isArray(pack.dubRoles) || !pack.dubRoles.length) {
    pack.dubRoles = [...available];
  } else {
    pack.dubRoles = pack.dubRoles.filter((name) => available.includes(name));
    if (!pack.dubRoles.length) pack.dubRoles = [...available];
  }
  return pack.dubRoles;
}

function sceneIsAssigned(pack, scene) {
  if (!pack || !scene) return false;
  const roles = ensureDubRoles(pack);
  const available = packRoles(pack);
  if (roles.length >= available.length) return true;
  return roles.includes(String(decorateScene(scene)?.character || 'Personagem').trim() || 'Personagem');
}

function assignedSceneIndexes(pack) {
  if (!pack?.scenes?.length) return [];
  return pack.scenes
    .map((scene, index) => (sceneIsAssigned(pack, scene) ? index : -1))
    .filter((index) => index >= 0);
}

function packIsComplete(pack) {
  if (!pack?.scenes.length) return false;
  return assignedSceneIndexes(pack).every((index) => pack.takes[pack.scenes[index].id]);
}

function goPrevScene() {
  const pack = currentPack();
  if (!pack?.scenes.length) return;
  const assigned = assignedSceneIndexes(pack);
  const prev = [...assigned].reverse().find((index) => index < state.activeIndex);
  if (prev == null) return;
  selectScene(prev);
}

function goNextScene() {
  const pack = currentPack();
  const scene = currentScene();
  if (!pack || !scene) return;
  if (sceneIsAssigned(pack, scene) && !pack.takes[scene.id]) {
    els.recordBtn.classList.add('attention');
    setTimeout(() => els.recordBtn.classList.remove('attention'), 900);
  }
  const assigned = assignedSceneIndexes(pack);
  const next = assigned.find((index) => index > state.activeIndex);
  if (next == null) {
    if (packIsComplete(pack)) {
      setTab('dub');
      toast('Tudo gravado. Toque em Finalizar dublagem.');
    } else {
      toast('Ainda faltam falas das funções que você escolheu.');
    }
    return;
  }
  selectScene(next);
}

function closeRolesModal() {
  document.querySelector('#rolesModal')?.classList.add('is-hidden');
}

function selectedRolesFromModal() {
  return [...document.querySelectorAll('#rolesList input[type="checkbox"]:checked')].map((input) => input.value);
}

function selectAllRoles() {
  document.querySelectorAll('#rolesList input[type="checkbox"]').forEach((input) => {
    input.checked = true;
  });
}

function openRolesModal() {
  const pack = currentPack();
  if (!pack?.scenes.length) {
    toast('Importe um pack para escolher as funções.');
    return;
  }
  const available = packRoles(pack);
  const selected = new Set(ensureDubRoles(pack));
  const list = document.querySelector('#rolesList');
  if (!list) return;
  list.replaceChildren();
  available.forEach((name) => {
    const count = pack.scenes.filter((scene) => (decorateScene(scene)?.character || 'Personagem') === name).length;
    const row = document.createElement('label');
    row.className = 'roles-row';
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.value = name;
    box.checked = selected.has(name);
    const title = document.createElement('strong');
    title.textContent = name;
    const meta = document.createElement('span');
    meta.textContent = t('roles.count', { n: count });
    row.append(box, title, meta);
    list.append(row);
  });
  document.querySelector('#rolesModal')?.classList.remove('is-hidden');
}

function applyRolesModal() {
  const pack = currentPack();
  if (!pack) return;
  const picked = selectedRolesFromModal();
  if (!picked.length) {
    toast(t('roles.none'));
    return;
  }
  pack.dubRoles = picked;
  closeRolesModal();
  const first = assignedSceneIndexes(pack)[0];
  if (first != null) selectScene(first);
  else selectScene(state.activeIndex);
  scheduleSave();
  toast(`${picked.length} ${picked.length === 1 ? 'função' : 'funções'} selecionada${picked.length === 1 ? '' : 's'}.`);
}

function finishCtaLabel(pack) {
  return pack?.finalUrl ? t('record.regenerate') : t('record.finish');
}

function updateFinishCta(pack) {
  const done = packIsComplete(pack);
  const label = finishCtaLabel(pack);
  els.exportVideoBtn?.classList.remove('is-hidden');
  els.exportVideoBtn?.classList.toggle('pulse-next', done && !pack?.finalUrl);
  if (els.exportVideoBtn) {
    els.exportVideoBtn.disabled = !done;
    els.exportVideoBtn.textContent = done ? label : t('studio.watch');
  }
  if (els.generateMp4Btn) {
    els.generateMp4Btn.classList.toggle('is-hidden', !done);
    els.generateMp4Btn.disabled = false;
    els.generateMp4Btn.textContent = label;
  }
  if (done && isIOS()) void preloadFfmpeg();
}

function playClickAudio(layers, duration) {
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

async function playBlobThroughContext(blob, volume) {
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

function playReference() {
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

function iosAudioHint() {
  return isIOS()
    ? 'Sem som? Desligue o modo silencioso do iPhone (chave lateral) e toque de novo.'
    : 'Não consegui tocar o áudio. Toque de novo.';
}

async function startTakeFlow() {
  void unlockAudio();
  const scene = currentScene();
  if (!scene) {
    toast('Importe um pack para gravar.');
    return;
  }
  trackFunnel('started_dub');
  if (state.previewing) stopProjectPreview();
  if (state.countdownTimer || state.countdownStartTimer) {
    abortCapture();
    selectScene(state.activeIndex, { keepCapture: true });
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

  stopActivePlayback();
  if (els.sceneVideo) els.sceneVideo.pause();
  stopClipVideo();
  const sceneStill = currentScene();
  if (sceneStill) showSceneStill(sceneStill);
  clearInterval(state.countdownTimer);
  clearTimeout(state.countdownStartTimer);
  clearInterval(state.recordingTimer);
  clearTimeout(state.recordStopTimer);
  state.countdownTimer = null;
  state.countdownStartTimer = null;
  state.recordingTimer = null;
  state.recordStopTimer = null;
  if (state.recorder?.state === 'recording') {
    state.ignoreRecorderStop = true;
    try { state.recorder.stop(); } catch { /* ignore */ }
  }
  state.recorder = null;
  stopStream();
  stopMeter();
  const gen = ++state.captureGen;
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
  } catch (error) {
    const denied = error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError';
    toast(denied
      ? 'Você bloqueou o microfone. Permita o mic neste site e toque de novo.'
      : 'Não achei um microfone neste aparelho.');
    return;
  }
  if (state.captureGen !== gen) {
    stream.getTracks().forEach((track) => track.stop());
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
  els.recordBtn.setAttribute('aria-label', 'Parar');
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
        if (state.captureGen !== gen) return;
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

function isIOS() {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

async function ensurePlaybackAudio() {
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

async function unlockAudio() {
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

const audioBufferCache = new Map();

async function getCachedAudioBuffer(ctx, url) {
  if (audioBufferCache.has(url)) return audioBufferCache.get(url);
  const buffer = await fetchAudioBuffer(ctx, url);
  audioBufferCache.set(url, buffer);
  return buffer;
}

function warmSceneAudio(scenes) {
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

async function fetchAudioBuffer(ctx, url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error('fetch-audio');
  const data = await response.arrayBuffer();
  return ctx.decodeAudioData(data.slice(0));
}

function takeLooksLikeWebm(take) {
  if (!take) return false;
  return take.ext === 'webm'
    || String(take.blob?.type || '').includes('webm')
    || String(take.url || '').includes('webm');
}

function recordActiveScene() {
  if (!state.liveStream) return;
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
      toast('Essa fala não gravou o áudio. Toque no microfone e fale de novo.');
      selectScene(state.activeIndex, { keepCapture: true });
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
    const url = rememberUrl(URL.createObjectURL(blob), blob);
    pack.takes[scene.id] = {
      url,
      blob,
      character: scene.character,
      subtitle: scene.subtitle,
      createdAt: new Date().toISOString(),
      duration: elapsed,
      ext: /mp4|m4a|aac/i.test(blob.type) ? 'm4a' : 'webm',
      peak: voicePeak,
      onset: profile.onset,
      release: profile.release,
      voiced: profile.voiced
    };
    selectScene(state.activeIndex, { keepCapture: true });
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
      trackFunnel('completed_dub');
      toast('Pack concluído. Toque em Finalizar dublagem.');
    }
  };

  els.countdownBadge.style.display = 'none';
  els.recordingOverlay.style.display = 'grid';
  els.stageState.textContent = 'Gravando take...';
  els.stageState.className = 'stage-state recording';
  els.recordBtn.classList.add('recording');
  els.recordBtn.setAttribute('aria-label', 'Parar');
  els.micHint.textContent = 'Fale agora · a cena se move com você';
  if (els.recordingStatus) els.recordingStatus.textContent = 'Gravando';
  playSceneMedia(scene, recMs / 1000);
  animateProgress(recMs / 1000);

  state.recordingTimer = setInterval(() => {
    const remaining = Math.max(0, (recMs / 1000) - ((Date.now() - startedAt) / 1000));
    els.timerValue.textContent = remaining.toFixed(1);
  }, 100);

  try {
    if (isIOS()) {
      state.recorder.start(100);
    } else {
      state.recorder.start(250);
    }
  } catch {
    try {
  state.recorder.start();
    } catch {
      state.recorder.start(250);
    }
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

function bindSceneVisual(scene) {
  const video = els.sceneVideo;
  const image = els.sceneImage;
  const empty = els.emptyFrame;
  if (!video || !image || !empty) return;
  stopClipVideo();

  if (scene.videoUrl) {
    if (image) image.style.display = 'none';
    empty.style.display = 'none';
    void prepareSceneVideo(scene).then(() => showSceneStill(scene));
    return;
  }

  unmountSceneOgv();
  video.pause();
  video.style.display = 'none';
  if (scene.imageUrl) {
    image.style.display = 'block';
    if (image.src !== scene.imageUrl) image.src = scene.imageUrl;
    return;
  }

  if (video.src) video.removeAttribute('src');
  image.style.display = 'none';
  paintEmptyScene(scene);
}

function sceneVideoLooksOgv(scene) {
  const url = scene?.videoUrl || '';
  const blob = state.blobByUrl.get(url);
  return /ogg|ogv/i.test(blob?.type || '') || /\.ogv(\?|$)/i.test(url);
}

function clipPlayer() {
  return state.sceneOgv || els.sceneVideo;
}

function stopClipVideo() {
  state.clipVideoPlaying = false;
  clearTimeout(state.videoTimer);
  state.videoTimer = null;
  try { state.sceneOgv?.pause?.(); } catch { /* ignore */ }
  try { els.sceneVideo?.pause?.(); } catch { /* ignore */ }
}

function unmountSceneOgv() {
  stopClipVideo();
  if (state.sceneOgv) {
    try { state.sceneOgv.src = ''; } catch { /* ignore */ }
    state.sceneOgv.remove();
    state.sceneOgv = null;
  }
  state.sceneOgvSrc = '';
  if (els.sceneOgvHost) {
    els.sceneOgvHost.hidden = true;
    els.sceneOgvHost.replaceChildren();
  }
}

async function prepareSceneVideo(scene) {
  if (!scene?.videoUrl) return null;
  if (sceneVideoLooksOgv(scene)) {
    if (els.sceneVideo) els.sceneVideo.style.display = 'none';
    if (state.sceneOgv && state.sceneOgvSrc === scene.videoUrl) {
      if (els.sceneOgvHost) els.sceneOgvHost.hidden = false;
      return state.sceneOgv;
    }
    unmountSceneOgv();
    const Player = await ensureOgvPlayer();
    const player = new Player({ wasm: true, webGL: true });
    player.muted = true;
    player.setAttribute('playsinline', '');
    player.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;background:#000';
    els.sceneOgvHost.hidden = false;
    els.sceneOgvHost.appendChild(player);
    player.src = scene.videoUrl;
    state.sceneOgv = player;
    state.sceneOgvSrc = scene.videoUrl;
    await new Promise((resolve) => {
      const done = () => resolve();
      player.addEventListener('loadedmetadata', done, { once: true });
      player.addEventListener('canplay', done, { once: true });
      setTimeout(done, 1800);
    });
    return player;
  }

  unmountSceneOgv();
  const video = els.sceneVideo;
  if (!video) return null;
  video.muted = true;
  video.playsInline = true;
  video.style.display = 'block';
  if (video.src !== scene.videoUrl) video.src = scene.videoUrl;
  return video;
}

async function playSceneMedia(scene, duration) {
  if (!scene?.videoUrl) {
    if (scene?.imageUrl && els.sceneImage) {
      els.sceneImage.style.display = 'block';
      if (els.sceneVideo) els.sceneVideo.style.display = 'none';
      unmountSceneOgv();
    }
    return;
  }
  if (els.sceneImage) els.sceneImage.style.display = 'none';
  if (els.emptyFrame) els.emptyFrame.style.display = 'none';
  const player = await prepareSceneVideo(scene);
  if (!player) return;
  state.clipVideoPlaying = true;
  const start = Number(scene.videoOffset) || 0;
  player.muted = true;
  const kick = () => {
    if (!state.clipVideoPlaying) return;
    const playing = player.play?.();
    if (playing?.catch) playing.catch(() => undefined);
  };
  try {
    if (Math.abs((Number(player.currentTime) || 0) - start) > 0.08) {
      player.currentTime = start;
    }
  } catch {
    // ignore
  }
  kick();
  clearTimeout(state.videoTimer);
  state.videoTimer = setTimeout(() => {
    stopClipVideo();
    showSceneStill(scene);
  }, Math.max(200, (Number(duration) || 1) * 1000));
}

function showSceneStill(scene) {
  const player = clipPlayer();
  if (!player || !scene?.videoUrl || state.clipVideoPlaying) return;
  const apply = () => {
    if (state.clipVideoPlaying) return;
    const duration = Number.isFinite(player.duration) ? player.duration : 0;
    const offset = Number(scene.videoOffset) || 0;
    const target = duration
      ? Math.min(Math.max(offset, 0), Math.max(0, duration - 0.08))
      : offset;
    try {
      player.currentTime = target || 0.04;
    } catch {
      // Alguns arquivos ainda não aceitam seek.
    }
  };
  if ((player.readyState || 0) >= 2) apply();
  else {
    player.addEventListener?.('loadeddata', apply, { once: true });
    player.addEventListener?.('loadedmetadata', apply, { once: true });
  }
}

function paintEmptyScene(scene) {
  const empty = els.emptyFrame;
  const idle = document.querySelector('#emptyIdle');
  const sceneBox = document.querySelector('#emptyScene');
  if (idle) idle.hidden = true;
  if (sceneBox) {
    sceneBox.hidden = false;
    sceneBox.replaceChildren();
    const kicker = document.createElement('small');
    kicker.textContent = 'Cena desta fala';
    const title = document.createElement('strong');
    title.textContent = scene.character || 'Pack';
    sceneBox.append(kicker, title);
  } else {
    empty.replaceChildren();
    const kicker = document.createElement('small');
    kicker.textContent = 'Cena desta fala';
    const title = document.createElement('strong');
    title.textContent = scene.character || 'Pack';
    empty.append(kicker, title);
  }
  empty.style.display = 'grid';
}

function restoreEmptyMonitor() {
  const empty = els.emptyFrame;
  const idle = document.querySelector('#emptyIdle');
  const sceneBox = document.querySelector('#emptyScene');
  if (els.sceneVideo) {
    els.sceneVideo.pause();
    els.sceneVideo.style.display = 'none';
  }
  unmountSceneOgv();
  if (els.sceneImage) els.sceneImage.style.display = 'none';
  if (idle) idle.hidden = false;
  if (sceneBox) {
    sceneBox.hidden = true;
    sceneBox.replaceChildren();
  }
  if (empty) empty.style.display = 'grid';
  if (els.clipPad) els.clipPad.textContent = '00';
  if (els.clipPadTotal) els.clipPadTotal.textContent = '0';
  if (els.tapeLamp) {
    els.tapeLamp.textContent = 'No tape';
    els.tapeLamp.classList.remove('is-rec');
  }
  document.body.classList.remove('has-pack');
  document.querySelector('#studioIntro')?.classList.remove('is-compact');
}

function playTimedAudio(url, duration, volume = 1) {
  return playLayers([{ url, volume }], duration);
}

async function playLayers(layers, duration) {
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

function playLayersHtml(layers, duration) {
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

function stopActivePlayback() {
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
}

function animateProgress(duration) {
  clearInterval(state.progressTimer);
  const startedAt = Date.now();
  state.progressTimer = setInterval(() => {
    const progress = Math.min(1, (Date.now() - startedAt) / (duration * 1000));
    els.videoProgress.style.width = `${progress * 100}%`;
    els.elapsedLabel.textContent = formatSeconds(progress * duration);
    if (els.cueLabel) els.cueLabel.textContent = formatSeconds(progress * duration);
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

function startStudioTips() {
  if (!els.tipDots || !els.tipTitle) return;
  const tips = getStudioTips();
  els.tipDots.replaceChildren();
  tips.forEach((tip, index) => {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.setAttribute('aria-label', tip.title);
    dot.addEventListener('click', () => showStudioTip(index, true));
    els.tipDots.append(dot);
  });
  showStudioTip(0);
  clearInterval(state.tipTimer);
  state.tipTimer = setInterval(() => {
    showStudioTip((state.tipIndex + 1) % tips.length);
  }, 6500);
}

function refreshStudioTips() {
  if (!els.tipDots || !els.tipTitle) return;
  const tips = getStudioTips();
  els.tipDots.querySelectorAll('button').forEach((dot, index) => {
    dot.setAttribute('aria-label', tips[index]?.title || '');
  });
  showStudioTip(state.tipIndex ?? 0);
}

function showStudioTip(index, pause) {
  const tips = getStudioTips();
  state.tipIndex = index;
  const tip = tips[index];
  if (!tip) return;
  if (els.tipTitle) els.tipTitle.innerHTML = `<strong>${tip.title}</strong>`;
  if (els.tipBody) els.tipBody.textContent = tip.body;
  els.tipDots?.querySelectorAll('button').forEach((dot, i) => {
    dot.classList.toggle('is-on', i === index);
  });
  if (pause) {
    clearInterval(state.tipTimer);
    state.tipTimer = setInterval(() => {
      showStudioTip((state.tipIndex + 1) % tips.length);
    }, 6500);
  }
}

function packCover(pack) {
  const visual = pack.scenes.find((scene) => scene.imageUrl || scene.videoUrl);
  if (visual?.imageUrl) return { type: 'img', src: visual.imageUrl };
  if (visual?.videoUrl) return { type: 'video', src: visual.videoUrl };
  if (pack.filmUrl) return { type: 'video', src: pack.filmUrl };
  return { type: 'empty' };
}

function renderPackSelect() {
  const sel = els.packSelect;
  if (!sel) return;
  const current = state.activePackId || '';
  sel.replaceChildren();
  const empty = document.createElement('option');
  empty.value = '';
  empty.textContent = t('studio.nopack');
  sel.append(empty);
  state.packs.forEach((pack) => {
    const opt = document.createElement('option');
    opt.value = pack.id;
    opt.textContent = pack.name;
    sel.append(opt);
  });
  sel.value = state.packs.some((pack) => pack.id === current) ? current : '';
}

function renderPackGrid() {
  const packs = state.packs;
  els.packEmpty.classList.toggle('is-hidden', state.packs.length > 0);
  els.packGrid.replaceChildren();
  renderPackSelect();
  if (!currentPack()) restoreEmptyMonitor();
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
  updatePackDock();
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

function deletePack(id) {
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
      restoreEmptyMonitor();
      setTab('packs');
    }
  }

  toast(`Pack “${packName}” apagado.`);
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
  state.captureGen += 1;
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
  els.countdownBadge && (els.countdownBadge.style.display = 'none');
  if (els.recordingOverlay) els.recordingOverlay.style.display = 'none';
  els.recordBtn?.classList.remove('recording');
  els.recordBtn?.setAttribute('aria-label', 'Gravar');
  stopActivePlayback();
  if (!keepPreview) stopClipVideo();
  if (state.recorder?.state === 'recording') {
    state.ignoreRecorderStop = true;
    try {
      state.recorder.stop();
    } catch {
      state.recorder = null;
      stopStream();
      stopMeter();
    }
  } else {
    state.recorder = null;
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

function updatePackDock() {
  const pack = currentPack();
  const recorded = pack ? pack.scenes.filter((scene) => pack.takes[scene.id]).length : 0;
  const total = pack?.scenes.length || 0;
  const label = document.querySelector('#packProgressLabel');
  const bar = document.querySelector('#packProgressBar');
  const lamp = document.querySelector('#packStatusLamp');
  const name = document.querySelector('#packStatusPack');
  if (label) label.textContent = `${recorded} / ${total}`;
  if (bar) bar.style.width = total ? `${Math.round((recorded / total) * 100)}%` : '0%';
  if (name) name.textContent = pack?.name || '—';
  if (lamp) {
    lamp.textContent = !pack
      ? t('studio.dock.idle')
      : recorded === 0
        ? t('studio.dock.idle')
        : recorded === total
          ? t('studio.dock.done')
          : t('studio.dock.progress');
  }
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

const WAVE_BINS = 168;
const wavePeakCache = new Map();

function extractPeaks(buffer, bins = WAVE_BINS) {
  const data = buffer.getChannelData(0);
  const size = Math.max(1, Math.floor(data.length / bins));
  const peaks = new Array(bins).fill(0);
  for (let i = 0; i < bins; i += 1) {
    let max = 0;
    const start = i * size;
    const end = Math.min(data.length, start + size);
    for (let j = start; j < end; j += 12) max = Math.max(max, Math.abs(data[j]));
    peaks[i] = max;
  }
  return peaks;
}

async function peaksFromUrl(url) {
  if (!url) return [];
  if (wavePeakCache.has(url)) return wavePeakCache.get(url);
  const work = (async () => {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return [];
    const ctx = new AudioCtx();
    try {
      const bytes = await fetch(url).then((response) => response.arrayBuffer());
      const decoded = await ctx.decodeAudioData(bytes.slice(0));
      return extractPeaks(decoded);
    } catch {
      return [];
    } finally {
      await ctx.close().catch(() => undefined);
    }
  })();
  wavePeakCache.set(url, work);
  return work;
}

async function peaksFromBlob(blob) {
  if (!blob) return [];
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return [];
  const ctx = new AudioCtx();
  try {
    const decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
    return extractPeaks(decoded);
  } catch {
    return [];
  } finally {
    await ctx.close().catch(() => undefined);
  }
}

function drawWaveLayer(ctx, peaks, color, width, height, alpha = 1) {
  if (!peaks?.length) return;
  const mid = height / 2;
  const gap = width / peaks.length;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  peaks.forEach((peak, index) => {
    const amp = Math.max(1.5, peak * (mid - 4));
    const x = index * gap;
    ctx.fillRect(x, mid - amp, Math.max(1.2, gap * 0.72), amp * 2);
  });
  ctx.restore();
}

function sizeWaveCanvas(canvas) {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const width = Math.max(1, Math.round(rect.width * dpr));
  const height = Math.max(1, Math.round(rect.height * dpr));
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  return { width: canvas.width, height: canvas.height };
}

async function paintOverlapWave(scene, take) {
  const canvas = els.waveCanvas;
  if (!canvas) return;
  const gen = ++state.waveGen;
  const { width, height } = sizeWaveCanvas(canvas);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = 'rgba(255,255,255,0.04)';
  for (let y = 12; y < height; y += 12) ctx.fillRect(0, y, width, 1);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(0, height / 2, width, 1);
  const refPeaks = scene?.audioUrl ? await peaksFromUrl(scene.audioUrl) : [];
  if (gen !== state.waveGen) return;
  drawWaveLayer(ctx, refPeaks, '#f36aa8', width, height, 0.92);
  if (take?.blob || take?.url) {
    const takePeaks = take.peaks || await (take.blob ? peaksFromBlob(take.blob) : peaksFromUrl(take.url));
    if (takePeaks?.length) take.peaks = takePeaks;
    if (gen !== state.waveGen) return;
    drawWaveLayer(ctx, takePeaks, '#5bff3a', width, height, 0.78);
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

function rememberUrl(url, blob) {
  if (url) state.objectUrls.push(url);
  if (url && blob) state.blobByUrl.set(url, blob);
  return url;
}

function forgetUrl(url) {
  if (!url) return;
  try {
    URL.revokeObjectURL(url);
  } catch {
    // ignore
  }
  state.objectUrls = state.objectUrls.filter((item) => item !== url);
  state.blobByUrl.delete(url);
}

function revokeAllObjectUrls() {
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

function revokePackMedia(pack) {
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
  { id: 'c100', credits: 100, price: 9.9, priceUsd: 2.99, labelKey: 'pack.c100.label', hintKey: 'pack.c100.hint' },
  { id: 'c200', credits: 200, price: 12.9, priceUsd: 2.49, labelKey: 'pack.c200.label', hintKey: 'pack.c200.hint' },
  { id: 'c300', credits: 300, price: 15.9, priceUsd: 2.99, labelKey: 'pack.c300.label', hintKey: 'pack.c300.hint', featured: true }
];

function formatBrl(value, { monthly = false } = {}) {
  const amount = Number.isInteger(value)
    ? `R$ ${value},00`
    : `R$ ${value.toFixed(2).replace('.', ',')}`;
  if (!monthly) return amount;
  return `${amount}/${getLang() === 'en' ? 'mo' : 'mês'}`;
}

function createPricingTier({ step, title, price, priceNote, features, variant, featured, active, cta }) {
  const card = document.createElement('article');
  card.className = `pricing-tier tier-${variant}${featured ? ' is-featured' : ''}${active ? ' is-active' : ''}`;

  const stepEl = document.createElement('span');
  stepEl.className = 'tier-step';
  stepEl.textContent = step;

  const titleEl = document.createElement('strong');
  titleEl.className = 'tier-title';
  titleEl.textContent = title;

  const priceEl = document.createElement('b');
  priceEl.className = 'tier-price';
  priceEl.textContent = price;

  const noteEl = document.createElement('p');
  noteEl.className = 'tier-price-note';
  noteEl.textContent = priceNote;

  const list = document.createElement('ul');
  list.className = 'tier-features';
  features.forEach((feature) => {
    const item = document.createElement('li');
    item.textContent = feature;
    list.append(item);
  });

  card.append(stepEl, titleEl, priceEl, noteEl, list);

  if (active) {
    const status = document.createElement('span');
    status.className = 'tier-status';
    status.textContent = t('shop.current');
    card.append(status);
  }

  if (cta) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `primary wide${cta.secondary ? ' secondary' : ''}`;
    button.textContent = cta.text;
    button.disabled = Boolean(cta.disabled);
    if (cta.onClick) button.addEventListener('click', cta.onClick);
    card.append(button);
  }

  return card;
}

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
  if (!Number.isFinite(count) || count === Number.POSITIVE_INFINITY) return t('credit.infinite');
  const word = count === 1 ? t('credit.one') : t('credit.many');
  return `${count} ${word}`;
}

function creditBadgeHtml(count) {
  if (!Number.isFinite(count) || count === Number.POSITIVE_INFINITY) {
    return `<span class="credit-word">${t('credit.infinite')}</span>`;
  }
  const word = count === 1 ? t('credit.one') : t('credit.many');
  return `<span class="credit-highlight">${count}</span> <span class="credit-word">${word}</span>`;
}

function updateCreditUi() {
  if (!isLoggedIn()) {
    if (els.creditBadge) {
      els.creditBadge.textContent = '';
      els.creditBadge.hidden = true;
    }
    if (els.creditsBalance) els.creditsBalance.textContent = '—';
    if (els.profileCreditsLine) els.profileCreditsLine.textContent = t('profile.guest');
    return;
  }
  if (els.creditBadge) els.creditBadge.hidden = false;
  const count = getCredits();
  const badgeHtml = creditBadgeHtml(count);
  if (els.creditBadge) {
    if (isOwner()) {
      els.creditBadge.innerHTML = `<span class="credit-word">${t('pro.card.title')}</span>`;
    } else if (isPro()) {
      els.creditBadge.innerHTML = `PRO · ${badgeHtml}`;
    } else {
      els.creditBadge.innerHTML = badgeHtml;
    }
  }
  if (els.creditsBalance) els.creditsBalance.innerHTML = isOwner() ? `<span class="credit-word">${t('pro.card.title')}</span>` : badgeHtml;
  if (els.profileCreditsLine) {
    els.profileCreditsLine.innerHTML = t('profile.body', { credits: isOwner() ? t('pro.card.title') : badgeHtml });
  }
  if (els.proBtn) {
    els.proBtn.textContent = isOwner() ? t('pro.btn.owner') : isPro() ? t('pro.btn.manage') : t('pro.btn');
  }
}

function renderCreditShop() {
  if (!els.creditShop) return;
  els.creditShop.replaceChildren();

  const tiersTitle = document.createElement('h3');
  tiersTitle.className = 'shop-section-title';
  tiersTitle.textContent = t('shop.tiers.title');
  const tiersLead = document.createElement('p');
  tiersLead.className = 'shop-lead';
  tiersLead.textContent = t('shop.tiers.lead');
  els.creditShop.append(tiersTitle, tiersLead);

  const tierGrid = document.createElement('div');
  tierGrid.className = 'pricing-tier-grid';

  tierGrid.append(createPricingTier({
    step: t('shop.step.1'),
    title: t('shop.free.title'),
    price: formatBrl(0),
    priceNote: t('shop.free.priceNote'),
    features: [t('shop.free.f1'), t('shop.free.f2'), t('shop.free.f3')],
    variant: 'free',
    active: !isPro() && !isOwner()
  }));

  tierGrid.append(createPricingTier({
    step: t('shop.step.3'),
    title: t('pro.card.title'),
    price: formatBrl(PRO_MONTHLY_PRICE, { monthly: true }),
    priceNote: t('shop.pro.priceNote', { credits: PRO_MONTHLY_CREDITS }),
    features: [t('shop.pro.f1'), t('shop.pro.f2'), t('shop.pro.f3')],
    variant: 'pro',
    featured: true,
    active: isPro() && !isOwner(),
    cta: isOwner()
      ? { text: t('plan.owner'), disabled: true, secondary: true }
      : isPro()
        ? { text: t('pro.active'), disabled: true }
        : { text: t('pro.subscribe'), onClick: subscribePro }
  }));

  tierGrid.append(createPricingTier({
    step: t('shop.step.4'),
    title: t('shop.extra.title'),
    price: t('shop.extra.from', { price: formatBrl(9.9) }),
    priceNote: t('shop.extra.priceNote'),
    features: [t('shop.extra.f1'), t('shop.extra.f2'), t('shop.extra.f3')],
    variant: 'extra'
  }));

  els.creditShop.append(tierGrid);

  const packsTitle = document.createElement('h3');
  packsTitle.className = 'shop-section-title';
  packsTitle.textContent = t('shop.packs.title');
  const packsLead = document.createElement('p');
  packsLead.className = 'shop-lead';
  packsLead.textContent = t('shop.packs.lead');
  els.creditShop.append(packsTitle, packsLead);

  const packGrid = document.createElement('div');
  packGrid.className = 'credit-pack-grid';
  CREDIT_PACKS.forEach((pack) => {
    const label = t(pack.labelKey);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `credit-card${pack.featured ? ' featured' : ''}`;
    const title = document.createElement('strong');
    title.textContent = label;
    const price = document.createElement('b');
    price.textContent = `${formatBrl(pack.price)} · $${pack.priceUsd.toFixed(2)}`;
    const hint = document.createElement('span');
    hint.textContent = t(pack.hintKey);
    const action = document.createElement('em');
    action.className = 'credit-card-action';
    action.textContent = t('cart.add');
    button.append(title, price, hint, action);
    button.addEventListener('click', () => addPackToCart({ ...pack, label }));
    packGrid.append(button);
  });
  els.creditShop.append(packGrid);
}

function addPackToCart(pack) {
  window.DubpackCart?.addCartItem({
    id: pack.id,
    type: 'pack',
    label: pack.label,
    credits: pack.credits,
    priceBrl: pack.price,
    priceUsd: pack.priceUsd
  });
  setTab('credits');
  window.DubpackCart?.scrollToCart();
}

function addProToCart() {
  if (isPro() && !isOwner()) return;
  window.DubpackCart?.addCartItem({
    id: 'pro-monthly',
    type: 'pro',
    label: t('pro.card.title'),
    credits: PRO_MONTHLY_CREDITS,
    priceBrl: PRO_MONTHLY_PRICE,
    priceUsd: PRO_MONTHLY_PRICE_USD
  });
  setTab('credits');
  window.DubpackCart?.scrollToCart();
}

function getPaymentEndpoint(name) {
  return window.DubpackCart?.paymentEndpoint?.(name) || '';
}

async function syncAccountFromServer() {
  if (!state.user?.email || isOwner()) return;
  const url = getPaymentEndpoint('syncAccount');
  if (!url) return;
  try {
    const response = await fetch(`${url}?email=${encodeURIComponent(state.user.email)}`);
    const data = await response.json();
    if (!response.ok) return;
    if (Number.isFinite(Number(data.credits))) setCredits(Number(data.credits));
    if (data.pro?.active) {
      writeProState({
        active: true,
        subscribedAt: Number(data.pro.subscribedAt) || Date.now(),
        periodEnd: Number(data.pro.periodEnd) || (Date.now() + PRO_PERIOD_MS),
        lastCreditMonth: data.pro.lastCreditMonth || ''
      });
    }
    refreshAccountUi();
  } catch {
    // Server sync is optional until functions are deployed.
  }
}

async function verifyStripeCheckout(sessionId) {
  const url = getPaymentEndpoint('verifyCheckout');
  if (!url || !state.user?.email) {
    throw new Error('not-ready');
  }
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId,
      email: state.user.email
    })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'verify-failed');
  if (Number.isFinite(Number(data.credits))) setCredits(Number(data.credits));
  if (data.pro) {
    const now = Date.now();
    writeProState({
      active: true,
      subscribedAt: now,
      periodEnd: now + PRO_PERIOD_MS,
      lastCreditMonth: new Date().toISOString().slice(0, 7)
    });
    trackFunnel('pro_conversion');
  }
  window.DubpackCart?.clearCart();
  refreshAccountUi();
}

const CHECKOUT_SESSION_KEY = 'dubpack-checkout-session';
const FUNNEL_SESSION_KEY = 'dubpack-funnel-session';
const FUNNEL_SEEN_KEY = 'dubpack-funnel-seen';

function funnelSessionId() {
  try {
    let id = sessionStorage.getItem(FUNNEL_SESSION_KEY);
    if (!id) {
      id = crypto.randomUUID ? crypto.randomUUID() : `s-${Date.now()}`;
      sessionStorage.setItem(FUNNEL_SESSION_KEY, id);
    }
    return id;
  } catch {
    return 'anon';
  }
}

function trackFunnel(event) {
  const name = String(event || '');
  if (!name) return;
  try {
    const seen = JSON.parse(sessionStorage.getItem(FUNNEL_SEEN_KEY) || '{}');
    if (seen[name] && (name === 'visitor' || name === 'started_dub' || name === 'signup')) return;
    seen[name] = (Number(seen[name]) || 0) + 1;
    sessionStorage.setItem(FUNNEL_SEEN_KEY, JSON.stringify(seen));
    const totals = JSON.parse(localStorage.getItem('dubpack-funnel') || '{}');
    totals[name] = (Number(totals[name]) || 0) + 1;
    localStorage.setItem('dubpack-funnel', JSON.stringify(totals));
  } catch {
    // ignore
  }
  const url = getPaymentEndpoint('logFunnel');
  if (!url) return;
  const body = JSON.stringify({ event: name, sessionId: funnelSessionId(), lang: getLang() });
  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true
  }).catch(() => undefined);
}

function encodeCenaPayload(pack, index) {
  const scene = decorateScene(pack.scenes[index] || pack.scenes[0]);
  const json = JSON.stringify({
    n: pack.name,
    i: Number(index) || 0,
    c: scene?.character || '',
    t: String(scene?.subtitle || '').slice(0, 90)
  });
  return btoa(unescape(encodeURIComponent(json))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function decodeCenaPayload(raw) {
  try {
    const padded = String(raw || '').replace(/-/g, '+').replace(/_/g, '/');
    const pad = padded + '='.repeat((4 - (padded.length % 4)) % 4);
    return JSON.parse(decodeURIComponent(escape(atob(pad))));
  } catch {
    return null;
  }
}

function sceneLinkUrl(pack, index = 0) {
  const url = new URL(window.location.href);
  url.searchParams.delete('checkout');
  url.searchParams.delete('session_id');
  if (!pack) return url.toString();
  url.searchParams.set('cena', encodeCenaPayload(pack, index));
  return url.toString();
}

async function copySceneLink() {
  const pack = currentPack();
  if (!pack) {
    toast(t('cena.need.pack'));
    return;
  }
  const link = sceneLinkUrl(pack, 0);
  try {
    await navigator.clipboard.writeText(link);
    toast(t('ready.copied'));
    trackFunnel('share');
  } catch {
    toast(link);
  }
}

async function shareSceneLink() {
  const pack = currentPack();
  if (!pack) {
    toast(t('cena.need.pack'));
    return;
  }
  const link = sceneLinkUrl(pack, 0);
  trackFunnel('share');
  if (navigator.share) {
    try {
      await navigator.share({ title: 'DubPack Studio', text: pack.name, url: link });
      return;
    } catch {
      // canceled
    }
  }
  try {
    await navigator.clipboard.writeText(link);
    toast(t('ready.copied'));
  } catch {
    toast(link);
  }
}

function capturePendingCena() {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get('cena');
  if (!raw) return;
  const payload = decodeCenaPayload(raw);
  if (payload?.n) state.pendingCena = payload;
}

function findPackForCena(payload) {
  const wanted = normalizeBaseName(payload.n);
  return state.packs.find((pack) => normalizeBaseName(pack.name) === wanted)
    || state.packs.find((pack) => {
      const have = normalizeBaseName(pack.name);
      return have.includes(wanted) || wanted.includes(have);
    });
}

function paintCenaBanner() {
  const banner = document.querySelector('#cenaBanner');
  const body = document.querySelector('#cenaBannerBody');
  const payload = state.pendingCena;
  if (!banner) return;
  if (!payload) {
    banner.classList.add('is-hidden');
    return;
  }
  banner.classList.remove('is-hidden');
  const n = (Number(payload.i) || 0) + 1;
  if (body) {
    body.textContent = findPackForCena(payload)
      ? t('cena.banner.ready', { pack: findPackForCena(payload).name, n })
      : t('cena.banner.body', { pack: payload.n, n, character: payload.c || '—' });
  }
}

function applyPendingCena() {
  const payload = state.pendingCena;
  paintCenaBanner();
  if (!payload) return false;
  const pack = findPackForCena(payload);
  if (!pack) return false;
  state.activePackId = pack.id;
  const index = Math.max(0, Math.min(Number(payload.i) || 0, pack.scenes.length - 1));
  selectScene(index);
  setTab('record');
  paintCenaBanner();
  return true;
}

function captureCheckoutReturn() {
  const params = new URLSearchParams(window.location.search);
  const status = params.get('checkout');
  const sessionId = params.get('session_id');
  if (status === 'success' && sessionId) {
    sessionStorage.setItem(CHECKOUT_SESSION_KEY, sessionId);
  }
  if (status === 'cancel') {
    sessionStorage.removeItem(CHECKOUT_SESSION_KEY);
    toast(t('cart.checkout.cancel'));
  }
  if (!status) return;
  params.delete('checkout');
  params.delete('session_id');
  const next = `${window.location.pathname}${params.toString() ? `?${params}` : ''}${window.location.hash}`;
  window.history.replaceState({}, '', next);
}

async function applyPendingCheckout() {
  const sessionId = sessionStorage.getItem(CHECKOUT_SESSION_KEY);
  if (sessionId && state.user?.email) {
    toast(t('cart.checkout.verify'));
    let lastError = null;
    for (let attempt = 0; attempt < 6; attempt += 1) {
      try {
        await verifyStripeCheckout(sessionId);
        sessionStorage.removeItem(CHECKOUT_SESSION_KEY);
        toast(t('cart.checkout.success'));
        return;
      } catch (error) {
        lastError = error;
        await wait(700);
      }
    }
    console.error(lastError);
  }
  await syncAccountFromServer();
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
  const isMp4 = pack?.finalExt === 'mp4' || pack?.finalBlob?.type?.includes('mp4');
  const layout = pack?.exportLayout || state.exportLayout || 'original';
  document.querySelector('#readyActions')?.classList.toggle('is-hidden', !has);
  document.querySelector('#exportOriginalBtn')?.classList.toggle('is-active', layout !== 'vertical');
  document.querySelector('#exportVerticalBtn')?.classList.toggle('is-active', layout === 'vertical');
  els.finalVideoWrap?.classList.toggle('is-vertical', layout === 'vertical');
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

async function downloadFinalMp4() {
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

function preloadFfmpeg() {
  if (isIOS()) return Promise.resolve();
  return loadFfmpeg().catch(() => undefined);
}

async function requestFinalMp4(layout) {
  if (layout === 'original' || layout === 'vertical') state.exportLayout = layout;
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
  if (state.exporting) {
    toast('Já estou montando o MP4.');
    return;
  }
  const watermarked = shouldWatermarkExport();
  if (watermarked) {
    toast(getLang() === 'en'
      ? `Free export includes a ${EXPORT_WATERMARK_LABEL} watermark. PRO removes it.`
      : `Exportação grátis sai com marca d'água ${EXPORT_WATERMARK_LABEL}. PRO remove a marca.`);
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
    if (isIOS() && !composed.type.includes('mp4')) {
      setExportProgress(92, 'Convertendo para MP4');
      output = await convertToMp4(composed);
    }
    if (isIOS() && !output.type.includes('mp4')) {
      throw new Error(getLang() === 'en'
        ? 'Could not generate MP4 on this device. Try again on Wi‑Fi.'
        : 'Não consegui gerar MP4 neste aparelho. Tente de novo com Wi‑Fi ligado.');
    }
    setExportProgress(100, 'Pronto');
    if (pack.finalUrl) URL.revokeObjectURL(pack.finalUrl);
    pack.finalBlob = output;
    pack.finalExt = output.type.includes('mp4') ? 'mp4' : 'webm';
    pack.watermarked = watermarked;
    pack.exportLayout = state.exportLayout;
    pack.finalUrl = rememberUrl(URL.createObjectURL(output));
    showFinalVideo(pack);
    scheduleSave();
    trackFunnel('export');
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

function pickVideoMime() {
  const mp4Types = [
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/mp4;codecs=h264,aac',
    'video/mp4'
  ];
  const webmTypes = [
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=vp9,opus',
    'video/webm'
  ];
  // iPhone: tenta MP4. Chrome/PC: WebM nativo, sem conversão.
  const types = isIOS() ? [...mp4Types, ...webmTypes] : [...webmTypes, ...mp4Types];
  return types.find((type) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) || '';
}

function exportVideoBitrate() {
  if (isPro() || isOwner()) return isPhone() ? 3_500_000 : 8_000_000;
  return isPhone() ? 1_200_000 : 2_200_000;
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

async function waitForFilmReady(film) {
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
    getPaintSource: () => player._canvas || player.querySelector('canvas') || paintCanvas,
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
  const mw = media.videoWidth || media.naturalWidth || media.width || width;
  const mh = media.videoHeight || media.naturalHeight || media.height || height;
  const scale = Math.max(width / mw, height / mh);
  const dw = mw * scale;
  const dh = mh * scale;
  ctx.drawImage(media, (width - dw) / 2, (height - dh) / 2, dw, dh);
}

function shouldWatermarkExport() {
  return !isOwner() && !isPro();
}

function canExportVideo() {
  return true;
}

function consumeExportCredit() {
  if (isOwner()) return;
  setCredits(getCredits() - 1);
}

async function authHeaders() {
  const token = await firebaseAuth?.currentUser?.getIdToken?.();
  if (!token) throw new Error('unauthenticated');
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`
  };
}

async function takeExportCredit() {
  if (isOwner()) return { ok: true, spent: false, credits: getCredits() };
  const url = getPaymentEndpoint('spendCredit');
  if (!url) return { ok: false, error: 'pending' };
  const response = await fetch(url, { method: 'POST', headers: await authHeaders() });
  const data = await response.json().catch(() => ({}));
  if (response.status === 402) return { ok: false, error: 'no-credits' };
  if (!response.ok) throw new Error(data.error || 'spend-failed');
  if (Number.isFinite(Number(data.credits))) setCredits(Number(data.credits));
  return { ok: true, spent: Boolean(data.spent), credits: Number(data.credits) };
}

async function refundExportCredit() {
  if (isOwner()) return;
  const url = getPaymentEndpoint('refundCredit');
  if (!url) return;
  const response = await fetch(url, { method: 'POST', headers: await authHeaders() });
  const data = await response.json().catch(() => ({}));
  if (response.ok && Number.isFinite(Number(data.credits))) setCredits(Number(data.credits));
}

function roundRectPath(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function drawExportWatermark(ctx, width, height) {
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

async function buildComposedVideoTrack(film) {
  const vertical = state.exportLayout === 'vertical';
  const watermarked = shouldWatermarkExport();
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
  if (vertical) {
    const hd = isPro() || isOwner();
    width = hd ? 1080 : 720;
    height = hd ? 1920 : 1280;
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
      if (watermarked) drawExportWatermark(ctx, width, height);
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
  let videoPipeline = null;
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

    const watermarked = shouldWatermarkExport();
    const needsCompose = watermarked || state.exportLayout === 'vertical';
    const videoTrack = needsCompose
      ? (videoPipeline = await buildComposedVideoTrack(film)).track
      : film.getTrack();
    if (!videoTrack) throw new Error('Não deu para capturar o filme da cena.');
    if (needsCompose) onProgress?.(24, state.exportLayout === 'vertical' ? 'Montando o formato 9:16' : 'Gravando a marca d\'água no vídeo');

    const mixed = new MediaStream([
      videoTrack,
      ...dest.stream.getAudioTracks()
    ]);
    try {
      recorder = mimeType
        ? new MediaRecorder(mixed, { mimeType, videoBitsPerSecond: exportVideoBitrate() })
        : new MediaRecorder(mixed);
    } catch {
      recorder = new MediaRecorder(mixed);
    }
    recorder.onerror = (event) => {
      console.warn('MediaRecorder export error', event);
    };
    recorder.ondataavailable = (event) => {
      if (event.data?.size) chunks.push(event.data);
    };
    stopped = new Promise((resolve) => {
      recorder.onstop = resolve;
    });

    if (bed) bed.el.currentTime = 0;
    await film.play()?.catch?.(() => undefined);
    if (bed) await bed.el.play().catch(() => undefined);
    const ready = await waitForFilmReady(film);
    if (!ready) {
      throw new Error(getLang() === 'en'
        ? 'The scene video did not start. Reload the page and try again.'
        : 'O vídeo da cena não começou a tocar. Recarregue a página e tente de novo.');
    }
    recorder.start(isIOS() ? 100 : 250);
    recordingStarted = true;
    const t0 = audioCtx.currentTime + 0.05;
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
        await wait(isIOS() ? 400 : 900);
        recorder.stop();
      }
      await stopped;
    }
    stops.forEach((stop) => stop?.());
    videoPipeline?.stop();
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
    script.crossOrigin = 'anonymous';
    script.dataset.src = src;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`Não carreguei ${src}`));
    document.head.appendChild(script);
  });
}

const FFMPEG_CDNS = [
  {
    script: 'https://unpkg.com/@ffmpeg/ffmpeg@0.11.6/dist/ffmpeg.min.js',
    core: 'https://unpkg.com/@ffmpeg/core-st@0.11.1/dist/ffmpeg-core.js'
  },
  {
    script: 'https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.11.6/dist/ffmpeg.min.js',
    core: 'https://cdn.jsdelivr.net/npm/@ffmpeg/core-st@0.11.1/dist/ffmpeg-core.js'
  }
];

async function loadFfmpeg() {
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

async function convertToMp4(blob) {
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
      watermarked: Boolean(pack.watermarked),
      exportLayout: pack.exportLayout || 'original',
      dubRoles: Array.isArray(pack.dubRoles) ? pack.dubRoles : [],
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
    applyPendingCena();
    return;
  }

  for (const saved of savedSession.packs) {
    try {
      const pack = await buildPack(saved.name, saved.zipBytes);
      pack.id = saved.id;
      pack.importedAt = saved.importedAt || Date.now();
      pack.dubRoles = Array.isArray(saved.dubRoles) ? saved.dubRoles : [];
      pack.takes = {};
      Object.entries(saved.takes || {}).forEach(([id, take]) => {
        const url = rememberUrl(URL.createObjectURL(take.blob));
        pack.takes[id] = { ...take, url };
      });
      if (saved.finalBlob) {
        const savedType = String(saved.finalBlob.type || '');
        const savedExt = String(saved.finalExt || '');
        if (savedType.includes('mp4') || savedExt.includes('mp4')) {
          pack.finalBlob = saved.finalBlob;
          pack.finalExt = 'mp4';
          pack.watermarked = Boolean(saved.watermarked);
          pack.exportLayout = saved.exportLayout || 'original';
          pack.finalUrl = rememberUrl(URL.createObjectURL(saved.finalBlob));
        } else if (savedType.includes('webm') || savedExt.includes('webm')) {
          pack.finalBlob = saved.finalBlob;
          pack.finalExt = 'webm';
          pack.watermarked = Boolean(saved.watermarked);
          pack.exportLayout = saved.exportLayout || 'original';
          pack.finalUrl = rememberUrl(URL.createObjectURL(saved.finalBlob));
        }
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
  if (currentPack()) {
    selectScene(state.activeIndex);
    warmSceneAudio(currentPack().scenes);
  }
  applyPendingCena();
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
  const iosTypes = ['audio/mp4', 'audio/mp4;codecs=mp4a.40.2', 'audio/aac'];
  const defaultTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4;codecs=mp4a.40.2', 'audio/mp4'];
  const types = isIOS() ? [...iosTypes, ...defaultTypes] : defaultTypes;
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
