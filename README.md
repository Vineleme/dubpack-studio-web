# DubPack Studio Web

Versão web/PWA do DubPack Studio (importa packs ZIP, grava no tempo da fala, exporta vídeo, créditos via Stripe).

## Rodar local

```bash
npx serve .
```

Ou:

```bash
node dev-server.js
```

## Estrutura (v105+)

- `index.html` + `styles.css` + `sw.js`
- `js/` — módulos ES (`boot.js`, `auth.js`, `pack.js`, `recorder.js`, `playback.js`, `export.js`, `credits.js`, `ui.js`, …)
- `i18n.js` / `payments.js` — scripts clássicos (globals)
- `functions/` — Firebase Functions (Stripe checkout + webhook)

## Stripe / créditos

1. Funções já deployadas: `createCheckout`, `verifyCheckout`, `syncAccount`, `stripeWebhook`
2. Após o pagamento, o front chama `verifyCheckout` (com retry) e, se preciso, `syncAccount`
3. Configure o webhook real:

```bash
node tools/setup-stripe-webhook.cjs
firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
firebase deploy --only functions:stripeWebhook
```

Nunca coloque o `whsec_...` no repositório.

## Diagnóstico

No Cursor, abra o canvas `dubpack-diagnostico.canvas.tsx` (ou peça “abre o diagnóstico”) para ver o que está verde / pendente antes de divulgar.
