// Stripe + Mercado Pago endpoints (Firebase Functions URLs after deploy).
// Example:
// functions.createCheckout = 'https://createcheckout-xxxx-uc.a.run.app'
window.DUBPACK_PAYMENTS = window.DUBPACK_PAYMENTS || {
  apiBase: '',
  functions: {
    createCheckout: 'https://us-central1-dub-pack-studio.cloudfunctions.net/createCheckout',
    createMercadoCheckout: 'https://us-central1-dub-pack-studio.cloudfunctions.net/createMercadoCheckout',
    verifyCheckout: 'https://us-central1-dub-pack-studio.cloudfunctions.net/verifyCheckout',
    syncAccount: 'https://us-central1-dub-pack-studio.cloudfunctions.net/syncAccount'
  },
  stripePublishableKey: 'pk_test_51U9TIJCAfyWKtqXI7n8jpefjZ29bbbTVvgEhTa2A0lf90mUwR3g3YFAhgkkbUNc9Qd6j2Zg0WwgbHLYhLYtwCZEv00HvB64Bqc',
  mercadoPagoPublicKey: ''
};
