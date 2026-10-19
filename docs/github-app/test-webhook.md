# Testing the GitHub App Webhook

GitHub App webhooks are handled by the Netlify Background Function
`netlify/functions/github-webhook-background.mts`. The Fly.io service that used
to receive them (`contributor-info-webhooks`) was removed in Oct 2026
(cost-reduction plan, Phase 1a). There is no health or metrics endpoint any
more; the durable record of every delivery is the `idempotency_keys` table.

- **Production webhook URL**: `https://contributor.info/.netlify/functions/github-webhook-background`
- **Legacy URLs that still work**: `/api/github-webhook`, `/api/github/webhook` (rewritten to the function)
- **Response**: always `202 Accepted`, sent by Netlify before the function runs. A 202 means
  "received", not "processed". Check `idempotency_keys` for the outcome.
- **Events processed**: `pull_request`, `issues`, `issue_comment`, `installation`,
  `installation_repositories`. Anything else (`ping`, `check_run`, `label`, …) is logged
  and dropped.

## 1. Check configuration

Required Netlify environment variables (Site settings → Environment variables):

| Variable | Purpose |
|---|---|
| `GITHUB_APP_WEBHOOK_SECRET` | Verifies `X-Hub-Signature-256` |
| `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY` (base64 PEM) | Installation tokens for handlers that call GitHub |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Writes bypass RLS; the anon key cannot write `github_app_installations` |

```bash
netlify env:list | grep -E 'GITHUB_APP|SUPABASE_SERVICE_ROLE_KEY'
```

## 2. Send a ping

1. Open the GitHub App settings: https://github.com/settings/apps/contributor-info
2. Confirm the webhook URL above and that the secret matches `GITHUB_APP_WEBHOOK_SECRET`.
3. "Advanced" → "Recent Deliveries" → "Redeliver" a `ping`.
4. The delivery shows `202`. `ping` is not a handled event, so no `idempotency_keys` row is
   written; the function log shows `ignoring event ping`.

## 3. Redeliver a real event

1. In "Recent Deliveries", pick one delivery each of `installation`,
   `installation_repositories`, `pull_request`, `issues`, `issue_comment` and click
   "Redeliver".
2. Each should produce one row:

```sql
select key, status, created_at,
       response->>'duration_ms' as duration_ms,
       response->>'error'       as error,
       metadata->>'event'       as event,
       metadata->>'action'      as action
from idempotency_keys
where endpoint = 'github-webhook-background'
order by created_at desc
limit 20;
```

- `completed`: the handler ran. Its return value is in `response->'result'`.
- `failed`: the handler threw. `response->>'error'` has the message. Redelivering the same
  delivery id retries it.
- `processing` older than 20 minutes: the invocation died. Redelivering retries it.
- A redelivery of a `completed` delivery is skipped (duplicate delivery id).

## 4. Read the function logs

Netlify UI: Project → Logs → Functions → `github-webhook-background` (pick the production
deploy, or `deploypreview:<pr>` for a preview). CLI, production only:

```bash
netlify logs:function github-webhook-background
```

Log lines are prefixed `github-webhook-background:` and include the delivery id.

## 5. Local testing

```bash
netlify dev
# in another terminal
ngrok http 8888
```

Point the GitHub App (or a test App) at
`https://<ngrok-host>/.netlify/functions/github-webhook-background` and redeliver. Local
runs need the same environment variables as production in `.env`.

To exercise the signature check without GitHub:

```bash
BODY='{"zen":"test"}'
SIG="sha256=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$GITHUB_APP_WEBHOOK_SECRET" | awk '{print $2}')"
curl -i -X POST http://localhost:8888/.netlify/functions/github-webhook-background \
  -H 'content-type: application/json' -H 'x-github-event: ping' \
  -H 'x-github-delivery: local-1' -H "x-hub-signature-256: $SIG" -d "$BODY"
```

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| Log says `invalid signature` | `GITHUB_APP_WEBHOOK_SECRET` differs from the App's webhook secret |
| Row is `failed` with an RLS or permission error | `SUPABASE_SERVICE_ROLE_KEY` missing; the function then falls back to anon |
| Row is `failed` with a GitHub auth error | `GITHUB_APP_ID` / `GITHUB_APP_PRIVATE_KEY` missing or the PEM is not base64 |
| No row at all | Event type is not handled, or the function was not deployed (check the deploy's functions list) |
| GitHub shows a non-2xx | Netlify itself rejected the request (function missing, platform error); redeliver after the next deploy |

## History

- Netlify sync function (≤ 10 s) → Fly.io Express service (Jan 2025, see
  [fly-webhook-migration.md](../infrastructure/fly-webhook-migration.md)) → Netlify Background
  Function (Oct 2026, 202 + up to 15 min, no always-on machine).
