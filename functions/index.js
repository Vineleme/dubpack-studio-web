const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const Stripe = require('stripe');
const { MercadoPagoConfig, Preference } = require('mercadopago');

const stripeSecret = defineSecret('STRIPE_SECRET_KEY');
const mercadoToken = defineSecret('MERCADOPAGO_ACCESS_TOKEN');

const PRO_USD = 1.99;
const PRO_BRL = 9.9;
const PACKS = {
  c100: { credits: 100, brl: 9.9, usd: 1.99, label: '+100 credits' },
  c200: { credits: 200, brl: 12.9, usd: 2.49, label: '+200 credits' },
  c300: { credits: 300, brl: 15.9, usd: 2.99, label: '+300 credits' }
};

function lineItems(items, currency) {
  return items.map((item) => {
    if (item.type === 'pro') {
      const amount = currency === 'usd' ? PRO_USD : PRO_BRL;
      return {
        name: 'DubPack PRO',
        quantity: 1,
        unit_amount: currency === 'usd' ? Math.round(amount * 100) : amount,
        credits: 200
      };
    }
    const pack = PACKS[item.id];
    if (!pack) return null;
    const qty = Number(item.quantity) || 1;
    const unit = currency === 'usd' ? pack.usd : pack.brl;
    return {
      name: pack.label,
      quantity: qty,
      unit_amount: currency === 'usd' ? Math.round(unit * 100) : unit,
      credits: pack.credits * qty
    };
  }).filter(Boolean);
}

exports.createCheckout = onRequest({
  cors: true,
  secrets: [stripeSecret, mercadoToken]
}, async (req, res) => {
  if (req.method === 'OPTIONS') return res.status(204).send('');
  if (req.method !== 'POST') return res.status(405).json({ error: 'method-not-allowed' });

  const { provider, email, items = [], returnUrl, cancelUrl } = req.body || {};
  if (!email || !Array.isArray(items) || !items.length) {
    return res.status(400).json({ error: 'invalid-payload' });
  }

  try {
    if (provider === 'stripe') {
      const stripe = new Stripe(stripeSecret.value());
      const lines = lineItems(items, 'usd');
      const session = await stripe.checkout.sessions.create({
        mode: items.some((item) => item.type === 'pro') ? 'subscription' : 'payment',
        customer_email: email,
        success_url: returnUrl,
        cancel_url: cancelUrl,
        line_items: lines.map((line) => ({
          price_data: {
            currency: 'usd',
            product_data: { name: line.name },
            unit_amount: line.unit_amount,
            ...(items.some((item) => item.type === 'pro') ? { recurring: { interval: 'month' } } : {})
          },
          quantity: line.quantity
        })),
        metadata: {
          email,
          credits: String(lines.reduce((sum, line) => sum + (line.credits || 0), 0))
        }
      });
      return res.json({ url: session.url });
    }

    if (provider === 'mercadopago') {
      const client = new MercadoPagoConfig({ accessToken: mercadoToken.value() });
      const preference = new Preference(client);
      const lines = lineItems(items, 'brl');
      const result = await preference.create({
        body: {
          payer: { email },
          back_urls: {
            success: returnUrl,
            failure: cancelUrl,
            pending: returnUrl
          },
          auto_return: 'approved',
          items: lines.map((line) => ({
            title: line.name,
            quantity: line.quantity,
            unit_price: line.unit_amount,
            currency_id: 'BRL'
          })),
          metadata: {
            email,
            credits: String(lines.reduce((sum, line) => sum + (line.credits || 0), 0))
          }
        }
      });
      return res.json({ url: result.init_point });
    }

    return res.status(400).json({ error: 'unknown-provider' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'checkout-failed' });
  }
});
