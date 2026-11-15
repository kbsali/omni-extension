import { defineManifest } from '@crxjs/vite-plugin';

import pkg from './package.json' with { type: 'json' };

export default defineManifest({
  manifest_version: 3,
  name: 'Omni Extension',
  version: pkg.version,
  description: 'Dark mode, cookie editor and emoji picker',
  // The <all_urls> host permission already exposes tab.url: no 'tabs' or 'activeTab'.
  permissions: ['storage', 'cookies'],
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
      suggested_key: { default: 'Ctrl+Shift+L' },
      description: 'Open emoji picker',
    },
    'open-cookies': {
      suggested_key: { default: 'Ctrl+Shift+Comma' },
      description: 'Open cookies editor',
    },
    'toggle-dark': {
      suggested_key: { default: 'Ctrl+Shift+Period' },
      description: 'Toggle dark mode for current site',
    },
  },
});
