import type { ContentItem, Intent, RankedItem, RankOptions, Signal } from '../domain/types.js';
import { ContentStore } from './contentStore.js';
import { rankFeed } from './feedEngine.js';
import { SignalStore } from './signalStore.js';

/** A JSON-safe picture of everything `FeedService` holds. */
export interface FeedSnapshot {
  content: ContentItem[];
  signals: Signal[];
}

/**
 * High-level service combining content storage, signal tracking, and feed ranking.
 */
export class FeedService {
  constructor(
    public readonly content: ContentStore = new ContentStore(),
    public readonly signals: SignalStore = new SignalStore(),
  ) {}

  /**
   * Rank the catalogue for the given intent.
   */
  rank(intent: Intent, options: RankOptions = {}): RankedItem[] {
    return rankFeed(this.content.all(), intent, this.signals.all(), options);
  }

  /**
   * Add one content item to the store.
   */
  addContent(item: ContentItem): void {
    this.content.add(item);
  }

  /**
   * Add multiple content items to the store.
   */
  addContents(items: ContentItem[]): void {
    this.content.addMany(items);
  }

  /**
   * Record a reader interaction signal.
   */
  recordSignal(signal: Signal): void {
    this.signals.record(signal);
  }

  /**
   * Everything the service holds, as plain JSON-safe data — persist it
   * however you like (`JSON.stringify`, a file, a database row) and hand it
   * back to `restore`.
   */
  snapshot(): FeedSnapshot {
    return {
      content: this.content.serialize(),
      signals: this.signals.serialize(),
    };
  }

  /**
   * Rebuild both stores from a `snapshot()`. The snapshot is the truth:
   * anything added since the last snapshot is replaced.
   */
  restore(snapshot: FeedSnapshot): void {
    this.content.restore(snapshot.content);
    this.signals.restore(snapshot.signals);
  }
}

