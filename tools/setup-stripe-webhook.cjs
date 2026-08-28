/**
 * Configure Stripe webhook endpoint (does not print secret values).
 *
 * Usage (PowerShell, from repo root, with Stripe CLI logged in):
 *   node tools/setup-stripe-webhook.cjs
 *
 * Then paste the whsec_... into Firebase:
 *   firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
 *   firebase deploy --only functions:stripeWebhook
 */
const { spawnSync } = require('child_process');

const ENDPOINT = 'https://us-central1-dub-pack-studio.cloudfunctions.net/stripeWebhook';
const EVENTS = [
  'checkout.session.completed',
  'invoice.paid'
];

function run(cmd, args) {
  return spawnSync(cmd, args, { encoding: 'utf8', shell: true });
}

const which = run('where', ['stripe']);
if (which.status !== 0) {
  console.log('Stripe CLI not found.');
  console.log('1) Install: https://stripe.com/docs/stripe-cli');
  console.log('2) stripe login');
  console.log(`3) Create webhook to: ${ENDPOINT}`);
  console.log(`   Events: ${EVENTS.join(', ')}`);
  console.log('4) Copy signing secret (whsec_...) into Firebase secret STRIPE_WEBHOOK_SECRET');
  console.log('5) firebase deploy --only functions:stripeWebhook');
  process.exit(0);
}

console.log(`Creating Stripe webhook endpoint: ${ENDPOINT}`);
const created = run('stripe', [
  'webhooks',
  'create',
  '--url', ENDPOINT,
  ...EVENTS.flatMap((event) => ['--events', event]),
  '--description', 'DubPack Studio credits sync'
]);

if (created.status !== 0) {
  console.log('Could not create webhook via CLI. Create it in Stripe Dashboard:');
  console.log(`URL: ${ENDPOINT}`);
  console.log(`Events: ${EVENTS.join(', ')}`);
  console.log(created.stderr || created.stdout || '');
  process.exit(1);
}

console.log('Webhook created (or already exists).');
console.log('Next: set Firebase secret STRIPE_WEBHOOK_SECRET with the signing secret (whsec_...),');
console.log('then run: firebase deploy --only functions:stripeWebhook');
console.log('Do not paste the secret into the repo.');
