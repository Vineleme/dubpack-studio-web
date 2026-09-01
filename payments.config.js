// Stripe checkout endpoints (Firebase Functions URLs after deploy).
window.DUBPACK_PAYMENTS = window.DUBPACK_PAYMENTS || {
  apiBase: '',
  functions: {
    createCheckout: 'https://us-central1-dub-pack-studio.cloudfunctions.net/createCheckout',
    verifyCheckout: 'https://us-central1-dub-pack-studio.cloudfunctions.net/verifyCheckout',
    syncAccount: 'https://us-central1-dub-pack-studio.cloudfunctions.net/syncAccount',
    spendCredit: 'https://us-central1-dub-pack-studio.cloudfunctions.net/spendCredit',
    refundCredit: 'https://us-central1-dub-pack-studio.cloudfunctions.net/refundCredit',
    logFunnel: 'https://us-central1-dub-pack-studio.cloudfunctions.net/logFunnel'
  },
  stripePublishableKey: 'pk_test_51U9TIJCAfyWKtqXI7n8jpefjZ29bbbTVvgEhTa2A0lf90mUwR3g3YFAhgkkbUNc9Qd6j2Zg0WwgbHLYhLYtwCZEv00HvB64Bqc'
};
