// Stripe + Mercado Pago endpoints (Firebase Functions URLs after deploy).
// Example:
// functions.createCheckout = 'https://createcheckout-xxxx-uc.a.run.app'
window.DUBPACK_PAYMENTS = window.DUBPACK_PAYMENTS || {
  apiBase: '',
  functions: {
    createCheckout: '',
    createMercadoCheckout: '',
    verifyCheckout: '',
    syncAccount: ''
  },
  stripePublishableKey: '',
  mercadoPagoPublicKey: ''
};
