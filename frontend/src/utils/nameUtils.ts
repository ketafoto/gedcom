import type { IndividualName } from '../types/models';

const NAME_TYPE_RANK: Record<string, number> = {
  birth: 0,
  aka: 1,
  married: 2,
  maiden: 3,
};

const normalizeNameType = (nameType?: string): string =>
  (nameType ?? '').trim().toLowerCase();

const resolveNameTypeKey = (nameType?: string): string => {
  const normalized = normalizeNameType(nameType);
  if (!normalized) return '';

  if (normalized in NAME_TYPE_RANK) return normalized;

  if (normalized.includes('maiden')) return 'maiden';
  if (normalized.includes('married')) return 'married';
  if (normalized.includes('aka') || normalized.includes('also known')) return 'aka';
  if (normalized.includes('birth')) return 'birth';

  return '';
};

const getNameRank = (name: IndividualName): number => {
  const resolved = resolveNameTypeKey(name.name_type);
  if (resolved && resolved in NAME_TYPE_RANK) {
    return NAME_TYPE_RANK[resolved];
  }
  return -1;
};

export const getLatestName = (names: IndividualName[]): IndividualName | undefined => {
  if (!names || names.length === 0) return undefined;

  let best = names[0];
  let bestRank = getNameRank(best);

  names.forEach((name, index) => {
    const rank = getNameRank(name);
    if (rank > bestRank) {
      best = name;
      bestRank = rank;
      return;
    }
    if (rank === bestRank && bestRank < 0 && index === 0) {
      best = name;
    }
  });

  return best;
};

export const formatIndividualName = (name?: IndividualName, fallback = 'Unnamed'): string => {
  if (!name) return fallback;
  const display = `${name.given_name || ''} ${name.family_name || ''}`.trim();
  return display || fallback;
};
