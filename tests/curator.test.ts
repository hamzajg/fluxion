import { describe, expect, it } from 'vitest';
import { applyDirective, Curator } from '../src/engine/curator.js';
import { FeedService } from '../src/engine/feedService.js';
import type { ContentItem, Intent } from '../src/domain/types.js';

const NOW = 10_000_000;

const aiItem: ContentItem = {
  id: 'ai',
  title: 'Multi-Agent Systems',
  body: 'Collaborative agents.',
  tags: ['AI', 'Agents'],
  createdAt: NOW,
};

const foodItem: ContentItem = {
  id: 'food',
  title: 'Quick Pasta',
  body: '15-minute dinner.',
  tags: ['Cooking', 'Food'],
  createdAt: NOW,
};

const baseIntent: Intent = { id: 'i1', topics: ['ai'], freshness: 0.5, novelty: 0.5 };

describe('applyDirective', () => {
  it('returns the same intent when no directive is given', () => {
    expect(applyDirective(baseIntent)).toBe(baseIntent);
    expect(applyDirective(baseIntent, undefined)).toBe(baseIntent);
  });

  it('adds topics without duplicates (case-insensitive)', () => {
    const next = applyDirective(baseIntent, { addTopics: ['Agents', 'agents', 'Tech'] });
    expect(next.topics).toEqual(['ai', 'Agents', 'Tech']);
  });

  it('removes topics case-insensitively', () => {
    const next = applyDirective(baseIntent, { removeTopics: ['AI'] });
    expect(next.topics).toEqual([]);
  });

  it('unions excludeTags with the intent', () => {
    const withExcl: Intent = { ...baseIntent, excludeTags: ['Cooking'] };
    const next = applyDirective(withExcl, { excludeTags: ['spam', 'cooking'] });
    expect(next.excludeTags?.sort()).toEqual(['cooking', 'spam']);
  });

  it('overrides freshness/novelty only when provided', () => {
    const next = applyDirective(baseIntent, { freshness: 0.9 });
    expect(next.freshness).toBe(0.9);
    expect(next.novelty).toBe(0.5);
  });

  it('does not mutate the input intent', () => {
    const original = { ...baseIntent, topics: [...baseIntent.topics] };
    applyDirective(baseIntent, { addTopics: ['x'], removeTopics: ['ai'], excludeTags: ['y'] });
    expect(baseIntent).toEqual(original);
  });
});

describe('Curator', () => {
  function seeded(): { service: FeedService; curator: Curator } {
    const service = new FeedService();
    service.addContents([aiItem, foodItem]);
    return { service, curator: new Curator(service, 'agent-1') };
  }

  it('ranks through the underlying service with the actor injected', () => {
    const { curator } = seeded();
    const ranked = curator.rank(baseIntent, undefined, { now: NOW });
    expect(ranked[0].item.id).toBe('ai');
    // actorId was injected: signals by other actors are invisible.
    const intent = { ...baseIntent };
    expect(curator.rank(intent, undefined, { now: NOW })).toHaveLength(2);
  });

  it('applies a directive before ranking', () => {
    const { curator } = seeded();
    const ranked = curator.rank(baseIntent, { excludeTags: ['AI'] }, { now: NOW });
    expect(ranked.map((r) => r.item.id)).toEqual(['food']);
  });

  it('react records actor-scoped signals', () => {
    const { service, curator } = seeded();
    curator.react('food', 'save', NOW);

    const signals = service.signals.all();
    expect(signals).toHaveLength(1);
    expect(signals[0]).toMatchObject({ contentId: 'food', kind: 'save', actorId: 'agent-1', at: NOW });
  });

  it('actor-scoped reactions do not leak into other actors\u2019 feeds', () => {
    const { service, curator } = seeded();
    curator.react('ai', 'skip', NOW); // agent-1 skips the AI item

    const other = new Curator(service, 'reader-2');
    const agentAi = curator
      .rank(baseIntent, undefined, { now: NOW })
      .find((r) => r.item.id === 'ai');
    const otherAi = other
      .rank(baseIntent, undefined, { now: NOW })
      .find((r) => r.item.id === 'ai');

    // agent-1 saw a skip → novelty penalty applies only to its ranking.
    expect(agentAi!.score).toBeLessThan(otherAi!.score);
  });
});
