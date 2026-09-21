function clean(value) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

export function taxonomyEnglishName(entity) {
  // Preserve model names/acronyms (RF, VCORE, TF-X1) and existing casing.
  return clean(entity?.name).replace(/^[a-z]/, (letter) => letter.toUpperCase());
}

export function taxonomyLabel(entity) {
  return clean(entity?.title) || taxonomyEnglishName(entity);
}

function joinBrand(brand, name) {
  if (!brand) return name;
  if (!name) return brand;
  const lowerName = name.toLowerCase();
  const lowerBrand = brand.toLowerCase();
  return lowerName === lowerBrand || lowerName.startsWith(`${lowerBrand} `)
    ? name
    : `${brand} ${name}`;
}

export function buildSerieNames(brand, serie) {
  const localized = joinBrand(taxonomyLabel(brand), taxonomyLabel(serie));
  const englishSerie = taxonomyEnglishName(serie);
  const english = joinBrand(taxonomyEnglishName(brand), englishSerie);
  // Do not repeat an English-only fallback in parentheses.
  const heading = englishSerie && !localized.toLowerCase().includes(englishSerie.toLowerCase())
    ? `${localized} (${englishSerie})`
    : localized;
  return { localized, english, heading };
}
