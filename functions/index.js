const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const Stripe = require('stripe');

admin.initializeApp();
const db = admin.firestore();

const stripeSecret = defineSecret('STRIPE_SECRET_KEY');
const stripeWebhookSecret = defineSecret('STRIPE_WEBHOOK_SECRET');

const PRO_USD = 1.99;
const PRO_BRL = 9.9;
const PRO_CREDITS = 200;
const PRO_PERIOD_MS = 30 * 24 * 60 * 60 * 1000;
const PACKS = {
  c100: { credits: 100, brl: 9.9, usd: 1.99, label: '+100 credits' },
  c200: { credits: 200, brl: 12.9, usd: 2.49, label: '+200 credits' },
  c300: { credits: 300, brl: 15.9, usd: 2.99, label: '+300 credits' }
};

const ALLOWED_ORIGINS = new Set([
  'https://vineleme.github.io',
  'http://localhost:3000',
  'http://localhost:4173',
  'http://localhost:5000',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:4173',
  'http://127.0.0.1:5000'
]);

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function withCors(req, res) {
  const origin = String(req.get('origin') || '');
  if (origin && (ALLOWED_ORIGINS.has(origin) || origin.includes('github.io') || origin.includes('localhost') || origin.includes('127.0.0.1'))) {
    res.set('Access-Control-Allow-Origin', origin);
  }
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function successUrl(returnUrl) {
  const base = String(returnUrl || '').trim() || 'https://vineleme.github.io/dubpack-studio-web/';
  const joiner = base.includes('?') ? '&' : '?';
  return `${base}${joiner}checkout=success&session_id={CHECKOUT_SESSION_ID}`;
}

function summarizeItems(items, currency) {
  const hasPro = items.some((item) => item.type === 'pro');
  const hasPack = items.some((item) => item.type === 'pack');
  if (hasPro && hasPack) throw new Error('mixed-cart');

  let credits = 0;
  const lines = [];

  items.forEach((item) => {
    if (item.type === 'pro') {
      const unit = currency === 'usd' ? PRO_USD : PRO_BRL;
      credits += PRO_CREDITS;
      lines.push({
        name: 'DubPack PRO',
        quantity: 1,
        unit_amount: Math.round(unit * 100),
        credits: PRO_CREDITS,
        recurring: true
      });
      return;
    }
    const pack = PACKS[item.id];
    if (!pack) return;
    const qty = Number(item.quantity) || 1;
    const unit = currency === 'usd' ? pack.usd : pack.brl;
    credits += pack.credits * qty;
    lines.push({
      name: pack.label,
      quantity: qty,
      unit_amount: Math.round(unit * 100),
      credits: pack.credits * qty,
      recurring: false
    });
  });

  if (!lines.length) throw new Error('empty-cart');
  return { hasPro, credits, lines };
}

async function paymentAlreadyProcessed(paymentId) {
  const snap = await db.collection('payments').doc(paymentId).get();
  return snap.exists;
}

async function markPaymentProcessed(paymentId, payload) {
  await db.collection('payments').doc(paymentId).set({
    ...payload,
    processedAt: admin.firestore.FieldValue.serverTimestamp()
  });
}

async function grantPurchase(email, { credits = 0, pro = false, source, paymentId }) {
  const normalized = normalizeEmail(email);
  if (!normalized) throw new Error('missing-email');
  if (paymentId && await paymentAlreadyProcessed(paymentId)) {
    const accountSnap = await db.collection('accounts').doc(normalized).get();
    return accountSnap.data() || { credits: 0 };
  }

  const accountRef = db.collection('accounts').doc(normalized);
  const result = await db.runTransaction(async (tx) => {
    const snap = await tx.get(accountRef);
    const current = snap.data() || { credits: 1, pro: null };
    const next = {
      ...current,
      credits: Math.max(0, Number(current.credits) || 0) + Math.max(0, Number(credits) || 0),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      lastSource: source || 'stripe'
    };
    if (pro) {
      const now = Date.now();
      next.pro = {
        active: true,
        subscribedAt: now,
        periodEnd: now + PRO_PERIOD_MS,
        lastCreditMonth: new Date().toISOString().slice(0, 7)
      };
      next.credits = Math.max(next.credits, PRO_CREDITS);
    }
    tx.set(accountRef, next, { merge: true });
    return next;
  });

  if (paymentId) {
    await markPaymentProcessed(paymentId, {
      email: normalized,
      credits,
      pro,
      source: source || 'stripe'
    });
  }
  return result;
}

function stripeClient() {
  return new Stripe(String(stripeSecret.value() || '').trim());
}

function handleHttpError(res, error) {
  console.error(error);
  const message = String(error?.message || '');
  if (message === 'mixed-cart') return res.status(400).json({ error: 'mixed-cart' });
  if (message === 'empty-cart') return res.status(400).json({ error: 'empty-cart' });
  return res.status(500).json({ error: 'checkout-failed' });
}

exports.createCheckout = onRequest({
  cors: false,
  secrets: [stripeSecret]
}, async (req, res) => {
  withCors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).send('');
  if (req.method !== 'POST') return res.status(405).json({ error: 'method-not-allowed' });

  const { provider, email, items = [], returnUrl, cancelUrl, currency: rawCurrency } = req.body || {};
  if (provider !== 'stripe') return res.status(400).json({ error: 'stripe-only-endpoint' });
  if (!email || !Array.isArray(items) || !items.length) {
    return res.status(400).json({ error: 'invalid-payload' });
  }

  const currency = String(rawCurrency || 'usd').toLowerCase() === 'brl' ? 'brl' : 'usd';

  try {
    const stripe = stripeClient();
    const summary = summarizeItems(items, currency);
    const session = await stripe.checkout.sessions.create({
      mode: summary.hasPro ? 'subscription' : 'payment',
      customer_email: normalizeEmail(email),
      success_url: successUrl(returnUrl),
      cancel_url: cancelUrl || returnUrl,
      line_items: summary.lines.map((line) => ({
        price_data: {
          currency,
          product_data: { name: line.name },
          unit_amount: line.unit_amount,
          ...(line.recurring ? { recurring: { interval: 'month' } } : {})
        },
        quantity: line.quantity
      })),
      metadata: {
        email: normalizeEmail(email),
        kind: summary.hasPro ? 'pro' : 'pack',
        credits: String(summary.credits)
      }
    });
    return res.json({ url: session.url, sessionId: session.id });
  } catch (error) {
    return handleHttpError(res, error);
  }
});

exports.verifyCheckout = onRequest({
  cors: false,
  secrets: [stripeSecret]
}, async (req, res) => {
  withCors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).send('');
  if (req.method !== 'POST') return res.status(405).json({ error: 'method-not-allowed' });

  const { sessionId, email } = req.body || {};
  if (!sessionId || !email) return res.status(400).json({ error: 'invalid-payload' });

  try {
    const stripe = stripeClient();
    const session = await stripe.checkout.sessions.retrieve(String(sessionId));
    if (session.payment_status !== 'paid' && session.status !== 'complete') {
      return res.status(409).json({ error: 'not-paid' });
    }
    if (normalizeEmail(session.customer_email || session.metadata?.email) !== normalizeEmail(email)) {
      return res.status(403).json({ error: 'email-mismatch' });
    }

    const kind = session.metadata?.kind || 'pack';
    const credits = Number(session.metadata?.credits) || 0;
    const account = await grantPurchase(email, {
      credits: kind === 'pro' ? PRO_CREDITS : credits,
      pro: kind === 'pro',
      source: 'stripe-verify',
      paymentId: session.id
    });

    return res.json({
      ok: true,
      credits: account.credits,
      pro: Boolean(account.pro?.active),
      kind
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'verify-failed' });
  }
});

exports.syncAccount = onRequest({
  cors: false
}, async (req, res) => {
  withCors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).send('');
  if (req.method !== 'GET') return res.status(405).json({ error: 'method-not-allowed' });

  const email = normalizeEmail(req.query.email);
  if (!email) return res.status(400).json({ error: 'invalid-payload' });

  try {
    const snap = await db.collection('accounts').doc(email).get();
    const data = snap.data() || { credits: 1, pro: null };
    return res.json({
      credits: Number(data.credits) || 0,
      pro: data.pro || null
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'sync-failed' });
  }
});

exports.stripeWebhook = onRequest({
  cors: false,
  secrets: [stripeSecret, stripeWebhookSecret]
}, async (req, res) => {
  if (req.method !== 'POST') return res.status(405).send('method-not-allowed');

  const stripe = stripeClient();
  const signature = req.get('stripe-signature');
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.rawBody, signature, stripeWebhookSecret.value());
  } catch (error) {
    console.error(error);
    return res.status(400).send('invalid-signature');
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const email = normalizeEmail(session.customer_email || session.metadata?.email);
      const kind = session.metadata?.kind || 'pack';
      const credits = Number(session.metadata?.credits) || 0;
      await grantPurchase(email, {
        credits: kind === 'pro' ? PRO_CREDITS : credits,
        pro: kind === 'pro',
        source: 'stripe-webhook',
        paymentId: session.id
      });
    }
    if (event.type === 'invoice.paid') {
      const invoice = event.data.object;
      const email = normalizeEmail(invoice.customer_email);
      if (email) {
        await grantPurchase(email, {
          credits: PRO_CREDITS,
          pro: true,
          source: 'stripe-invoice',
          paymentId: invoice.id
        });
      }
    }
    return res.json({ received: true });
  } catch (error) {
    console.error(error);
    return res.status(500).send('webhook-failed');
  }
});
