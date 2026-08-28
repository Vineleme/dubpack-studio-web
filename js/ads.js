import { t } from './i18n-bridge.js';
import { wait } from './utils.js';

const AD_SLOT_SECONDS = 5;

export function requestRewardedExport() {
  const modal = document.getElementById('adModal');
  const title = document.getElementById('adTitle');
  const body = document.getElementById('adBody');
  const action = document.getElementById('adContinueBtn');
  const cancel = document.getElementById('adCancelBtn');
  if (!modal || !action) return Promise.resolve(false);

  title && (title.textContent = t('export.ad.title'));
  body && (body.textContent = t('export.ad.body'));
  cancel && (cancel.textContent = t('export.ad.cancel'));

  let seconds = AD_SLOT_SECONDS;
  action.disabled = true;
  action.textContent = t('export.ad.wait', { seconds });
  modal.classList.remove('is-hidden');

  return new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      modal.classList.add('is-hidden');
      action.removeEventListener('click', onContinue);
      cancel?.removeEventListener('click', onCancel);
      resolve(value);
    };
    const onContinue = () => finish(true);
    const onCancel = () => finish(false);

    action.addEventListener('click', onContinue);
    cancel?.addEventListener('click', onCancel);

    const tick = async () => {
      while (seconds > 0 && !settled) {
        await wait(1000);
        seconds -= 1;
        if (!settled) {
          action.textContent = seconds > 0
            ? t('export.ad.wait', { seconds })
            : t('export.ad.continue');
        }
      }
      if (!settled) action.disabled = false;
    };
    void tick();
  });
}
