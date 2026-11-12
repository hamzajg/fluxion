import type { ContentId, ContentItem } from '../domain/types.js';

/**
 * In-memory content store with indexed lookups by tag.
 */
export class ContentStore {
  private items = new Map<ContentId, ContentItem>();
  private tagIndex = new Map<string, Set<ContentId>>();

  add(item: ContentItem): void {
    if (this.items.has(item.id)) {
      this.delete(item.id);
    }
    this.items.set(item.id, item);
    for (const tag of item.tags) {
      const normalized = tag.toLowerCase();
      let ids = this.tagIndex.get(normalized);
      if (!ids) {
        ids = new Set();
        this.tagIndex.set(normalized, ids);
      }
      ids.add(item.id);
    }
  }

  addMany(items: ContentItem[]): void {
    for (const item of items) {
      this.add(item);
    }
  }

  get(id: ContentId): ContentItem | undefined {
    return this.items.get(id);
  }

  has(id: ContentId): boolean {
    return this.items.has(id);
  }

  delete(id: ContentId): boolean {
    const item = this.items.get(id);
    if (!item) return false;

    this.items.delete(id);
    for (const tag of item.tags) {
      const normalized = tag.toLowerCase();
      const ids = this.tagIndex.get(normalized);
      if (ids) {
        ids.delete(id);
        if (ids.size === 0) {
          this.tagIndex.delete(normalized);
        }
      }
    }
    return true;
  }

  findByTag(tag: string): ContentItem[] {
    const ids = this.tagIndex.get(tag.toLowerCase());
    if (!ids) return [];
    return Array.from(ids)
      .map((id) => this.items.get(id)!)
      .filter(Boolean);
  }

  all(): ContentItem[] {
    return Array.from(this.items.values());
  }

  clear(): void {
    this.items.clear();
    this.tagIndex.clear();
  }

  get size(): number {
    return this.items.size;
  }

  /**
   * The catalogue as a plain JSON-safe array — what a caller persists.
   */
  serialize(): ContentItem[] {
    return this.all();
  }

  /**
   * Rebuild the store (items *and* the tag index) from serialized data.
   * Existing content is replaced wholesale: the snapshot is the truth.
   */
  restore(items: ContentItem[]): void {
    this.clear();
    this.addMany(items);
  }
}

