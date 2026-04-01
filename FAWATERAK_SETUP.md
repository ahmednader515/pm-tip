# Fawaterak Integration Setup (Staging -> Production)

This project is configured to use the Fawaterak gateway for balance topups on `'/dashboard/balance'` with 3 methods:

- `cards`
- `wallets`
- `fawry`

## 1) Environment Variables

Add these values to your environment file (`.env.local` for local/dev, your host panel for staging/prod):

```env
FAWATERAK_API_TOKEN=your_staging_api_token
FAWATERAK_VENDOR_KEY=your_staging_vendor_key
FAWATERAK_BASE_URL=https://staging.fawaterk.com/api/v2
FAWATERAK_CALLBACK_BASE_URL=https://your-public-domain.com
```

Notes:

- `FAWATERAK_API_TOKEN`: used for API calls (`getPaymentmethods`, `invoiceInitPay`).
- `FAWATERAK_VENDOR_KEY`: used to verify webhook hash signatures.
- `FAWATERAK_BASE_URL`: staging now. For production switch to:
  - `https://app.fawaterk.com/api/v2` (or your exact production base from Fawaterak portal/docs).
- `FAWATERAK_CALLBACK_BASE_URL`: your real public domain where this app is deployed.

## 2) Fawaterak Dashboard Configuration

In Fawaterak merchant portal (staging):

1. Open **Integration** section.
2. Configure webhook URL to:
   - `https://your-public-domain.com/api/fawaterak/webhook_json`
3. Make sure payment methods are enabled in your account:
   - Cards
   - Wallets
   - Fawry
4. Confirm your account has valid API token and Vendor key.

Important:

- Endpoint includes `_json` because Fawaterak docs indicate this is required to receive JSON callbacks.
- Webhook hash is validated on backend before any balance update.

## 3) How It Works in This Project

### Frontend flow

1. User enters amount and selects `cards` / `wallets` / `fawry`.
2. App calls `POST /api/fawaterak/checkout`.
3. Backend creates Fawaterak invoice via `invoiceInitPay`.
4. If gateway returns redirect URL, user is redirected.
5. If gateway returns code/reference (for example Fawry), user sees details and completes payment externally.

### Webhook flow

1. Fawaterak calls `POST /api/fawaterak/webhook_json`.
2. Backend verifies `hashKey` using `FAWATERAK_VENDOR_KEY`.
3. For paid invoices:
   - App increments user balance.
   - App creates a `BalanceTransaction` record.
   - Idempotency is enforced using invoice marker in transaction description.

## 4) Test Checklist (Staging)

Run these checks after deployment:

1. Open `'/dashboard/balance'` as a student.
2. Confirm 3 methods are shown (`cards`, `wallets`, `fawry`).
3. Start a small test payment for each method.
4. Verify webhook is received and returns HTTP 200.
5. Verify user balance increases after paid webhook.
6. Verify one invoice cannot credit balance twice (idempotency).

## 5) Switch to Production Later

When you are ready:

1. Replace keys with production keys:
   - `FAWATERAK_API_TOKEN`
   - `FAWATERAK_VENDOR_KEY`
2. Update base URL:
   - `FAWATERAK_BASE_URL=https://app.fawaterk.com/api/v2`
3. Update webhook URL in production Fawaterak dashboard to your production domain.
4. Re-test all three methods with a real low-value transaction.
