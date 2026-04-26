import type { OmniModule } from '../../core/types';
import Popup from './Popup.svelte';
import { COOKIES_DEFAULTS } from './storage';

const cookies: OmniModule = {
  id: 'cookies',
  label: 'Cookies',
  icon: '🍪',
  Popup,
  storageDefaults: { ...COOKIES_DEFAULTS },
  shortcut: {
    commandName: 'open-cookies',
    description: 'Open cookies editor',
    suggestedKey: 'Ctrl+Shift+Comma',
    onInvoke: (ctx) => ctx.openPopupFocusedOn('cookies'),
  },
};

export default cookies;
