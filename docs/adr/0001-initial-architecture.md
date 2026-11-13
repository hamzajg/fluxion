# ADR 0001 — Initial architecture

Date: 2026-11-13 (baseline recorded retroactively)
Status: accepted (describes what is built)

## Context

Fluxion ranks content feeds by reader intent. It is designed to be embedded
in other services (feeds, newsletters, agents), so it must stay small,
dependency-free, and easy to reason about.

## Decisions

1. **Library, not app.** No server, no CLI, no persistence layer. Consumers
   embed it; the package ships only `dist/`.
2. **Zero runtime dependencies.** Ranking is pure TypeScript over plain
   data. Rationale: KISS + embeddability — every dependency is a liability
   for an embeddable core.
3. **In-memory stores by default.** `SignalStore`/`ContentStore` hold state
   in Maps; durability is the consumer's problem. Keeps the core testable
   and side-effect free.
4. **Pure ranking function + thin façade.** `rankFeed` is a pure function
   (items + intent + signals → ranked feed); `FeedService` composes stores
   and engine for convenience. Two usage levels, one code path.
5. **Explainable scores.** Every ranked item carries `reasons: string[]` —
   ranking must be inspectable, not a black box.
6. **Intent-weighted factors.** Topic match, engagement, freshness, novelty
   are combined with per-intent weights rather than fixed global weights,
   so one catalogue serves different reader modes.

## Consequences

- Per-reader ranking at scale needs the consumer to pass filtered signal
  sets (the `actorId` field exists for this).
- No built-in persistence means production use requires a thin adapter —
  accepted trade-off for a zero-dep core.
