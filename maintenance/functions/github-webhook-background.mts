// While the site is paused, netlify.toml points the functions directory here so
// that only this one function is bundled and deployed. It re-exports the real
// implementation so GitHub App webhooks keep flowing without the Fly box.
// Deleted along with the rest of maintenance/ in Phase 2.
export { default } from '../../netlify/functions/github-webhook-background.mts';
