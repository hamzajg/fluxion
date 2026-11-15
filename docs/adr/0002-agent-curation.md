# ADR 0002 — Agent curation via a Curator facade

Date: 2026-11-15
Status: accepted

## Context

Fluxion's purpose is to be embedded in feed services, newsletters, or
agents. The ranking core, pluggable rankers, and actor-scoped signals
already exist — but an *agent* had no first-class, typed way to curate:
it would have to call `recordSignal`/`rankFeed` directly and re-implement
actor scoping and intent shaping itself.

## Decisions

1. **`Curator` facade over `FeedService`, not new engine logic.** The
   curator composes existing primitives (`rank`, `recordSignal`) — zero
   changes to `feedEngine`. Rationale: KISS/DRY — the ranking math is
   already correct; the agent needs a *convenient, safe* surface, not a
   second engine.
2. **Actor binding at construction.** `new Curator(service, actorId)`
   injects `actorId` into every ranked intent and stamps it on every
   recorded signal. Rationale: per-reader ranking (PR #5) only works if
   signals carry the actor — making it a constructor arg removes the
   easiest mistake (forgetting `actorId`).
3. **`CurationDirective` for intent shaping.** Agents adjust topics,
   exclusions, freshness, novelty via a pure `applyDirective` — never by
   mutating the intent. Rationale: directives are inspectable, testable,
   and composable; the intent stays the caller's object.
4. **Reactions reuse `SignalKind`.** `curator.react(id, 'save'|'skip'|…)`
   records normal signals — no new signal kinds. Rationale: the engine
   already weights every kind; a parallel "boost" channel would duplicate
   the weighting rules (DRY violation).
5. **Read-only by default.** The curator cannot add/remove content —
   that's `FeedService`'s job. Rationale: separation of concerns; an
   agent curates *ranking*, not the catalogue.

## Consequences / open questions

- Directives are synchronous and in-memory — an LLM-driven curator would
  call this per request; batching/persistence is the consumer's concern.
- No agent *identity* model — `actorId` is a plain string; real
  deployments map it to their user/agent IDs.
- `applyDirective` lowercases `excludeTags` output — harmless (matching
  is case-insensitive) but noted.
- Future: directive presets, per-actor curator factories, or an HTTP
  surface when the "HTTP surface is next" work lands.
