import { applyI18n, t } from './i18n-bridge.js';
import { state } from './state.js';
import { firebaseAuth, firebaseAuthReady, markAuthBootDone } from './auth.js';
import { accountFromFirebase, finishLogin, initAuthRememberUi, readRememberMe, readSessionUser, refreshAccountUi, requireAuth, restoreAuthSession, revealStudio } from './auth.js';
import { handleCheckoutReturn } from './credits.js';
import { toast } from './utils.js';
import { bindUi } from './ui.js';

export async function bootApp() {
  applyI18n();
  initAuthRememberUi();
  revealStudio();
  refreshAccountUi();
  window.DubpackCart?.initCart({
    toast,
    t,
    getUser: () => state.user,
    requireAuth
  });
  handleCheckoutReturn();
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
  const swVersion = '114';
  navigator.serviceWorker.getRegistrations()
    .then((regs) => Promise.all(regs.map((reg) => {
      const script = String(reg.active?.scriptURL || reg.waiting?.scriptURL || '');
      return script.includes(`sw.js?v=${swVersion}`) ? Promise.resolve() : reg.unregister();
    })))
    .then(() => navigator.serviceWorker.register(`./sw.js?v=${swVersion}`))
    .catch(() => undefined);
}
