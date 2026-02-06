import type { IndividualName } from '../types/models';

const NAME_TYPE_RANK: Record<string, number> = {
  birth: 0,
  aka: 1,
  married: 2,
  maiden: 3,
};

const normalizeNameType = (nameType?: string): string =>
  (nameType ?? '').trim().toLowerCase();

const getNameRank = (name: IndividualName): number => {
  const normalized = normalizeNameType(name.name_type);
  if (normalized in NAME_TYPE_RANK) {
    return NAME_TYPE_RANK[normalized];
  }
  return -1;
};

export const getLatestName = (names: IndividualName[]): IndividualName | undefined => {
  if (!names || names.length === 0) return undefined;

  let best = names[0];
  let bestRank = getNameRank(best);
  let bestOrder = best.name_order ?? 0;

  names.forEach((name, index) => {
    const rank = getNameRank(name);
    if (rank > bestRank) {
      best = name;
      bestRank = rank;
      bestOrder = name.name_order ?? index;
      return;
    }
    if (rank === bestRank) {
      const order = name.name_order ?? index;
      if (order > bestOrder) {
        best = name;
        bestOrder = order;
      }
    }
  });

  return best;
};

export const formatIndividualName = (name?: IndividualName, fallback = 'Unnamed'): string => {
  if (!name) return fallback;
  const display = `${name.given_name || ''} ${name.family_name || ''}`.trim();
  return display || fallback;
};
