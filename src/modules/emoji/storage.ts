export interface EmojiStorage {
  recents: string[];
}

export const RECENTS_MAX = 16;

export const EMOJI_DEFAULTS: EmojiStorage = {
  recents: [],
};
