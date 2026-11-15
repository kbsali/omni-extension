import type { OmniModule } from '../../core/types';
import Popup from './Popup.svelte';

const cookies: OmniModule = {
  id: 'cookies',
  label: 'Cookies',
  icon: '🍪',
  Popup,
  shortcut: {
    commandName: 'open-cookies',
    description: 'Open cookies editor',
    suggestedKey: 'Ctrl+Shift+Comma',
    onInvoke: (ctx) => ctx.openPopupFocusedOn('cookies'),
  },
};

export default cookies;
