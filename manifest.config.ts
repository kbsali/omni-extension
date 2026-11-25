import { defineManifest } from '@crxjs/vite-plugin';

import pkg from './package.json' with { type: 'json' };

export default defineManifest({
  manifest_version: 3,
  name: 'Omni Extension',
  version: pkg.version,
  description:
    'Dark mode, cookie editor, emoji picker, ntfy messages and article to PDF',
  // The <all_urls> host permission already exposes tab.url: no 'tabs' or 'activeTab'.
  // 'scripting' reads a tab's live DOM for the article export; with <all_urls>
  // already granted it adds no install warning.
  permissions: ['storage', 'cookies', 'scripting'],
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
  // Drawn by hand in public/icons/icon.svg; the PNGs are rendered from it
  // with rsvg-convert.
  icons: {
    16: 'icons/icon-16.png',
    32: 'icons/icon-32.png',
    48: 'icons/icon-48.png',
    128: 'icons/icon-128.png',
  },
  action: {
    default_popup: 'src/popup/index.html',
    default_icon: {
      16: 'icons/icon-16.png',
      32: 'icons/icon-32.png',
      48: 'icons/icon-48.png',
      128: 'icons/icon-128.png',
    },
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
