// Copy to payments.config.js and fill in your keys.
// payments.config.js is gitignored — never commit real secrets.
window.DUBPACK_PAYMENTS = {
  // Firebase Function, Vercel, or your API that creates checkout sessions.
  apiBase: 'https://YOUR-REGION-YOUR-PROJECT.cloudfunctions.net',

  // Stripe publishable key (pk_live_... or pk_test_...)
  stripePublishableKey: '',

  // Mercado Pago public key (APP_USR-...)
  mercadoPagoPublicKey: ''
};
