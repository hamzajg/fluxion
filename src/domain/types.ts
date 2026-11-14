export type ContentId = string;

export interface ContentItem {
  id: ContentId;
  title: string;
  body: string;
  tags: string[];
  /** Unix epoch milliseconds. */
  createdAt: number;
}

export type SignalKind = 'view' | 'like' | 'save' | 'share' | 'skip';

export interface Signal {
  contentId: ContentId;
  kind: SignalKind;
  /** Unix epoch milliseconds. */
  at: number;
  /** Optional actor, for per-reader ranking later. */
  actorId?: string;
  /** Overrides the default weight for this kind. */
  weight?: number;
}

export interface Intent {
  id: string;
  /**
   * The reader this ranking is for. When set, signals recorded by other
   * actors are ignored — another reader's views must not mark content as
   * "seen" or boost its engagement for this reader. Signals without an
   * `actorId` are global and always count.
   */
  actorId?: string;
  /** Topics the reader cares about; matched against item tags. */
  topics: string[];
  /** Tags to exclude entirely. */
  excludeTags?: string[];
  /** 0..1 — how much freshness matters. */
  freshness?: number;
  /** 0..1 — how much novelty (avoiding repeats) matters. */
  novelty?: number;
}

/** Weighted contribution of each signal to a `RankedItem.score`. */
export interface ScoreParts {
  topic: number;
  engagement: number;
  freshness: number;
  novelty: number;
}

export interface RankedItem {
  item: ContentItem;
  score: number;
  reasons: string[];
  /** Present when scored by the built-in `scoreItem`; parts sum to `score`. */
  scoreParts?: ScoreParts;
}

/**
 * A scoring function: turn one candidate into a scored, explained item.
 * The default is the built-in weighted scorer; pass your own via
 * `RankOptions.ranker` to plug in a different ranking strategy.
 */
export type Ranker = (
  item: ContentItem,
  intent: Intent,
  signals: Signal[],
  now: number,
) => RankedItem;

export interface RankOptions {
  /** Maximum number of items to return. Defaults to all. */
  limit?: number;
  /** Reference time for decay calculations. Defaults to Date.now(). */
  now?: number;
  /** Custom scorer. Defaults to the built-in weighted scorer (`scoreItem`). */
  ranker?: Ranker;
}
