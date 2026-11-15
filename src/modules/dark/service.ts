import type { Mode, OmniStorage } from '../../core/types';

export function resolveMode(
  storage: OmniStorage,
  domain: string
): 'dark' | 'light' {
  const site = storage.modules.dark.sites[domain];
  if (site === 'dark' || site === 'light') return site;
  return storage.modules.dark.defaultMode;
}

export function nextSiteValueOnToggle(
  current: Mode,
  defaultMode: 'dark' | 'light'
): Mode {
  const effective =
    current === 'dark' || current === 'light' ? current : defaultMode;
  const nextEffective = effective === 'dark' ? 'light' : 'dark';
  return nextEffective === defaultMode ? 'default' : nextEffective;
}
