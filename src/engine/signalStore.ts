import type { ContentId, Signal, SignalKind } from '../domain/types.js';

export const DEFAULT_WEIGHTS: Record<SignalKind, number> = {
  view: 1,
  like: 3,
  save: 5,
  share: 4,
  skip: -4,
};

/**
 * In-memory signal store.
 *
 * Keeps interactions in insertion order. A real deployment would back this
 * with a database, but the ranking core only needs `all()` and `forContent()`.
 */
export class SignalStore {
  private signals: Signal[] = [];

  record(signal: Signal): void {
    this.signals.push(signal);
  }

  forContent(contentId: ContentId): Signal[] {
    return this.signals.filter((s) => s.contentId === contentId);
  }

  all(): Signal[] {
    return [...this.signals];
  }

  clear(): void {
    this.signals = [];
  }

  get size(): number {
    return this.signals.length;
  }

  /**
   * The signal log as a plain JSON-safe array, in insertion order — what a
   * caller persists. Order matters: `all()` feeds the ranking core.
   */
  serialize(): Signal[] {
    return this.all();
  }

  /**
   * Replace the log from serialized data. Existing signals are dropped:
   * the snapshot is the truth.
   */
  restore(signals: Signal[]): void {
    this.signals = [...signals];
  }
}
