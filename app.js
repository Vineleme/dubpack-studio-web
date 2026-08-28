const AUDIO_EXTS = ['mp3', 'wav', 'ogg', 'm4a'];
const IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'webp', 'gif'];
const VIDEO_EXTS = ['mp4', 'mov', 'webm', 'ogv', 'm4v'];
const MAX_LINE_SECONDS = 600;
const GUIDE_VOLUME = 0.08;
const BED_VOLUME = 0.03;
const BED_EXPORT = 0.06;
const BED_DUCK = 0.012;
const TAKE_PEAK_TARGET = 0.62;
const PACK_TTL_MS = 2 * 24 * 60 * 60 * 1000;
const EXPORT_WATERMARK_LABEL = 'DubPack Studio';
const PRO_MONTHLY_PRICE = 19.9;
const PRO_MONTHLY_CREDITS = 5;
const PRO_PERIOD_MS = 30 * 24 * 60 * 60 * 1000;
const SESSION_USER_KEY = 'dubpack-user';
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
try {
  if (window.firebase?.apps?.length) {
    firebaseAuth = window.firebase.auth();
  } else if (window.firebase?.initializeApp) {
    window.firebase.initializeApp(FIREBASE_CONFIG);
    firebaseAuth = window.firebase.auth();
  }
  if (firebaseAuth) firebaseAuth.languageCode = 'pt';
} catch (error) {
  console.error(error);
  firebaseAuth = null;
}

const STUDIO_TIPS = [
  {
    title: 'Foque na emoção!',
    body: 'Transmita sentimento na sua voz. Isso faz toda a diferença na dublagem.'
  },
  {
    title: 'Ouça uma vez, depois grave',
    body: 'A referência é o guia. No take, só a sua voz no tempo da fala.'
  },
  {
    title: 'O countdown é o “ação”',
    body: 'Três segundos para respirar. Toque no microfone de novo para parar.'
  },
  {
    title: 'Fone ajuda, não é obrigatório',
    body: 'Use fone se puder, para a referência não vazar no take.'
  }
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
  captureGen: 0,
  recordingTimer: null,
  recordStopTimer: null,
  progressTimer: null,
  playbackTimer: null,
  videoTimer: null,
  activeAudio: null,
  activeAudios: [],
  playbackCtx: null,
  playbackStops: [],
  previewing: false,
  previewGen: 0,
  toastTimer: null,
  saveTimer: null,
  objectUrls: [],
  ffmpeg: null,
  exporting: false,
  user: null,
  authMode: 'login',
  tipIndex: 0,
  tipTimer: 0
};

const els = {
  packInput: document.querySelector('#packInput'),
  packInputEmpty: document.querySelector('#packInputEmpty'),
  packGrid: document.querySelector('#packGrid'),
  packRailNext: document.querySelector('#packRailNext'),
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
  userChipAvatar: document.querySelector('#userChipAvatar'),
  profileAvatar: document.querySelector('#profileAvatar'),
  profileAvatarInput: document.querySelector('#profileAvatarInput'),
  profileName: document.querySelector('#profileName'),
  profileMeta: document.querySelector('#profileMeta'),
  profileCreditsLine: document.querySelector('#profileCreditsLine'),
  dubChromeNote: document.querySelector('#dubChromeNote'),
  authGate: document.querySelector('#authGate'),
  authForm: document.querySelector('#authForm'),
  authEmail: document.querySelector('#authEmail'),
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
  authError: document.querySelector('#authError'),
  tipTitle: document.querySelector('#tipTitle'),
  tipBody: document.querySelector('#tipBody'),
  tipDots: document.querySelector('#tipDots'),
  logoutBtn: document.querySelector('#logoutBtn'),
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
  navigator.serviceWorker.register('./sw.js?v=64').catch(() => undefined);
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
  els.packInput?.addEventListener('change', importPack);
  els.packInputEmpty?.addEventListener('change', importPack);
  els.prevBtn?.addEventListener('click', () => setTab('packs'));
  els.prevSceneBtn?.addEventListener('click', () => selectScene(state.activeIndex - 1));
  els.nextSceneBtn?.addEventListener('click', goNextScene);
  els.nextBtn?.addEventListener('click', goNextScene);
  els.referenceBtn?.addEventListener('click', playReference);
  els.referenceBtnBottom?.addEventListener('click', playReference);
  els.recordBtn?.addEventListener('click', startTakeFlow);
  els.downloadTakeBtn?.addEventListener('click', downloadTake);
  els.previewBtn?.addEventListener('click', playCurrentTake);
  els.listenTakeBtn?.addEventListener('click', playCurrentTake);
  els.previewBtnAlt?.addEventListener('click', playProjectPreview);
  els.stopPreviewBtn?.addEventListener('click', stopProjectPreview);
  els.exportVideoBtn?.addEventListener('click', requestFinalMp4);
  els.exportVideoBtnSide?.addEventListener('click', requestFinalMp4);
  els.generateMp4Btn?.addEventListener('click', requestFinalMp4);
  els.downloadMp4Btn?.addEventListener('click', () => void downloadFinalMp4());
  document.querySelectorAll('[data-lang]').forEach((button) => {
    button.addEventListener('click', () => changeLang(button.dataset.lang));
  });
  els.helpBtn?.addEventListener('click', () => els.helpModal?.classList.remove('is-hidden'));
  els.helpCloseBtn?.addEventListener('click', () => els.helpModal?.classList.add('is-hidden'));
  els.helpModal?.addEventListener('click', (event) => {
    if (event.target === els.helpModal) els.helpModal.classList.add('is-hidden');
  });
  els.proBtn?.addEventListener('click', () => setTab('credits'));
  els.bellBtn?.addEventListener('click', () => setTab('credits'));
  els.logoutBtn?.addEventListener('click', logoutUser);
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

  document.querySelectorAll('[data-tab]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.preventDefault();
      setTab(button.dataset.tab);
    });
  });
}

async function bootApp() {
  applyI18n();
  updateChromeNote();
  showStudio();
  renderCreditShop();
  if (!firebaseAuth) {
    showAuthGate(true);
    toast('Firebase não carregou. Recarregue a página.');
    return;
  }
  await new Promise((resolve) => {
    const stop = firebaseAuth.onAuthStateChanged(async (fbUser) => {
      stop();
      if (fbUser) {
        await finishLogin(accountFromFirebase(fbUser), { toast: false });
      } else {
        state.user = null;
        localStorage.removeItem(SESSION_USER_KEY);
        showAuthGate(true);
      }
      resolve();
    });
  });
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
  if (isOwner()) {
    toast('Conta de dono já tem acesso total.');
    return;
  }
  if (isPro()) {
    toast('Você já é DubPack PRO neste aparelho.');
    return;
  }
  const now = Date.now();
  writeProState({
    active: true,
    subscribedAt: now,
    periodEnd: now + PRO_PERIOD_MS,
    lastCreditMonth: ''
  });
  ensureProMonthlyCredits();
  refreshAccountUi();
  toast(`DubPack PRO ativo. +${PRO_MONTHLY_CREDITS} créditos neste mês.`);
}

function proStatusLabel() {
  if (isOwner()) return t('plan.owner');
  if (!isPro()) return t('plan.free');
  const pro = readProState();
  const days = pro?.periodEnd
    ? Math.max(0, Math.ceil((Number(pro.periodEnd) - Date.now()) / (24 * 60 * 60 * 1000)))
    : 0;
  return `DubPack PRO · ${t('plan.pro.days', { days })}`;
}

function showAuthGate(on) {
  els.authGate?.classList.toggle('is-hidden', !on);
  document.body.classList.toggle('needs-auth', Boolean(on));
  if (on) setAuthMode(state.authMode === 'signup' || state.authMode === 'reset' ? state.authMode : 'login');
}

function changeLang(lang) {
  setLang(lang);
  applyI18n();
  refreshAuthI18n();
  if (state.user) refreshAccountUi();
  renderCreditShop();
  updateChromeNote();
  const pack = currentPack();
  if (pack) {
    updateFinishCta(pack);
    showFinalVideo(pack);
  }
}

function updateChromeNote() {
  els.dubChromeNote?.classList.toggle('is-hidden', isIOS());
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
  refreshAuthI18n();
  if (els.authForgotBtn) els.authForgotBtn.classList.toggle('is-hidden', reset);
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

function showStudio() {
  els.studioApp?.classList.remove('is-hidden');
  document.body.classList.add('in-studio');
}

function refreshAccountUi() {
  const user = state.user;
  const first = String(user?.name || 'dublador').split(' ')[0];
  const owner = isOwner(user);
  const pro = isPro(user);
  if (els.welcomeTitle) {
    els.welcomeTitle.textContent = user
      ? t('welcome.back', { name: first })
      : t('welcome');
  }
  if (els.userChipName) els.userChipName.textContent = user?.name || 'Conta';
  if (els.profileName) els.profileName.textContent = user?.name || 'Conta';
  if (els.profileMeta) {
    els.profileMeta.textContent = owner
      ? `${user.email} · dono do estúdio · créditos infinitos`
      : `${user?.email || ''} · ${proStatusLabel()}`;
  }
  if (els.proBtn) {
    els.proBtn.textContent = owner ? t('pro.btn.owner') : pro ? t('pro.btn.manage') : t('pro.btn');
  }
  ensureProMonthlyCredits();
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
  showStudio();
  refreshAccountUi();
  if (showToast) {
    toast(isOwner() ? 'Conta de dono ativa. Créditos infinitos.' : 'Conta pronta. Packs duram 2 dias.');
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
  updateChromeNote();
  renderActivity();
  showFinalVideo(currentPack());
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
    return 'Domínio não autorizado no Firebase. Adicione vineleme.github.io em Authentication → Settings.';
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
    if (state.authMode === 'signup') {
      const name = String(els.authName?.value || '').trim() || displayNameFromEmail(email);
      const cred = await firebaseAuth.createUserWithEmailAndPassword(email, password);
      await cred.user.updateProfile({ displayName: name });
      const owner = OWNER_EMAILS.includes(email);
      if (!owner) localStorage.setItem(`dubpack-credits:${email}`, '1');
      clearAuthError();
      await finishLogin(accountFromFirebase(cred.user));
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
  showStudio();
  setAuthMode('login');
  showAuthGate(true);
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
  toast('Abrindo o ZIP…');
  await wait(20);

  try {
    const zipBytes = new Uint8Array(await file.arrayBuffer());
    if (zipBytes.length < 4 || zipBytes[0] !== 0x50 || zipBytes[1] !== 0x4b) {
      throw new Error('Isso não é um ZIP. Importe o pack em .zip.');
    }
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
    showStudio();
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
  if (tab !== 'record') abortCapture();
  if (tab === 'record' && !state.previewing) selectScene(state.activeIndex);
  if (tab === 'dub') {
    showFinalVideo(currentPack());
    updateChromeNote();
  }
  if (tab === 'credits' || tab === 'profile') {
    updateCreditUi();
    renderCreditShop();
  }
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
  return pack?.finalUrl ? t('record.regenerate') : t('record.finish');
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
  if (done && !isIOS()) void preloadFfmpeg();
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
  void unlockAudio();
  stopActivePlayback();
  playSceneMedia(scene, scene.duration);
  animateProgress(scene.duration);
  const layers = [{ url: scene.audioUrl, volume: 1 }];
  if (isIOS()) {
    playLayersHtml(layers, scene.duration);
  } else {
    void playLayers(layers, scene.duration).catch(() => toast(iosAudioHint()));
  }
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

  abortCapture();
  stopActivePlayback();
  const gen = state.captureGen;
  await wait(isPhone() ? 80 : 0);
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
      ext: /mp4|m4a|aac/i.test(blob.type) ? 'm4a' : 'webm',
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
  els.recordBtn.setAttribute('aria-label', 'Parar');
  els.micHint.textContent = 'Fale agora · o filme fica parado nesta fala';
  if (els.recordingStatus) els.recordingStatus.textContent = 'Gravando';
  els.sceneVideo?.pause();
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
    if (isIOS()) {
      playLayersHtml(layers, scene.duration);
    } else {
      try {
        await playLayers(layers, scene.duration);
      } catch {
        toast(iosAudioHint());
      }
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
  if (isIOS() && takeLooksLikeWebm(take)) {
    toast('Este take não toca no iPhone. Grave esta fala de novo.');
    return;
  }
  void unlockAudio();
  stopActivePlayback();
  playSceneMedia(scene, scene.duration);
  animateProgress(scene.duration);
  const layers = [
    { url: take.url, volume: 1 },
    { url: scene.audioUrl, volume: BED_VOLUME }
  ];
  if (isIOS()) {
    playLayersHtml(layers, scene.duration);
  } else {
    void playLayers(layers, scene.duration).catch(() => toast(iosAudioHint()));
  }
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
  state.activeAudios = layers.map((layer) => {
    const audio = new Audio(layer.url);
    audio.preload = 'auto';
    audio.volume = Math.min(1, layer.volume);
    const playPromise = audio.play();
    if (playPromise) {
      playPromise.catch(() => toast(iosAudioHint()));
    }
    return audio;
  });
  state.activeAudio = state.activeAudios[0] || null;
  clearTimeout(state.playbackTimer);
  state.playbackTimer = setTimeout(stopActivePlayback, duration * 1000);
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
  els.tipDots.replaceChildren();
  STUDIO_TIPS.forEach((tip, index) => {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.setAttribute('aria-label', tip.title);
    dot.addEventListener('click', () => showStudioTip(index, true));
    els.tipDots.append(dot);
  });
  showStudioTip(0);
  clearInterval(state.tipTimer);
  state.tipTimer = setInterval(() => {
    showStudioTip((state.tipIndex + 1) % STUDIO_TIPS.length);
  }, 6500);
}

function showStudioTip(index, pause) {
  state.tipIndex = index;
  const tip = STUDIO_TIPS[index];
  if (els.tipTitle) els.tipTitle.innerHTML = `<strong>${tip.title}</strong>`;
  if (els.tipBody) els.tipBody.textContent = tip.body;
  els.tipDots?.querySelectorAll('button').forEach((dot, i) => {
    dot.classList.toggle('is-on', i === index);
  });
  if (pause) {
    clearInterval(state.tipTimer);
    state.tipTimer = setInterval(() => {
      showStudioTip((state.tipIndex + 1) % STUDIO_TIPS.length);
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

function renderPackGrid() {
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
  if (els.sceneVideo) els.sceneVideo.pause();
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
  if (url) state.objectUrls.push(url);
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
}

function revokeAllObjectUrls() {
  const urls = [...new Set(state.objectUrls)];
  state.objectUrls = [];
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
  if (!Number.isFinite(count) || count === Number.POSITIVE_INFINITY) return t('credit.infinite');
  const word = count === 1 ? t('credit.one') : t('credit.many');
  return `${count} ${word}`;
}

function updateCreditUi() {
  const count = getCredits();
  const label = creditLabel(count);
  if (els.creditBadge) {
    els.creditBadge.textContent = isPro() && !isOwner() ? `PRO · ${label}` : label;
  }
  if (els.creditsBalance) els.creditsBalance.textContent = label;
  if (els.profileCreditsLine) {
    els.profileCreditsLine.textContent = t('profile.body', { credits: label });
  }
  if (els.proBtn) {
    els.proBtn.textContent = isOwner() ? t('pro.btn.owner') : isPro() ? t('pro.btn.manage') : t('pro.btn');
  }
}

function renderCreditShop() {
  if (!els.creditShop) return;
  els.creditShop.replaceChildren();
  if (isOwner()) {
    const note = document.createElement('p');
    note.className = 'hint-copy';
    note.textContent = getLang() === 'en'
      ? 'Owner account: unlimited credits and exports without watermark.'
      : 'Conta de dono: créditos infinitos e exportação sem marca d\'água.';
    els.creditShop.append(note);
    return;
  }

  const proCard = document.createElement('article');
  proCard.className = `pro-plan-card${isPro() ? ' is-active' : ''}`;
  const proTitle = document.createElement('strong');
  proTitle.textContent = t('pro.card.title');
  const proPrice = document.createElement('b');
  proPrice.textContent = `R$ ${PRO_MONTHLY_PRICE.toFixed(2).replace('.', ',')}/mês`;
  const proHint = document.createElement('p');
  proHint.className = 'hint-copy';
  proHint.textContent = isPro()
    ? `${proStatusLabel()}. ${PRO_MONTHLY_CREDITS} ${t('credit.many')}, ${getLang() === 'en' ? 'no watermark' : 'sem marca d\'água'}.`
    : `${PRO_MONTHLY_CREDITS} ${t('credit.many')}/${getLang() === 'en' ? 'month' : 'mês'}, ${getLang() === 'en' ? 'no watermark on MP4' : 'MP4 sem marca d\'água'}. ${getLang() === 'en' ? 'Dubbing stays free.' : 'Dublar continua grátis.'}`;
  const proBtn = document.createElement('button');
  proBtn.type = 'button';
  proBtn.className = 'primary wide';
  proBtn.textContent = isPro() ? t('pro.active') : t('pro.subscribe');
  proBtn.disabled = isPro();
  proBtn.addEventListener('click', subscribePro);
  proCard.append(proTitle, proPrice, proHint, proBtn);
  els.creditShop.append(proCard);

  const packsTitle = document.createElement('h3');
  packsTitle.className = 'shop-section-title';
  packsTitle.textContent = t('credits.extra');
  const packsHint = document.createElement('p');
  packsHint.className = 'hint-copy';
  packsHint.textContent = t('credits.extra.hint');
  els.creditShop.append(packsTitle, packsHint);

  const packGrid = document.createElement('div');
  packGrid.className = 'credit-pack-grid';
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
    packGrid.append(button);
  });
  els.creditShop.append(packGrid);
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
    els.downloadMp4Btn.textContent = t('dub.download');
  }
  if (els.exportStatus && has) {
    els.exportStatus.textContent = pack.watermarked
      ? t('export.ready.watermark', { brand: EXPORT_WATERMARK_LABEL })
      : t('export.ready');
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
  if (!blob.type.includes('mp4')) {
    if (isIOS()) {
      toast(t('export.reexport'));
      return;
    }
    try {
      state.exporting = true;
      setExportProgress(92, 'Convertendo para MP4');
      blob = await convertToMp4(blob);
      if (pack.finalUrl) URL.revokeObjectURL(pack.finalUrl);
      pack.finalBlob = blob;
      pack.finalExt = 'mp4';
      pack.finalUrl = rememberUrl(URL.createObjectURL(blob));
      scheduleSave();
      showFinalVideo(pack);
    } catch {
      toast(t('export.reexport'));
      return;
    } finally {
      state.exporting = false;
      hideExportProgress();
    }
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${safeFile(pack.name)}-dub.mp4`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function preloadFfmpeg() {
  if (isIOS()) return Promise.resolve();
  return loadFfmpeg().catch(() => undefined);
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
  setExportProgress(2, 'Começando');
  if (els.generateMp4Btn) els.generateMp4Btn.disabled = true;
  els.exportVideoBtn.disabled = true;
  if (els.exportVideoBtnSide) els.exportVideoBtnSide.disabled = true;
  try {
    const composed = await composeDubbedVideo(pack, setExportProgress);
    let output = composed;
    if (!composed.type.includes('mp4')) {
      setExportProgress(92, 'Convertendo para MP4');
      output = await convertToMp4(composed);
    }
    if (!output.type.includes('mp4')) {
      throw new Error('Não consegui gerar MP4 neste aparelho. Tente de novo com Wi‑Fi ligado.');
    }
    setExportProgress(100, 'Pronto');
    if (pack.finalUrl) URL.revokeObjectURL(pack.finalUrl);
    pack.finalBlob = output;
    pack.finalExt = 'mp4';
    pack.watermarked = watermarked;
    pack.finalUrl = rememberUrl(URL.createObjectURL(output));
    consumeExportCredit();
    showFinalVideo(pack);
    scheduleSave();
    toast(watermarked
      ? `Dublagem pronta em MP4 com marca d'água ${EXPORT_WATERMARK_LABEL}.`
      : 'Dublagem pronta em MP4. Assista ou baixe.');
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
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm'
  ];
  // iPhone: MP4 direto. Chrome/desktop: WebM na gravação → FFmpeg converte para MP4.
  const types = isIOS() ? [...mp4Types, ...webmTypes] : [...webmTypes, ...mp4Types];
  return types.find((type) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) || '';
}

function exportVideoBitrate() {
  return isPhone() ? 1_800_000 : 3_500_000;
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
  const deadline = performance.now() + 8000;
  while (performance.now() < deadline) {
    const source = film.getPaintSource?.();
    const w = source?.videoWidth || source?.width || 0;
    const h = source?.videoHeight || source?.height || 0;
    const t = film.currentTime?.() || 0;
    if (w > 1 && h > 1 && t >= 0) return true;
    await wait(50);
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
  return !isOwner() && !isPro() && getCredits() <= 1;
}

function canExportVideo() {
  return isOwner() || getCredits() >= 1;
}

function consumeExportCredit() {
  if (isOwner()) return;
  setCredits(getCredits() - 1);
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

async function buildWatermarkedVideoTrack(film) {
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
    const videoTrack = watermarked
      ? (videoPipeline = await buildWatermarkedVideoTrack(film)).track
      : film.getTrack();
    if (!videoTrack) throw new Error('Não deu para capturar o filme da cena.');
    if (watermarked) onProgress?.(24, 'Gravando a marca d\'água no vídeo');

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
    await waitForFilmReady(film);
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
      watermarked: Boolean(pack.watermarked),
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
        const savedType = String(saved.finalBlob.type || '');
        const savedExt = String(saved.finalExt || '');
        if (savedType.includes('mp4') || savedExt.includes('mp4')) {
          pack.finalBlob = saved.finalBlob;
          pack.finalExt = 'mp4';
          pack.watermarked = Boolean(saved.watermarked);
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
