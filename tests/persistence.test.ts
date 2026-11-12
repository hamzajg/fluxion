import { describe, expect, it } from 'vitest';
import { ContentStore } from '../src/engine/contentStore.js';
import { FeedService } from '../src/engine/feedService.js';
import { SignalStore } from '../src/engine/signalStore.js';
import type { ContentItem, Intent } from '../src/domain/types.js';

const itemA: ContentItem = {
  id: 'a',
  title: 'Understanding Multi-Agent Systems',
  body: 'A deep dive into collaborative autonomous agents.',
  tags: ['AI', 'Agents'],
  createdAt: 1_000_000,
};

const itemB: ContentItem = {
  id: 'b',
  title: 'Cooking Quick Pasta',
  body: 'Easy 15-minute dinner recipes.',
  tags: ['Cooking', 'Food'],
  createdAt: 1_000_000,
};

const itemC: ContentItem = {
  id: 'c',
  title: 'Building Modern Web Apps',
  body: 'React, TypeScript, and Vite best practices.',
  tags: ['Tech', 'React', 'AI'],
  createdAt: 1_000_000,
};

const intent: Intent = { id: 'reader-1', topics: ['ai', 'agents'] };

describe('ContentStore persistence', () => {
  it('round-trips items and rebuilds the tag index', () => {
    const store = new ContentStore();
    store.addMany([itemA, itemB, itemC]);

    const snapshot = store.serialize();
    // Prove it is plain JSON-safe data, not live object references.
    const wire = JSON.parse(JSON.stringify(snapshot)) as ContentItem[];

    const restored = new ContentStore();
    restored.restore(wire);

    expect(restored.size).toBe(3);
    expect(restored.get('a')).toEqual(itemA);
    expect(restored.findByTag('ai').map((i) => i.id)).toEqual(['a', 'c']);
    expect(restored.findByTag('cooking').map((i) => i.id)).toEqual(['b']);
  });

  it('restore replaces existing content wholesale', () => {
    const store = new ContentStore();
    store.addMany([itemA, itemB]);
    store.restore([itemC]);

    expect(store.size).toBe(1);
    expect(store.get('a')).toBeUndefined();
    expect(store.findByTag('ai').map((i) => i.id)).toEqual(['c']);
  });
});

describe('SignalStore persistence', () => {
  it('round-trips the signal log in insertion order', () => {
    const store = new SignalStore();
    store.record({ contentId: 'a', kind: 'view', at: 1 });
    store.record({ contentId: 'a', kind: 'like', at: 2, actorId: 'r1' });
    store.record({ contentId: 'b', kind: 'skip', at: 3, weight: -2 });

    const wire = JSON.parse(JSON.stringify(store.serialize()));
    const restored = new SignalStore();
    restored.restore(wire);

    expect(restored.size).toBe(3);
    expect(restored.all()).toEqual(store.all());
    expect(restored.forContent('a').map((s) => s.kind)).toEqual(['view', 'like']);
  });

  it('restore replaces the log wholesale', () => {
    const store = new SignalStore();
    store.record({ contentId: 'a', kind: 'view', at: 1 });
    store.restore([{ contentId: 'b', kind: 'save', at: 2 }]);

    expect(store.size).toBe(1);
    expect(store.all()[0].contentId).toBe('b');
  });
});

describe('FeedService persistence', () => {
  it('snapshot/restore preserves ranking behaviour exactly', () => {
    const service = new FeedService();
    service.addContents([itemA, itemB, itemC]);
    service.recordSignal({ contentId: 'c', kind: 'like', at: 1_000_000 });
    service.recordSignal({ contentId: 'a', kind: 'view', at: 1_000_000 });

    const before = service.rank(intent, { now: 1_000_000 });

    // Persist through JSON, the way a real caller would.
    const wire = JSON.parse(JSON.stringify(service.snapshot()));

    const restored = new FeedService();
    restored.restore(wire);
    const after = restored.rank(intent, { now: 1_000_000 });

    expect(after).toEqual(before);
    expect(restored.content.size).toBe(3);
    expect(restored.signals.size).toBe(2);
  });
});
