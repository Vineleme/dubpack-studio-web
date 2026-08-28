// 1) Create a Stripe account: https://dashboard.stripe.com/register
// 2) Copy the test Publishable key (pk_test_...) into stripePublishableKey below.
// 3) Deploy Firebase Functions (see repo functions/ folder).
// 4) Paste each function URL into functions.createCheckout / verifyCheckout / syncAccount.
// 5) In Stripe → Developers → Webhooks, add endpoint:
//    https://YOUR-STRIPE-WEBHOOK-URL (from Firebase stripeWebhook function)
//    Events: checkout.session.completed, invoice.paid
// 6) Save the webhook signing secret as Firebase secret STRIPE_WEBHOOK_SECRET.
window.DUBPACK_PAYMENTS = {
  apiBase: '',
  functions: {
    createCheckout: '',
    createMercadoCheckout: '',
    verifyCheckout: '',
    syncAccount: ''
  },
  stripePublishableKey: 'pk_test_REPLACE_ME',
  mercadoPagoPublicKey: ''
};
