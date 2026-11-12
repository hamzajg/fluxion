import type { ContentItem, Intent, RankedItem, RankOptions, Signal } from '../domain/types.js';
import { ContentStore } from './contentStore.js';
import { rankFeed } from './feedEngine.js';
import { SignalStore } from './signalStore.js';

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
}

