// Types for the travel-assistant flight-search module. Kept deliberately
// separate from src/modules/airline-connectors/ (the wallet-balance-sync
// framework) — different purpose (no login, will be called from an MCP
// tool later), different lifecycle, no reason to couple them.

export interface FlightSearchQuery {
  origin: string; // IATA code, e.g. "ABV"
  destination: string; // IATA code, e.g. "LOS"
  date: string; // "YYYY-MM-DD"
}

export interface FlightOption {
  airline: string;
  departureTime: string; // "HH:MM", as shown on the results page
  date: string; // "YYYY-MM-DD" — the actual flown date
  durationMinutes: number | null;
  fare: number | null; // cheapest available fare found for this flight
  currency: string;
  seatStatus: string | null; // e.g. "Only 2 seats left", "Sold out" — whatever the cheapest class showed
  raw: string; // the original result row text, kept for debugging/verification
}

export interface FlightSearchResult {
  query: FlightSearchQuery;
  options: FlightOption[];
  searchedAt: string;
}
