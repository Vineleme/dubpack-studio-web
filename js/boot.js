import { applyI18n, t } from './i18n-bridge.js';
import { state } from './state.js';
import { firebaseAuth, firebaseAuthReady, markAuthBootDone } from './auth.js';
import { accountFromFirebase, finishLogin, hydrateLocalSession, initAuthRememberUi, refreshAccountUi, requireAuth, restoreAuthSession, revealStudio } from './auth.js';
import { handleCheckoutReturn } from './credits.js';
import { restoreSession } from './persist.js';
import { toast } from './utils.js';
import { bindUi } from './ui.js';

export async function bootApp() {
  applyI18n();
  initAuthRememberUi();
  revealStudio();
  hydrateLocalSession();
  if (state.user) {
    restoreSession().catch(() => undefined);
  }
  window.DubpackCart?.initCart({
    toast,
    t,
    getUser: () => state.user,
    requireAuth
  });
  handleCheckoutReturn();
  if (!firebaseAuth) {
    if (!state.user) toast('Firebase não carregou. Recarregue a página.');
    markAuthBootDone();
    return;
  }
  try {
    await firebaseAuthReady;
    const restored = await restoreAuthSession();
    if (!restored && firebaseAuth.currentUser) {
      await finishLogin(accountFromFirebase(firebaseAuth.currentUser), { toast: false });
    }
    refreshAccountUi();
  } finally {
    markAuthBootDone();
  }
}

try {
  bindUi();
} catch (error) {
  console.error(error);
}
bootApp();

if ('serviceWorker' in navigator) {
  const swVersion = '120';
  navigator.serviceWorker.getRegistrations()
    .then((regs) => Promise.all(regs.map((reg) => {
      const script = String(reg.active?.scriptURL || reg.waiting?.scriptURL || '');
      return script.includes(`sw.js?v=${swVersion}`) ? Promise.resolve() : reg.unregister();
    })))
    .then(() => navigator.serviceWorker.register(`./sw.js?v=${swVersion}`))
    .catch(() => undefined);
}
