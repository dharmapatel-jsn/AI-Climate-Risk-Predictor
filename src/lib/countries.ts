const regionNames = new Intl.DisplayNames(["en"], { type: "region" });

export function getCountryName(countryCode: string): string {
  const normalizedCode = countryCode.trim().toUpperCase();

  if (!normalizedCode) {
    return "Unknown country";
  }

  return regionNames.of(normalizedCode) ?? normalizedCode;
}