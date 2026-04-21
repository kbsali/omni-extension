export const MSG_UPDATE_BRIGHTNESS = 'omni-dark/update-brightness' as const;
export const MSG_REMOVE = 'omni-dark/remove' as const;

export type ContentMessage =
  | { type: typeof MSG_UPDATE_BRIGHTNESS; brightness: number }
  | { type: typeof MSG_REMOVE };
