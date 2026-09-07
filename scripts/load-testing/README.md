# Load Testing

k6 load tests for the Supabase `queue-event` edge function and its idempotency layer. Requires [k6](https://k6.io) installed locally. Every test reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from the environment; pass them with `-e` when running k6 directly.

## Runners

| Script | Purpose |
|--------|---------|
| `run-tests.sh` | Run the numbered k6 scenarios below in order and write reports |
| `run-idempotency-tests.sh` | Run only the idempotency scenarios |
| `quick-test.js` | Node.js smoke test for rapid validation without k6 |

## k6 scenarios

| Script | Scenario |
|--------|----------|
| `01-sustained-load.js` | Steady request rate for a fixed duration |
| `02-burst-traffic.js` | Short high-volume bursts |
| `03-concurrent-connections.js` | Many simultaneous connections |
| `04-circuit-breaker.js` | Behavior when the downstream service fails |
| `05-stress-test.js` | Ramp until the function degrades |
| `idempotency-load-test.js` | Duplicate requests under load; measures detection and cache-hit rates |
| `config.js` | Shared thresholds, endpoints, and environment handling |

## Docs

- [readme-idempotency.md](./readme-idempotency.md) - Design of the idempotency test suite and what its metrics mean
- [docs/testing/load-testing-guide.md](../../docs/testing/load-testing-guide.md)
- [docs/infrastructure/idempotency-implementation.md](../../docs/infrastructure/idempotency-implementation.md)
