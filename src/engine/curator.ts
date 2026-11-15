import type {
  ContentId,
  CurationDirective,
  Intent,
  RankedItem,
  RankOptions,
  Signal,
  SignalKind,
} from '../domain/types.js';
import { FeedService } from './feedService.js';

/**
 * Apply a curation directive to an intent, returning a new intent.
 * Pure: the input intent is never mutated.
 */
export function applyDirective(intent: Intent, directive?: CurationDirective): Intent {
  if (!directive) return intent;

  const remove = new Set((directive.removeTopics ?? []).map((t) => t.toLowerCase()));
  const topics = [...intent.topics];
  for (const t of directive.addTopics ?? []) {
    if (!topics.some((existing) => existing.toLowerCase() === t.toLowerCase())) {
      topics.push(t);
    }
  }
  const filtered = topics.filter((t) => !remove.has(t.toLowerCase()));

  const exclude = new Set((intent.excludeTags ?? []).map((t) => t.toLowerCase()));
  for (const t of directive.excludeTags ?? []) exclude.add(t.toLowerCase());

  return {
    ...intent,
    topics: filtered,
    excludeTags: exclude.size > 0 ? [...exclude] : intent.excludeTags,
    freshness: directive.freshness ?? intent.freshness,
    novelty: directive.novelty ?? intent.novelty,
  };
}

/**
 * The agent-facing facade over `FeedService`.
 *
 * A curator is bound to an optional `actorId`: signals it records are
 * attributed to that actor (so per-reader ranking stays correct), and
 * `rank` injects the actor into the intent automatically. An external
 * agent uses a curator to (a) shape intents via `CurationDirective`s and
 * (b) record reactions on a reader's behalf.
 */
export class Curator {
  constructor(
    private readonly service: FeedService = new FeedService(),
    private readonly actorId?: string,
  ) {}

  /** The underlying service — for stores, snapshots, bulk ops. */
  get feed(): FeedService {
    return this.service;
  }

  /**
   * Rank the feed for `intent`, optionally adjusted by a directive.
   * The curator's `actorId` is applied to the intent (unless the caller
   * set one explicitly) so actor-scoped ranking works without ceremony.
   */
  rank(
    intent: Intent,
    directive?: CurationDirective,
    options: RankOptions = {},
  ): RankedItem[] {
    const scoped: Intent = {
      ...applyDirective(intent, directive),
      actorId: intent.actorId ?? this.actorId,
    };
    return this.service.rank(scoped, options);
  }

  /**
   * Record a reaction signal as this curator's actor.
   * `kind` is a normal `SignalKind` — 'skip' suppresses, 'save'/'like'
   * boost, 'view' marks seen.
   */
  react(contentId: ContentId, kind: SignalKind, at: number = Date.now()): void {
    const signal: Signal = {
      contentId,
      kind,
      at,
      ...(this.actorId !== undefined ? { actorId: this.actorId } : {}),
    };
    this.service.recordSignal(signal);
  }
}
