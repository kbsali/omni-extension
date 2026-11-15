// Content-script entry, runs on every page at document_start. Side effects
// only: tests cover the helpers in css.ts and service.ts. No console output
// here, it would land in the site's console.
import { extractETLD1 } from '../../core/domain';
import { onStorageChange, readStorage } from '../../core/storage';
import type { OmniStorage } from '../../core/types';
import { applyDarkFilter, removeDarkFilter } from './css';
import { resolveMode } from './service';

function reconcile(storage: OmniStorage): void {
  const domain = extractETLD1(location.href);
  if (!domain) return;
  if (resolveMode(storage, domain) === 'dark') {
    applyDarkFilter(storage.modules.dark.brightness);
  } else {
    removeDarkFilter();
  }
}

void readStorage().then(reconcile);
onStorageChange(reconcile);
