/**
 * PostgREST (Supabase's data API) caps every request at 1,000 rows by
 * default regardless of how many rows actually match — a plain
 * `.select("*")` over a table with more than 1,000 rows silently returns
 * only the first 1,000, with no error. Discovered live: the admin dashboard
 * showed exactly "1,000 link visits tracked" and "1000 responses" on the
 * category breakdowns against a table with 11,214 visits and 3,120
 * applications — both suspiciously round numbers at exactly the cap.
 *
 * This walks a query in 1,000-row pages via `.range()` until a page comes
 * back short, so every full-table read actually returns everything.
 */
export async function selectAllRows<T>(
  buildQuery: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<T[]> {
  const PAGE_SIZE = 1000;
  const all: T[] = [];
  let from = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await buildQuery(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    all.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return all;
}
