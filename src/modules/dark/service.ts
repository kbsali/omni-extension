import type { Mode, OmniStorage } from '../../core/types';

export type EnrolledSet =
  | { mode: 'per-site'; domains: string[] }
  | { mode: 'global'; excludeDomains: string[] };

export function resolveMode(storage: OmniStorage, domain: string): 'dark' | 'light' {
  const site = storage.modules.dark.sites[domain];
  if (site === 'dark' || site === 'light') return site;
  return storage.modules.dark.defaultMode;
}

export function computeEnrolledDomains(storage: OmniStorage): EnrolledSet {
  const { defaultMode, sites } = storage.modules.dark;
  if (defaultMode === 'dark') {
    const excludeDomains = Object.entries(sites)
      .filter(([, mode]) => mode === 'light')
      .map(([domain]) => domain)
      .toSorted();
    return { mode: 'global', excludeDomains };
  }
  const domains = Object.entries(sites)
    .filter(([, mode]) => mode === 'dark')
    .map(([domain]) => domain)
    .toSorted();
  return { mode: 'per-site', domains };
}

export interface RegistrationDiff {
  toRegister: EnrolledSet;
  toUnregister: string[];
  fullReregister: boolean;
}

export function diffRegistrations(prev: EnrolledSet, next: EnrolledSet): RegistrationDiff {
  if (prev.mode !== next.mode) {
    return { toRegister: next, toUnregister: allDomainIds(prev), fullReregister: true };
  }

  if (next.mode === 'global') {
    const prevG = prev as Extract<EnrolledSet, { mode: 'global' }>;
    const excludesChanged =
      prevG.excludeDomains.length !== next.excludeDomains.length ||
      prevG.excludeDomains.some((d, i) => d !== next.excludeDomains[i]);
    if (excludesChanged) {
      return { toRegister: next, toUnregister: ['__global__'], fullReregister: true };
    }
    return {
      toRegister: { mode: 'per-site', domains: [] },
      toUnregister: [],
      fullReregister: false,
    };
  }

  const prevS = prev as Extract<EnrolledSet, { mode: 'per-site' }>;
  const prevSet = new Set(prevS.domains);
  const nextSet = new Set(next.domains);
  const added = next.domains.filter((d) => !prevSet.has(d));
  const removed = prevS.domains.filter((d) => !nextSet.has(d));
  return {
    toRegister: { mode: 'per-site', domains: added },
    toUnregister: removed,
    fullReregister: false,
  };
}

function allDomainIds(set: EnrolledSet): string[] {
  if (set.mode === 'global') return ['__global__'];
  return [...set.domains];
}

export function nextSiteValueOnToggle(
  current: Mode,
  defaultMode: 'dark' | 'light',
): Mode {
  const effective = current === 'dark' || current === 'light' ? current : defaultMode;
  const nextEffective = effective === 'dark' ? 'light' : 'dark';
  return nextEffective === defaultMode ? 'default' : nextEffective;
}
