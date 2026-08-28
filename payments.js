const CART_KEY = 'dubpack-cart';

const cartState = {
  items: [],
  hooks: {
    toast: (message) => window.alert(message),
    t: (key, params) => key,
    getUser: () => null
  }
};

function paymentEndpoint(name) {
  const config = window.DUBPACK_PAYMENTS || {};
  if (config.functions?.[name]) return config.functions[name];
  const base = String(config.apiBase || '').replace(/\/$/, '');
  return base ? `${base}/${name}` : '';
}

function cartStorageKey() {
  const email = cartState.hooks.getUser()?.email;
  return email ? `${CART_KEY}:${String(email).trim().toLowerCase()}` : CART_KEY;
}

function loadCart() {
  try {
    const raw = localStorage.getItem(cartStorageKey());
    cartState.items = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(cartState.items)) cartState.items = [];
  } catch {
    cartState.items = [];
  }
}

function saveCart() {
  localStorage.setItem(cartStorageKey(), JSON.stringify(cartState.items));
}

function formatUsd(value) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value) || 0);
}

function formatBrlCart(value) {
  const amount = Number.isInteger(value)
    ? `R$ ${value},00`
    : `R$ ${Number(value).toFixed(2).replace('.', ',')}`;
  return amount;
}

function cartTotals() {
  return cartState.items.reduce((totals, item) => {
    const qty = Number(item.quantity) || 1;
    totals.brl += (Number(item.priceBrl) || 0) * qty;
    totals.usd += (Number(item.priceUsd) || 0) * qty;
    totals.credits += (Number(item.credits) || 0) * qty;
    return totals;
  }, { brl: 0, usd: 0, credits: 0 });
}

function addCartItem(item) {
  if (!item?.id) return;
  loadCart();
  if (item.type === 'pro') {
    cartState.items = cartState.items.filter((row) => row.type !== 'pro');
    cartState.items.push({ ...item, quantity: 1 });
  } else {
    const existing = cartState.items.find((row) => row.id === item.id && row.type === item.type);
    if (existing) existing.quantity = (Number(existing.quantity) || 1) + 1;
    else cartState.items.push({ ...item, quantity: 1 });
  }
  saveCart();
  renderCart();
  cartState.hooks.toast(cartState.hooks.t('cart.added', { label: item.label }));
}

function removeCartItem(id, type = 'pack') {
  loadCart();
  cartState.items = cartState.items.filter((row) => !(row.id === id && row.type === type));
  saveCart();
  renderCart();
}

function clearCart() {
  cartState.items = [];
  saveCart();
  renderCart();
}

function paintCartPanel(root, items, totals) {
  const list = root.querySelector('[data-cart-items]');
  const empty = root.querySelector('[data-cart-empty]');
  const footer = root.querySelector('[data-cart-footer]');
  const totalBrl = root.querySelector('[data-cart-total-brl]');
  const totalUsd = root.querySelector('[data-cart-total-usd]');
  if (!list || !empty || !footer) return;

  list.replaceChildren();
  if (!items.length) {
    empty.hidden = false;
    footer.classList.add('is-hidden');
    root.classList.remove('has-items');
    return;
  }

  empty.hidden = true;
  footer.classList.remove('is-hidden');
  root.classList.add('has-items');

  items.forEach((item) => {
    const row = document.createElement('li');
    row.className = 'side-cart-item';

    const meta = document.createElement('div');
    meta.className = 'side-cart-item-meta';
    const title = document.createElement('strong');
    title.textContent = item.label;
    const detail = document.createElement('span');
    const qty = Number(item.quantity) || 1;
    const credits = (Number(item.credits) || 0) * qty;
    detail.textContent = item.type === 'pro'
      ? cartState.hooks.t('cart.item.pro')
      : cartState.hooks.t('cart.item.credits', { count: credits });
    meta.append(title, detail);

    const price = document.createElement('b');
    price.textContent = `${formatBrlCart(item.priceBrl * qty)} · ${formatUsd(item.priceUsd * qty)}`;

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'side-cart-remove';
    removeBtn.setAttribute('aria-label', cartState.hooks.t('cart.remove'));
    removeBtn.textContent = '×';
    removeBtn.addEventListener('click', () => removeCartItem(item.id, item.type));

    row.append(meta, price, removeBtn);
    list.append(row);
  });

  if (totalBrl) totalBrl.textContent = formatBrlCart(totals.brl);
  if (totalUsd) totalUsd.textContent = formatUsd(totals.usd);
}

function renderCart() {
  loadCart();
  const items = cartState.items;
  const totals = cartTotals();
  const itemCount = items.reduce((sum, row) => sum + (Number(row.quantity) || 1), 0);

  document.querySelectorAll('[data-cart-count]').forEach((node) => {
    node.textContent = String(itemCount);
  });
  document.querySelectorAll('[data-cart-badge]').forEach((node) => {
    node.textContent = String(itemCount);
    node.hidden = itemCount === 0;
  });
  document.querySelectorAll('[data-cart-panel]').forEach((root) => paintCartPanel(root, items, totals));
}

function scrollToCart() {
  const mobile = window.matchMedia('(max-width: 860px)').matches;
  const target = mobile
    ? document.querySelector('#shopCart')
    : document.querySelector('#sideCart');
  target?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

async function checkoutCart(provider) {
  loadCart();
  if (!cartState.items.length) {
    cartState.hooks.toast(cartState.hooks.t('cart.empty.checkout'));
    return;
  }
  const user = cartState.hooks.getUser();
  if (!user?.email) {
    cartState.hooks.toast(cartState.hooks.t('cart.login'));
    return;
  }

  const config = window.DUBPACK_PAYMENTS || {};
  const checkoutUrl = provider === 'mercadopago'
    ? paymentEndpoint('createMercadoCheckout')
    : paymentEndpoint('createCheckout');
  if (!checkoutUrl) {
    cartState.hooks.toast(cartState.hooks.t('cart.checkout.pending'));
    return;
  }

  const totals = cartTotals();
  const hasPro = cartState.items.some((item) => item.type === 'pro');
  const hasPack = cartState.items.some((item) => item.type === 'pack');
  if (hasPro && hasPack) {
    cartState.hooks.toast(cartState.hooks.t('cart.checkout.split'));
    return;
  }

  const payload = {
    provider,
    email: user.email,
    name: user.name || '',
    currency: provider === 'stripe' ? 'usd' : 'brl',
    amount: provider === 'stripe' ? totals.usd : totals.brl,
    items: cartState.items,
    returnUrl: `${window.location.origin}${window.location.pathname}?checkout=success`,
    cancelUrl: `${window.location.origin}${window.location.pathname}?checkout=cancel`
  };

  try {
    const response = await fetch(checkoutUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'checkout-failed');
    const redirect = data.url || data.init_point || data.checkout_url;
    if (!redirect) throw new Error('missing-redirect');
    window.location.href = redirect;
  } catch (error) {
    console.error(error);
    cartState.hooks.toast(cartState.hooks.t('cart.checkout.error'));
  }
}

function initCart(hooks = {}) {
  cartState.hooks = { ...cartState.hooks, ...hooks };
  loadCart();
  renderCart();
  if (cartState.bound) return;
  cartState.bound = true;
  document.body.addEventListener('click', (event) => {
    if (event.target.closest('[data-cart-checkout="mercadopago"]')) checkoutCart('mercadopago');
    if (event.target.closest('[data-cart-checkout="stripe"]')) checkoutCart('stripe');
    if (event.target.closest('[data-cart-clear]')) clearCart();
  });
}

window.DubpackCart = {
  initCart,
  addCartItem,
  removeCartItem,
  clearCart,
  renderCart,
  loadCart,
  scrollToCart,
  paymentEndpoint
};
