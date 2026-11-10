import type { ContentItem, Intent, RankedItem, RankOptions, Signal } from '../domain/types.js';
import { DEFAULT_WEIGHTS } from './signalStore.js';

const DAY_MS = 86_400_000;
const HALF_LIFE_DAYS = 7;
const VIEWS_FOR_FULL_PENALTY = 3;

function ageDays(at: number, now: number): number {
  return Math.max(0, (now - at) / DAY_MS);
}

function decay(at: number, now: number): number {
  return Math.exp(-ageDays(at, now) / HALF_LIFE_DAYS);
}

function signalWeight(signal: Signal): number {
  return signal.weight ?? DEFAULT_WEIGHTS[signal.kind];
}

/** Recency-decayed engagement, squashed into (-1, 1). */
function engagementScore(signals: Signal[], now: number): number {
  const raw = signals.reduce((sum, s) => sum + signalWeight(s) * decay(s.at, now), 0);
  return Math.tanh(raw / 10);
}

/** 1 when unseen, approaching 0 as the reader views/skips the item. */
function noveltyScore(signals: Signal[]): number {
  const seen = signals.filter((s) => s.kind === 'view' || s.kind === 'skip').length;
  return 1 / (1 + seen / VIEWS_FOR_FULL_PENALTY);
}

export function scoreItem(
  item: ContentItem,
  intent: Intent,
  signals: Signal[],
  now: number = Date.now(),
): RankedItem {
  const reasons: string[] = [];

  const topics = intent.topics.map((t) => t.toLowerCase());
  const tags = item.tags.map((t) => t.toLowerCase());
  const matches = topics.filter((t) => tags.includes(t)).length;
  const topicScore = topics.length === 0 ? 0 : matches / topics.length;
  if (matches > 0) reasons.push(`topic ${matches}/${topics.length}`);

  const own = signals.filter((s) => s.contentId === item.id);

  const engagement = engagementScore(own, now);
  if (engagement > 0.01) reasons.push('engagement');
  else if (engagement < -0.01) reasons.push('negative engagement');

  const fresh = decay(item.createdAt, now);
  if (fresh > 0.5) reasons.push('fresh');

  const novelty = noveltyScore(own);
  if (novelty < 0.5) reasons.push('seen before');

  const freshnessWeight = intent.freshness ?? 0.5;
  const noveltyWeight = intent.novelty ?? 0.5;

  const score =
    3 * topicScore +
    2 * engagement +
    1.5 * fresh * freshnessWeight +
    1 * novelty * noveltyWeight;

  return { item, score, reasons };
}

/**
 * Rank `items` for `intent`, excluding tags in `intent.excludeTags`.
 * Deterministic for a fixed `options.now`.
 */
export function rankFeed(
  items: ContentItem[],
  intent: Intent,
  signals: Signal[],
  options: RankOptions = {},
): RankedItem[] {
  const now = options.now ?? Date.now();
  const excluded = new Set((intent.excludeTags ?? []).map((t) => t.toLowerCase()));

  const ranked = items
    .filter((item) => !item.tags.some((tag) => excluded.has(tag.toLowerCase())))
    .map((item) => scoreItem(item, intent, signals, now))
    .sort((a, b) => b.score - a.score);

  if (options.limit === undefined) return ranked;
  return ranked.slice(0, Math.max(0, options.limit));
}
