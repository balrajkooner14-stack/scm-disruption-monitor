// Maps a supplier's free-text country (as entered in the profile form) to
// the currency code fetched by /api/market-data. Only covers the countries
// whose currencies are actually fetched server-side (see CURRENCIES in
// app/api/market-data/route.ts) — a supplier country outside this list
// simply won't have a currency card shown, rather than erroring.
export const COUNTRY_TO_CURRENCY: Record<string, string> = {
  China: "CNY",
  Vietnam: "VND",
  "South Korea": "KRW",
  Taiwan: "TWD",
  India: "INR",
  Mexico: "MXN",
  Germany: "EUR",
  France: "EUR",
  Italy: "EUR",
  Spain: "EUR",
  Netherlands: "EUR",
  Belgium: "EUR",
  UK: "GBP",
  "United Kingdom": "GBP",
}

export function currencyCodesForCountries(countries: string[]): Set<string> {
  const codes = new Set<string>()
  for (const country of countries) {
    const code = COUNTRY_TO_CURRENCY[country]
    if (code) codes.add(code)
  }
  return codes
}
