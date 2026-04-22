import type { OmniModule } from '../../core/types';
import Popup from './Popup.svelte';
import { DARK_DEFAULTS } from './storage';

const dark: OmniModule = {
  id: 'dark',
  label: 'Dark',
  icon: '🌙',
  Popup,
  storageDefaults: { ...DARK_DEFAULTS },
  onBackground() {
    console.log('[omni/dark] background hook installed (no-op — content script self-manages)');
  },
};

export default dark;
