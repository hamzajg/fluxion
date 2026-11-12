import { describe, expect, it } from 'vitest';
import { ContentStore } from '../src/engine/contentStore.js';
import { FeedService } from '../src/engine/feedService.js';
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

describe('ContentStore', () => {
  it('adds and retrieves items by id', () => {
    const store = new ContentStore();
    store.add(itemA);
    store.add(itemB);

    expect(store.size).toBe(2);
    expect(store.has('a')).toBe(true);
    expect(store.has('c')).toBe(false);
    expect(store.get('a')).toEqual(itemA);
    expect(store.get('b')).toEqual(itemB);
  });

  it('indexes tags case-insensitively and finds by tag', () => {
    const store = new ContentStore();
    store.addMany([itemA, itemB, itemC]);

    const aiItems = store.findByTag('ai');
    expect(aiItems.map((i) => i.id)).toEqual(['a', 'c']);

    const cookingItems = store.findByTag('COOKING');
    expect(cookingItems.map((i) => i.id)).toEqual(['b']);

    expect(store.findByTag('nonexistent')).toEqual([]);
  });

  it('updates item and tag index on overwrite', () => {
    const store = new ContentStore();
    store.add(itemA);

    const updatedA: ContentItem = {
      ...itemA,
      tags: ['Robotics'],
    };
    store.add(updatedA);

    expect(store.size).toBe(1);
    expect(store.get('a')?.tags).toEqual(['Robotics']);
    expect(store.findByTag('ai')).toEqual([]);
    expect(store.findByTag('robotics').map((i) => i.id)).toEqual(['a']);
  });

  it('deletes items and cleans up tag index', () => {
    const store = new ContentStore();
    store.addMany([itemA, itemB]);

    expect(store.delete('a')).toBe(true);
    expect(store.delete('a')).toBe(false);
    expect(store.size).toBe(1);
    expect(store.get('a')).toBeUndefined();
    expect(store.findByTag('ai')).toEqual([]);
    expect(store.findByTag('cooking').length).toBe(1);
  });

  it('clears all items and indices', () => {
    const store = new ContentStore();
    store.addMany([itemA, itemB]);
    store.clear();

    expect(store.size).toBe(0);
    expect(store.all()).toEqual([]);
    expect(store.findByTag('ai')).toEqual([]);
  });
});

describe('FeedService', () => {
  it('ranks stored content according to reader intent and signals', () => {
    const service = new FeedService();
    service.addContents([itemA, itemB, itemC]);

    const intent: Intent = {
      id: 'reader-1',
      topics: ['ai', 'agents'],
    };

    const feed = service.rank(intent, { now: 1_000_000 });
    expect(feed.length).toBe(3);
    expect(feed[0].item.id).toBe('a'); // Item A matches 2/2 topics
    expect(feed[1].item.id).toBe('c'); // Item C matches 1/2 topics
    expect(feed[2].item.id).toBe('b'); // Item B matches 0 topics

    // Boost item C with signals
    service.recordSignal({
      contentId: 'c',
      kind: 'like',
      at: 1_000_000,
    });
    service.recordSignal({
      contentId: 'c',
      kind: 'save',
      at: 1_000_000,
    });

    const boostedFeed = service.rank(intent, { now: 1_000_000 });
    expect(boostedFeed.some((f) => f.item.id === 'c' && f.reasons.includes('engagement'))).toBe(true);
  });
});

