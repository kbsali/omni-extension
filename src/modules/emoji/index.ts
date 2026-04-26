import type { OmniModule } from '../../core/types';
import Popup from './Popup.svelte';
import { EMOJI_DEFAULTS } from './storage';

const emoji: OmniModule = {
  id: 'emoji',
  label: 'Emoji',
  icon: '😀',
  Popup,
  storageDefaults: { ...EMOJI_DEFAULTS },
  shortcut: {
    commandName: 'open-emoji',
    description: 'Open emoji picker',
    suggestedKey: 'Ctrl+Shift+L',
    onInvoke: (ctx) => ctx.openPopupFocusedOn('emoji'),
  },
};

export default emoji;
