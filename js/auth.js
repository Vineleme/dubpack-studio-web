import { t, applyI18n, setLang } from './i18n-bridge.js';
import { SESSION_USER_KEY, REMEMBER_ME_KEY, USERS_KEY, OWNER_EMAILS, FIREBASE_CONFIG } from './constants.js';
import { state, els } from './state.js';
import { ensureProMonthlyCredits, isPro, proStatusLabel, renderActivity, renderCreditShop, syncAccountFromServer, updateCreditUi } from './credits.js';
import { currentPack, pruneExpiredPacks, releasePackSession, renderPackGrid, showFinalVideo, updateFinishCta } from './pack.js';
import { restoreSession } from './persist.js';
import { applyTab, refreshStudioTips } from './ui.js';
import { displayNameFromEmail, isValidEmail, normalizeEmail, toast } from './utils.js';

export let firebaseAuth = null;
export let firebaseAuthReady = Promise.resolve();
export let authListenerBound = false;
export let authBootDone = false;

export function markAuthBootDone() {
  authBootDone = true;
}

export function readRememberMe() {
  try {
    return localStorage.getItem(REMEMBER_ME_KEY) !== '0';
  } catch {
    return true;
  }
}

export function writeRememberMe(remember) {
  try {
    localStorage.setItem(REMEMBER_ME_KEY, remember ? '1' : '0');
  } catch {
    // ignore
  }
}

export async function ensureAuthPersistence(remember = readRememberMe()) {
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

export function readSessionUser() {
  try {
    const raw = localStorage.getItem(SESSION_USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function bindFirebaseAuthListener() {
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

export async function restoreAuthSession() {
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

export function initAuthRememberUi() {
  if (els.authRememberMe) els.authRememberMe.checked = readRememberMe();
}

export function readUsers() {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY) || '{}');
  } catch {
    return {};
  }
}

export function writeUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

export function accountFromFirebase(fbUser) {
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

export function isOwner(user = state.user) {
  const email = normalizeEmail(user?.email);
  if (!email) return false;
  if (user?.owner) return true;
  return OWNER_EMAILS.includes(email);
}

export function isLoggedIn() {
  return Boolean(state.user?.email || firebaseAuth?.currentUser?.email);
}

export function requireAuth() {
  showAuthGate(true);
  toast(t('auth.required'));
}

export function revealStudio() {
  els.studioApp?.classList.remove('is-hidden');
  document.body.classList.add('in-studio');
}

export function showAuthGate(on) {
  els.authGate?.classList.toggle('is-hidden', !on);
  if (on) setAuthMode(state.authMode === 'signup' || state.authMode === 'reset' ? state.authMode : 'login');
}

export function changeLang(lang) {
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

export function refreshAuthI18n() {
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

export function togglePasswordVisibility() {
  const input = els.authPassword;
  const button = els.authPasswordToggle;
  if (!input || !button) return;
  const show = input.type === 'password';
  input.type = show ? 'text' : 'password';
  button.setAttribute('aria-pressed', show ? 'true' : 'false');
  button.setAttribute('aria-label', t(show ? 'auth.password.hide' : 'auth.password.show'));
  button.classList.toggle('is-visible', show);
}

export function setPasswordVisible(show) {
  const input = els.authPassword;
  const button = els.authPasswordToggle;
  if (!input || !button) return;
  input.type = show ? 'text' : 'password';
  button.setAttribute('aria-pressed', show ? 'true' : 'false');
  button.setAttribute('aria-label', t(show ? 'auth.password.hide' : 'auth.password.show'));
  button.classList.toggle('is-visible', show);
}

export function setAuthMode(mode) {
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

export function suggestSignupName() {
  if (state.authMode === 'login' || !els.authName) return;
  const suggested = displayNameFromEmail(els.authEmail?.value);
  els.authName.placeholder = suggested && suggested !== 'Conta'
    ? `Sugestão: ${suggested}`
    : 'Como você quer ser chamado?';
}

export function openProfileTab() {
  if (!isLoggedIn()) {
    requireAuth();
    return;
  }
  if (!state.user && firebaseAuth?.currentUser) {
    void finishLogin(accountFromFirebase(firebaseAuth.currentUser), { toast: false }).then(() => applyTab('profile'));
    return;
  }
  applyTab('profile');
}

export function refreshAccountUi() {
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
  renderAvatars();
  updateCreditUi();
}

export function avatarStorageKey(email = state.user?.email) {
  const normalized = normalizeEmail(email);
  return normalized ? `dubpack-avatar:${normalized}` : '';
}

export function readAvatarUrl(email = state.user?.email) {
  const key = avatarStorageKey(email);
  return key ? localStorage.getItem(key) || '' : '';
}

export function paintAvatarShell(shell, url) {
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

export function renderAvatars() {
  const url = readAvatarUrl();
  paintAvatarShell(els.userChipAvatar, url);
  paintAvatarShell(els.profileAvatar, url);
}

export async function handleAvatarUpload(event) {
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

export function resizeAvatarFile(file) {
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

export async function finishLogin(account, options = {}) {
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
  await syncAccountFromServer();
}

export function setAuthBusy(on) {
  if (els.authSubmitBtn) els.authSubmitBtn.disabled = Boolean(on);
  if (els.authSwitchBtn) els.authSwitchBtn.disabled = Boolean(on);
  if (els.authForgotBtn) els.authForgotBtn.disabled = Boolean(on);
}

export function authErrorMessage(error) {
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

export async function submitAuth(event) {
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

export function clearAuthError() {
  els.authError?.classList.add('is-hidden');
  els.authForgotBtn?.classList.remove('is-alert');
  els.authPassword?.classList.remove('is-invalid');
}

export function showWrongPassword() {
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

export function showPasswordReset() {
  clearAuthError();
  setAuthMode('reset');
  els.authEmail?.focus();
}

export async function logoutUser() {
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
