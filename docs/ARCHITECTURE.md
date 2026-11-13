# Architecture — fluxion

Current-state map. Descriptive, not aspirational; see `docs/adr/` for why.

## Layers

```
consumer code
    │
    ▼
src/index.ts            barrel — the only import surface
    │
    ├─ domain/types.ts    ContentItem, Signal, Intent, feed result types
    │
    └─ engine/
         ├─ feedEngine.ts    rankFeed(items, intent, signals) → ranked feed  [pure]
         ├─ signalStore.ts   SignalStore — record/all, in-memory
         ├─ contentStore.ts  ContentStore — add/get, in-memory
         └─ feedService.ts   FeedService — façade: addContent, recordSignal, rank
```

## Ranking pipeline (`rankFeed`)

For each candidate `ContentItem`, four weighted factors combine into a
score, and each contributes a human-readable `reason` string:

1. **Topic match** — fraction of `intent.topics` found in `item.tags`.
2. **Engagement** — signals weighted by kind (`view < like < save ≈ share`,
   `skip` negative), decayed by recency.
3. **Freshness** — exponential decay by item age.
4. **Novelty** — penalty for items the reader has viewed repeatedly.

Weights come from the `Intent`, so the same catalogue serves different
reader intents. `Signal.weight` can override a single signal's kind weight.

## State

Both stores are **in-memory only** — no persistence, no I/O. Consumers
embedding fluxion own durability (the `persistence` test documents the
expected usage pattern). This is deliberate: the core stays embeddable and
dependency-free.

## Public API surface

Everything exported from `src/index.ts`: all domain types plus
`rankFeed`, `SignalStore`, `ContentStore`, `FeedService`. Semver starts at
0.1.0 — the API is still allowed to move, but breaking changes should be
deliberate and documented in the PR.
