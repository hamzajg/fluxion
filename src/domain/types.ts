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
  /** Topics the reader cares about; matched against item tags. */
  topics: string[];
  /** Tags to exclude entirely. */
  excludeTags?: string[];
  /** 0..1 — how much freshness matters. */
  freshness?: number;
  /** 0..1 — how much novelty (avoiding repeats) matters. */
  novelty?: number;
}

export interface RankedItem {
  item: ContentItem;
  score: number;
  reasons: string[];
}

export interface RankOptions {
  /** Maximum number of items to return. Defaults to all. */
  limit?: number;
  /** Reference time for decay calculations. Defaults to Date.now(). */
  now?: number;
}
