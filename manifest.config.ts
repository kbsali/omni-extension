import { defineManifest } from '@crxjs/vite-plugin';
import pkg from './package.json' with { type: 'json' };

export default defineManifest({
  manifest_version: 3,
  name: 'Omni Extension',
  version: pkg.version,
  description: 'Multi-tool browser extension (Dark Mode + future modules)',
  permissions: ['storage', 'scripting', 'activeTab', 'tabs', 'cookies'],
  host_permissions: ['<all_urls>'],
  content_scripts: [
    {
      matches: ['<all_urls>'],
      js: ['src/modules/dark/content.ts'],
      run_at: 'document_start',
      all_frames: false,
    },
  ],
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module',
  },
  action: {
    default_popup: 'src/popup/index.html',
  },
  commands: {
    'open-emoji': {
      suggested_key: { default: 'Alt+Shift+E', mac: 'Alt+Shift+E' },
      description: 'Open emoji picker',
    },
    'open-cookies': {
      suggested_key: { default: 'Alt+Shift+K', mac: 'Alt+Shift+K' },
      description: 'Open cookies editor',
    },
    'toggle-dark': {
      suggested_key: { default: 'Alt+Shift+D', mac: 'Alt+Shift+D' },
      description: 'Toggle dark mode for current site',
    },
  },
});
