function normalizeId(value) {
  if (!value) return "";
  return String(value?._id || value);
}

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

function toBoolean(value) {
  return value === true;
}

function resolveBoolean(serie, entry, field) {
  if (entry && entry[field] !== undefined && entry[field] !== null) {
    return entry[field] === true;
  }

  return serie?.[field] === true;
}

export function sanitizeSerieSportEntries(entries) {
  if (!Array.isArray(entries)) return [];

  const bySport = new Map();

  for (const entry of entries) {
    const sport = entry?.sport?._id || entry?.sport;
    const sportKey = normalizeId(sport);
    if (!sportKey) continue;

    bySport.set(sportKey, {
      sport: sportKey,
      image: clean(entry.image),
      headImage: clean(entry.headImage),
      description: clean(entry.description),
      shortDescription: clean(entry.shortDescription),
      isLimitedEdition: toBoolean(entry.isLimitedEdition),
      isNewSerie: toBoolean(entry.isNewSerie),
    });
  }

  return Array.from(bySport.values());
}

export function getSerieSportEntry(serie, sportId) {
  const sportKey = normalizeId(sportId);
  if (!sportKey) return null;

  return (
    (serie?.sportImages || []).find(
      (entry) => normalizeId(entry?.sport) === sportKey
    ) || null
  );
}

export function resolveSerieSportContent(serie, sportId) {
  const entry = getSerieSportEntry(serie, sportId);
  const resolve = (field) => clean(entry?.[field]) || clean(serie?.[field]);

  return {
    image: resolve("image"),
    headImage: resolve("headImage"),
    description: resolve("description"),
    shortDescription: resolve("shortDescription"),
  };
}

export function resolveSerieSportFlags(serie, sportId) {
  const entry = getSerieSportEntry(serie, sportId);

  return {
    isLimitedEdition: resolveBoolean(serie, entry, "isLimitedEdition"),
    isNewSerie: resolveBoolean(serie, entry, "isNewSerie"),
  };
}

export function withResolvedSerieSportContent(serie, sportId) {
  if (!serie) return serie;

  return {
    ...serie,
    ...resolveSerieSportContent(serie, sportId),
    ...resolveSerieSportFlags(serie, sportId),
  };
}
