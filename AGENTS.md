# AGENTS.md — fluxion

Guidance for AI agents (and humans) working in this repository.

## Project

Fluxion is a small, dependency-free TypeScript library that ranks a content
feed by reader *intent* (topics, exclusions, freshness/novelty preferences)
combined with engagement signals. It is meant to be embedded in feed
services, newsletters, or agents — not a standalone app.
Stack: TypeScript (ESM), zero runtime dependencies; vitest for tests.

## Commands

Verified 2026-11-13 against CI (`.github/workflows/ci.yml`) and local runs.

| Task | Command |
|---|---|
| Install deps | `npm ci` |
| Type-check | `npm run typecheck` |
| Test | `npm test` (vitest, 21 tests in `tests/`) |
| Build | `npm run build` (`tsc` → `dist/`) |

No lint/format tooling configured. No env vars, no services.

## Architecture

- `src/domain/types.ts` — all shared types: `ContentItem`, `Signal`,
  `Intent`, feed entry/result shapes. The public vocabulary; change carefully.
- `src/engine/feedEngine.ts` — pure ranking core (`rankFeed`): topic match,
  recency-decayed engagement, freshness decay, novelty penalty, weighted by
  intent. No I/O. `scoreItem` also returns `scoreParts` (per-component
  weighted contributions that sum to `score`) for explainability; custom
  `Ranker`s may omit it.
- `src/engine/signalStore.ts` — in-memory signal store (`SignalStore`).
- `src/engine/contentStore.ts` — in-memory content store (`ContentStore`).
- `src/engine/feedService.ts` — `FeedService` façade composing the stores
  and engine; the main public API.
- `src/index.ts` — barrel re-export (`export *`); everything public goes
  through here.
- `tests/` — vitest suites per module (`feedEngine`, `feedService`,
  `persistence`).

No frontend/backend split — this is a library. Consumers supply their own
persistence; the stores are in-memory by design.

## Conventions

- Domain types live only in `src/domain/types.ts`; engines take plain data,
  stores own state. Keep `feedEngine` pure (no I/O, no clock reads beyond
  passed-in timestamps).
- Timestamps are Unix epoch **milliseconds** everywhere — don't mix units.
- ESM only (`"type": "module"`); relative imports need `.js` extensions in
  source (TS resolves them to `.ts`).
- KISS/SOLID/DRY: simplest change matching existing patterns; no new
  dependencies without strong reason — the zero-dep core is a feature.

## Landmines

- `skip` signals count **negatively** in engagement — intentional, don't
  "fix" it.
- `Signal.weight` overrides the per-kind default — ranking depends on it.
- Exports use `.js` specifiers (`./domain/types.js`) because the package is
  ESM; dropping the extension breaks the build.
- `dist/` is build output; `files: ["dist"]` — don't hand-edit it.

## Agent rules

- Branch from `main`; name branches `feat/*`, `fix/*`, `chore/*`, `docs/*`.
- Docs-only changes still go through a PR; never commit to `main` directly.
- Verify before claiming: run `npm run typecheck && npm test` (and
  `npm run build` for export changes) and report the real result.
- Keep changes minimal and consistent with surrounding code. No drive-by
  refactors.
- Update AGENTS.md / docs/ARCHITECTURE.md when your change alters the public
  API (`src/index.ts` exports) or module structure.
