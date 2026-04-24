import type { EmojiEntry } from './service';
import dataRaw from 'emojibase-data/en/data.json';

// Minimal local shape — avoids depending on the `emojibase` types package.
// Field names match emojibase-data v17 (label, tags, order, group).
interface EmojibaseEntry {
  emoji: string;
  label: string;
  tags?: string[];
  order?: number;
  group?: number;
}

// group === 2 is the "Component" group (skin-tone swatches, hair modifiers).
// We drop those since v1 has no skin-tone picker.
const COMPONENT_GROUP = 2;

const raw = dataRaw as unknown as EmojibaseEntry[];

export const EMOJIS: readonly EmojiEntry[] = raw
  .filter((e) => e.group !== undefined && e.group !== COMPONENT_GROUP)
  .slice()
  .toSorted((a, b) => (a.order ?? 0) - (b.order ?? 0))
  .map((e) => ({
    char: e.emoji,
    name: e.label.toLowerCase(),
    keywords: (e.tags ?? []).map((t) => t.toLowerCase()),
  }));
