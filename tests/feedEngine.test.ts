import { describe, expect, it } from 'vitest';
import type { ContentItem, Intent, RankedItem, Ranker, Signal } from '../src/domain/types.js';
import { rankFeed, scoreItem } from '../src/engine/feedEngine.js';
import { SignalStore } from '../src/engine/signalStore.js';

const DAY = 86_400_000;
const NOW = 1_000 * DAY;

function item(id: string, tags: string[], ageDays = 0): ContentItem {
  return {
    id,
    title: `Item ${id}`,
    body: `Body ${id}`,
    tags,
    createdAt: NOW - ageDays * DAY,
  };
}

const intent: Intent = { id: 'i1', topics: ['ai', 'agents'] };

describe('rankFeed', () => {
  it('ranks topical items above unrelated ones', () => {
    const ranked = rankFeed(
      [item('unrelated', ['cooking']), item('topical', ['ai', 'agents'])],
      intent,
      [],
      { now: NOW },
    );

    expect(ranked[0].item.id).toBe('topical');
    expect(ranked[0].reasons).toContain('topic 2/2');
  });

  it('excludes tags named in the intent', () => {
    const ranked = rankFeed(
      [item('a', ['ai']), item('b', ['ai', 'sponsored'])],
      { ...intent, excludeTags: ['sponsored'] },
      [],
      { now: NOW },
    );

    expect(ranked.map((r) => r.item.id)).toEqual(['a']);
  });

  it('boosts items with positive signals', () => {
    const signals = new SignalStore();
    signals.record({ contentId: 'liked', kind: 'like', at: NOW });
    signals.record({ contentId: 'liked', kind: 'save', at: NOW });

    const ranked = rankFeed([item('plain', []), item('liked', [])], intent, signals.all(), {
      now: NOW,
    });

    expect(ranked[0].item.id).toBe('liked');
    expect(ranked[0].reasons).toContain('engagement');
  });

  it('respects the limit', () => {
    const items = [item('a', []), item('b', []), item('c', [])];
    expect(rankFeed(items, intent, [], { now: NOW, limit: 2 })).toHaveLength(2);
  });

  it('prefers fresher items when freshness is weighted', () => {
    const ranked = rankFeed(
      [item('old', [], 60), item('new', [], 0)],
      { id: 'fresh', topics: [], freshness: 1, novelty: 0 },
      [],
      { now: NOW },
    );

    expect(ranked[0].item.id).toBe('new');
  });
});

describe('scoreItem', () => {
  it('marks heavily viewed items as seen before', () => {
    const signals: Signal[] = [1, 2, 3, 4].map((i) => ({
      contentId: 'x',
      kind: 'view' as const,
      at: NOW - i * DAY,
    }));

    const scored = scoreItem(item('x', []), intent, signals, NOW);

    expect(scored.reasons).toContain('seen before');
  });
});

describe('SignalStore', () => {
  it('aggregates signals per content', () => {
    const store = new SignalStore();
    store.record({ contentId: 'a', kind: 'view', at: NOW });
    store.record({ contentId: 'b', kind: 'like', at: NOW });
    store.record({ contentId: 'a', kind: 'share', at: NOW });

    expect(store.size).toBe(3);
    expect(store.forContent('a')).toHaveLength(2);
    expect(store.all()).toHaveLength(3);

    store.clear();
    expect(store.size).toBe(0);
  });
});

describe('pluggable rankers', () => {
  it('uses a custom ranker to score and order items', () => {
    const byTitleLength: Ranker = (i) => ({ item: i, score: i.title.length, reasons: ['custom'] });

    const ranked = rankFeed(
      [
        { ...item('short', []), title: 'Hi' },
        { ...item('long', []), title: 'A much longer headline' },
      ],
      intent,
      [],
      { now: NOW, ranker: byTitleLength },
    );

    expect(ranked[0].item.id).toBe('long');
    expect(ranked.every((r) => r.reasons.includes('custom'))).toBe(true);
  });

  it('still applies exclusions and limit around a custom ranker', () => {
    const constant: Ranker = (i): RankedItem => ({ item: i, score: 1, reasons: [] });

    const ranked = rankFeed(
      [item('a', ['ai']), item('b', ['ai', 'sponsored']), item('c', ['ai'])],
      { ...intent, excludeTags: ['sponsored'] },
      [],
      { now: NOW, ranker: constant, limit: 1 },
    );

    expect(ranked.map((r) => r.item.id)).toEqual(['a']);
  });

  it('defaults to the built-in scorer when no ranker is given', () => {
    const ranked = rankFeed([item('x', ['ai', 'agents'])], intent, [], { now: NOW });

    expect(ranked[0].reasons).toContain('topic 2/2');
  });
});

describe('actor-scoped ranking', () => {
  const alice: Intent = { ...intent, actorId: 'alice' };
  const bob: Intent = { ...intent, actorId: 'bob' };

  const views: Signal[] = [1, 2, 3, 4].map((i) => ({
    contentId: 'x',
    kind: 'view' as const,
    at: NOW - i * DAY,
    actorId: 'alice',
  }));

  it('hides another actor\'s history from novelty and engagement', () => {
    const forAlice = scoreItem(item('x', []), alice, views, NOW);
    const forBob = scoreItem(item('x', []), bob, views, NOW);

    expect(forAlice.reasons).toContain('seen before');
    expect(forBob.reasons).not.toContain('seen before');
    // Alice's views still count as (mild) engagement for Alice only.
    expect(forAlice.reasons).toContain('engagement');
    expect(forBob.reasons).not.toContain('engagement');
  });

  it('keeps unattributed signals visible to every actor', () => {
    const global: Signal[] = [
      { contentId: 'x', kind: 'like', at: NOW },
    ];

    const forBob = scoreItem(item('x', []), bob, global, NOW);

    expect(forBob.reasons).toContain('engagement');
  });

  it('ranks the whole feed per actor through rankFeed', () => {
    const signals = [
      ...views,
      { contentId: 'y', kind: 'like' as const, at: NOW, actorId: 'bob' },
    ];

    const forBob = rankFeed([item('x', []), item('y', [])], bob, signals, { now: NOW });
    const forAlice = rankFeed([item('x', []), item('y', [])], alice, signals, { now: NOW });

    // Bob liked y; Alice's four views on x must not leak into Bob's feed.
    expect(forBob[0].item.id).toBe('y');
    // For Alice, y's like is invisible and x is "seen before".
    expect(forAlice.map((r) => r.item.id)).toEqual(['x', 'y']);
  });

  it('treats a missing actorId as the global feed (backwards compatible)', () => {
    const ranked = rankFeed([item('x', [])], intent, views, { now: NOW });

    expect(ranked[0].reasons).toContain('seen before');
  });
});

describe('scoreItem scoreParts', () => {
  it('parts sum to the total score', () => {
    const signals = [
      { contentId: 'x', kind: 'like' as const, at: NOW },
      { contentId: 'x', kind: 'view' as const, at: NOW },
    ];
    const ranked = scoreItem(item('x', ['ai'], 1), intent, signals, NOW);

    const parts = ranked.scoreParts;
    expect(parts).toBeDefined();
    const sum = parts!.topic + parts!.engagement + parts!.freshness + parts!.novelty;
    expect(sum).toBeCloseTo(ranked.score, 10);
  });

  it('topic part reflects full topic match', () => {
    const full = scoreItem(item('x', ['ai', 'agents']), intent, [], NOW);
    const none = scoreItem(item('x', ['cooking']), intent, [], NOW);

    expect(full.scoreParts!.topic).toBe(3);
    expect(none.scoreParts!.topic).toBe(0);
    expect(full.score).toBeGreaterThan(none.score);
  });
});
