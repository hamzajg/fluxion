# Fluxion

**An open-source intent-driven content engine.**

Fluxion ranks a content feed by what a reader is *trying to do* (their intent)
rather than by raw engagement alone. It is a small, dependency-free core you can
embed in a feed service, a newsletter, or an agent.

## Concepts

| Concept | Meaning |
|---|---|
| **ContentItem** | A piece of content (title, body, tags, timestamp). |
| **Intent** | What the reader wants: topics, exclusions, freshness/novelty preferences. |
| **Signal** | An interaction: `view`, `like`, `save`, `share`, `skip`. |
| **Feed** | A ranked list of items with a score and human-readable reasons. |

## How ranking works

For every candidate item, Fluxion combines:

1. **Topic match** — fraction of the intent's topics present in the item's tags.
2. **Engagement** — recency-decayed, weighted signals (`skip` is negative).
3. **Freshness** — exponential decay by age.
4. **Novelty** — penalises items the reader has already viewed repeatedly.

Each factor is weighted by the intent, so the same catalogue can serve a
"catch me up" feed and a "surprise me" feed.

## Usage

```ts
import { FeedService } from 'fluxion';

const feedService = new FeedService();
feedService.addContent({
  id: 'article-1',
  title: 'Autonomous Agents in Practice',
  body: '...',
  tags: ['ai', 'agents'],
  createdAt: Date.now(),
});

feedService.recordSignal({ contentId: 'article-1', kind: 'like', at: Date.now() });

const feed = feedService.rank({ id: 'reader-1', topics: ['ai'] });
// => [{ item, score, reasons: ['topic 1/1', 'engagement', 'fresh'] }]
```

You can also use the standalone ranking core and signal store directly:

```ts
import { rankFeed, SignalStore, ContentStore } from 'fluxion';

const signals = new SignalStore();
signals.record({ contentId: 'a', kind: 'like', at: Date.now() });

const feed = rankFeed(items, { id: 'i1', topics: ['ai', 'agents'] }, signals.all());
// => [{ item, score, reasons: ['topic 2/2', 'engagement', 'fresh'] }, ...]
```

### Custom rankers

The built-in scorer can be replaced with any function that maps a candidate to
a score and reasons. Exclusions and `limit` still apply around it.

```ts
import { rankFeed, type Ranker } from 'fluxion';

const byTitleLength: Ranker = (item) => ({
  item,
  score: item.title.length,
  reasons: ['headline length'],
});

const feed = rankFeed(items, intent, signals.all(), { ranker: byTitleLength });
```

## Development

```bash
npm install
npm test          # vitest
npm run build     # tsc -> dist/
```

## Status

Early. The ranking core, pluggable rankers, and signal store are implemented and
tested; storage and an HTTP surface are next.

## License

MIT — see [LICENSE](LICENSE).
