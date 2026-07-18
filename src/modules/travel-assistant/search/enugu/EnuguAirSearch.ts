import { chromium, type Page, type FrameLocator } from "playwright";
import type { FlightOption, FlightSearchQuery, FlightSearchResult } from "../../core/types";

/**
 * Guest flight search for Enugu Air — no login required. Built from a real
 * Playwright codegen recording against https://enuguairlines.com/, not
 * guessed selectors. Key structural facts confirmed by that recording:
 *
 * - The whole booking widget lives inside an <iframe> on the homepage.
 * - Search form: #Origin / #Destination <select> elements (IATA codes),
 *   a "One Way" / "Return" text toggle, and a date picker that needs
 *   [Next] month-navigation clicks before picking a day-of-month link.
 * - Results are <a> links whose accessible name is a single string like
 *   "16:25 19 Jul Abuja 1h 15m" (time, day, month, destination city,
 *   duration) — matched here by pattern, not exact text, since the real
 *   values differ every search.
 * - Clicking a result row expands fare-class options (Economy Promo,
 *   Economy Standard, Premium Economy, Business, etc.) into a container
 *   with id #cls_row_{index}_0 (index = 0 for the first/outbound flight
 *   clicked, 1 for a second leg, etc.) — each class shows a price like
 *   "150,001 NGN" and a seat-status string ("Only 2 seats left",
 *   "Sold out", "No seats", "Available").
 *
 * This only implements ONE WAY search for a SPECIFIC date, matching the
 * stated Phase 1 scope. Round-trip and "no date given" search are not
 * implemented yet (see travel-assistant module README/TODO).
 */

const SEARCH_URL = "https://enuguairlines.com/";

// TODO: verify — the exact element clicked to OPEN the date picker was
// recorded as `locator('span').nth(3)`, a fragile, layout-dependent
// selector (not something codegen usually produces for a deliberately
// named element). This is the single riskiest selector in this file; if
// date selection breaks first, start here.
const OPEN_DATE_PICKER_SELECTOR = "span >> nth=3";

export async function searchEnuguAirFlights(query: FlightSearchQuery): Promise<FlightSearchResult> {
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const context = await browser.newContext({ viewport: { width: 1600, height: 900 } });
    context.on("dialog", (dialog) => dialog.dismiss().catch(() => {}));
    const page = await context.newPage();

    await page.goto(SEARCH_URL, { waitUntil: "domcontentloaded" });
    const frame = page.frameLocator("iframe").first();

    await frame.locator("#Origin").selectOption(query.origin);
    await frame.locator("#Destination").selectOption(query.destination);

    // Make sure "One Way" is the active trip type (this widget defaults
    // to one of the two — clicking is safe/idempotent either way).
    await frame.getByText("One Way", { exact: true }).click();

    await selectDate(frame, query.date);

    await frame.getByRole("button", { name: "Continue" }).click();

    const options = await extractFlightOptions(page, frame, query.date);

    await browser.close();

    return { query, options, searchedAt: new Date().toISOString() };
  } catch (err) {
    await browser.close().catch(() => {});
    throw err;
  }
}

async function selectDate(frame: FrameLocator, targetDateISO: string) {
  const target = new Date(targetDateISO + "T00:00:00");
  const now = new Date();
  const monthsAhead =
    (target.getFullYear() - now.getFullYear()) * 12 + (target.getMonth() - now.getMonth());

  await frame.locator(OPEN_DATE_PICKER_SELECTOR).click();

  for (let i = 0; i < Math.max(0, monthsAhead); i++) {
    await frame.getByTitle("Next").click();
  }

  const day = String(target.getDate());
  await frame.getByRole("link", { name: day, exact: true }).click();
}

async function extractFlightOptions(page: Page, frame: FrameLocator, requestedDate: string): Promise<FlightOption[]> {
  // Matches result rows like "16:25 19 Jul Abuja 1h 15m" — time, day,
  // month abbreviation, city name, duration. Pattern-based rather than
  // exact text since the real values are different on every search.
  const resultPattern = /\d{1,2}:\d{2}\s+\d{1,2}\s+[A-Za-z]{3}\s+.+\d+h\s*\d+m/;
  const resultLinks = frame.getByRole("link", { name: resultPattern });
  const count = await resultLinks.count().catch(() => 0);

  const options: FlightOption[] = [];

  for (let i = 0; i < count; i++) {
    const link = resultLinks.nth(i);
    const raw = (await link.textContent().catch(() => "")) ?? "";
    const parsed = parseResultRow(raw, requestedDate);

    await link.click().catch(() => {});

    // Fare classes for the row just clicked land in #cls_row_{i}_0 —
    // confirmed by the recording's own usage pattern.
    const rowContainer = page.locator(`#cls_row_${i}_0`);
    const fareInfo = await rowContainer
      .innerText({ timeout: 10_000 })
      .then(extractCheapestFare)
      .catch(() => ({ fare: null, status: null }));

    options.push({
      airline: "Enugu Air",
      departureTime: parsed.time,
      date: parsed.date ?? requestedDate,
      durationMinutes: parsed.durationMinutes,
      fare: fareInfo.fare,
      currency: "NGN",
      seatStatus: fareInfo.status,
      raw: raw.trim(),
    });
  }

  return options;
}

function parseResultRow(raw: string, requestedDate: string): { time: string; date: string | null; durationMinutes: number | null } {
  const timeMatch = raw.match(/(\d{1,2}:\d{2})/);
  const durationMatch = raw.match(/(\d+)h\s*(\d+)m/);
  const dateMatch = raw.match(/\d{1,2}\s+([A-Za-z]{3})/);

  return {
    time: timeMatch?.[1] ?? "",
    date: dateMatch ? requestedDate : null, // month/day shown; year assumed from the requested date
    durationMinutes: durationMatch ? parseInt(durationMatch[1], 10) * 60 + parseInt(durationMatch[2], 10) : null,
  };
}

/**
 * Text-scans an expanded fare-class container for every "X,XXX NGN" price
 * alongside nearby seat-status text, returning the cheapest one that isn't
 * marked sold out / unavailable. Deliberately text-based rather than
 * relying on precise CSS class names for each fare tier — more resilient
 * to minor markup changes, matching the approach that ended up working
 * well for the balance-sync connectors.
 */
function extractCheapestFare(containerText: string): { fare: number | null; status: string | null } {
  const lines = containerText.split("\n").map((l) => l.trim()).filter(Boolean);
  let cheapest: { fare: number; status: string | null } | null = null;

  for (let i = 0; i < lines.length; i++) {
    const priceMatch = lines[i].match(/^([\d,]+)\s*NGN/);
    if (!priceMatch) continue;

    const nearby = lines.slice(Math.max(0, i - 2), i + 1).join(" ").toLowerCase();
    if (nearby.includes("sold out") || nearby.includes("no seats")) continue;

    const price = parseFloat(priceMatch[1].replace(/,/g, ""));
    if (!Number.isFinite(price)) continue;

    const statusLine = lines
      .slice(Math.max(0, i - 2), i + 1)
      .find((l) => /seats? left|available/i.test(l));

    if (!cheapest || price < cheapest.fare) {
      cheapest = { fare: price, status: statusLine ?? null };
    }
  }

  return cheapest ?? { fare: null, status: null };
}
