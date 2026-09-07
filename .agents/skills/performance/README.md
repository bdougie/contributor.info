# Performance Skill

Audit, improve, and verify frontend loading performance in SPAs. React + Vite is the reference stack; the method and most snippets apply to any client-rendered app with an edge in front of it.

## Install in another repo

```bash
# from a checkout of this repo
cp -R .agents/skills/performance /path/to/other-repo/.agents/skills/performance
ln -s ../../.agents/skills/performance /path/to/other-repo/.claude/skills/performance

# or with the skills CLI
npx skills add bdougie/contributor.info --skill performance
```

## What is in here

- `SKILL.md` — the method (measure, trace, apply in priority order, verify, gate) and the rules that hold across repos.
- `references/progressive-loading.md` — the layered loading model with snippets: SSR shell and safe inline data, hydration-aware Suspense, cache-seeded hooks, idle deferral, request dedup, debounced status, intersection-gated charts, vendor tiering.
- `references/bundling.md` — Vite chunking and preload allowlists, ordering traps, what not to split, host interlocks.
- `references/measurement.md` — Lighthouse CI shape, RUM tagged by route, a bundle gate that runs, slow-network tests, how to write perf docs that stay true.
- `references/checklist.md` — pre-merge checks, all tool-verifiable.

## Example prompts

- "Audit the loading performance of the /workspaces route and tell me what is on the LCP critical path."
- "This page flashes a skeleton after SSR. Fix it."
- "Add a chart to the repo page without hurting LCP."
- "Our bundle size check never fails. Find out why."
- "Review docs/performance for anything the code no longer matches."

## Provenance

Distilled from contributor.info's `/:owner/:repo` page. `docs/performance/progressive-loading.md` in that repo is the worked example with file:line citations; `tasks/performance-audit-2026-09-07.md` is the audit that produced this skill.
