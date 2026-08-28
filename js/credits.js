import { t } from './i18n-bridge.js';
import { PRO_MONTHLY_PRICE, PRO_MONTHLY_PRICE_USD, PRO_MONTHLY_CREDITS, PRO_PERIOD_MS, CREDIT_KEY } from './constants.js';
import { state, els } from './state.js';
import { isLoggedIn, isOwner, refreshAccountUi } from './auth.js';
import { selectScene } from './pack.js';
import { setTab } from './ui.js';
import { formatBrl, normalizeEmail, toast } from './utils.js';

export function proStorageKey(email = state.user?.email) {
  const normalized = normalizeEmail(email);
  return normalized ? `dubpack-pro:${normalized}` : '';
}

export function readProState(email = state.user?.email) {
  const key = proStorageKey(email);
  if (!key) return null;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function writeProState(stateObj, email = state.user?.email) {
  const key = proStorageKey(email);
  if (!key) return;
  localStorage.setItem(key, JSON.stringify(stateObj));
}

export function isPro(user = state.user) {
  if (isOwner(user)) return true;
  const pro = readProState(user?.email);
  if (!pro?.active) return false;
  return Date.now() < Number(pro.periodEnd || 0);
}

export function ensureProMonthlyCredits() {
  if (!isPro() || isOwner()) return;
  const pro = readProState();
  if (!pro) return;
  const monthKey = new Date().toISOString().slice(0, 7);
  if (pro.lastCreditMonth === monthKey) return;
  setCredits(getCredits() + PRO_MONTHLY_CREDITS);
  writeProState({ ...pro, lastCreditMonth: monthKey });
}

export function subscribePro() {
  if (isOwner() || isPro()) {
    if (isPro() && !isOwner()) toast(t('toast.pro.already'));
    return;
  }
  addProToCart();
}

export function proStatusLabel() {
  if (isOwner()) return t('pro.card.title');
  if (!isPro()) return t('plan.free');
  const pro = readProState();
  const days = pro?.periodEnd
    ? Math.max(0, Math.ceil((Number(pro.periodEnd) - Date.now()) / (24 * 60 * 60 * 1000)))
    : 0;
  return `DubPack PRO · ${t('plan.pro.days', { days })}`;
}

export function createPricingTier({ step, title, price, priceNote, features, variant, featured, active, cta }) {
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

export function getCredits() {
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

export function setCredits(value) {
  if (isOwner()) {
    updateCreditUi();
    return;
  }
  const key = state.user?.email ? `dubpack-credits:${normalizeEmail(state.user.email)}` : CREDIT_KEY;
  localStorage.setItem(key, String(Math.max(0, value)));
  updateCreditUi();
}

export function creditLabel(count) {
  if (!Number.isFinite(count) || count === Number.POSITIVE_INFINITY) return t('credit.infinite');
  const word = count === 1 ? t('credit.one') : t('credit.many');
  return `${count} ${word}`;
}

export function creditBadgeHtml(count) {
  if (!Number.isFinite(count) || count === Number.POSITIVE_INFINITY) {
    return `<span class="credit-word">${t('credit.infinite')}</span>`;
  }
  const word = count === 1 ? t('credit.one') : t('credit.many');
  return `<span class="credit-highlight">${count}</span> <span class="credit-word">${word}</span>`;
}

export function updateCreditUi() {
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

export function renderCreditShop() {
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

export function addPackToCart(pack) {
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

export function addProToCart() {
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

export function getPaymentEndpoint(name) {
  return window.DubpackCart?.paymentEndpoint?.(name) || '';
}

export async function syncAccountFromServer() {
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

export async function verifyStripeCheckout(sessionId) {
  const url = getPaymentEndpoint('verifyCheckout');
  if (!url) {
    toast(t('cart.checkout.pending'));
    return false;
  }

  for (let i = 0; i < 12 && !state.user?.email; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  if (!state.user?.email) {
    toast(t('cart.checkout.verify'));
    return false;
  }

  let lastError = null;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
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
      }
      window.DubpackCart?.clearCart();
      refreshAccountUi();
      toast(t('cart.checkout.success'));
      return true;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 700 * (attempt + 1)));
    }
  }

  await syncAccountFromServer();
  console.error(lastError);
  toast(t('cart.checkout.verify'));
  return false;
}

export async function handleCheckoutReturn() {
  const params = new URLSearchParams(window.location.search);
  const status = params.get('checkout');
  const sessionId = params.get('session_id');
  if (!status) return;
  if (status === 'success' && sessionId) {
    await verifyStripeCheckout(sessionId);
  } else if (status === 'success') {
    await syncAccountFromServer();
    toast(t('cart.checkout.success'));
  } else if (status === 'cancel') {
    toast(t('cart.checkout.cancel'));
  }
  params.delete('checkout');
  params.delete('session_id');
  const next = `${window.location.pathname}${params.toString() ? `?${params}` : ''}${window.location.hash || ''}`;
  window.history.replaceState({}, '', next);
}

export function renderActivity() {
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

export function shouldWatermarkExport() {
  return !isOwner() && !isPro() && getCredits() <= 1;
}

export function canExportVideo() {
  return isOwner() || getCredits() >= 1;
}

export function consumeExportCredit() {
  if (isOwner()) return;
  setCredits(getCredits() - 1);
}
