export interface HierarchyNode<T> {
  staff: T;
  children: HierarchyNode<T>[];
}

/**
 * Builds a forest from a flat list using reportsToCode -> staffId edges.
 * If rootIds is omitted, roots are members whose reportsToCode is missing
 * or doesn't resolve to another member in the same list (rather than being
 * silently dropped).
 */
export function buildHierarchyForest<T extends { staffId: string; reportsToCode?: string }>(
  members: T[],
  rootIds?: Set<string>
): HierarchyNode<T>[] {
  const byStaffId = new Map<string, T>();
  for (const m of members) byStaffId.set(m.staffId, m);

  const childrenByParent = new Map<string, T[]>();
  const roots: T[] = [];

  for (const m of members) {
    if (rootIds) {
      if (rootIds.has(m.staffId)) {
        roots.push(m);
        continue;
      }
      if (m.reportsToCode) {
        const list = childrenByParent.get(m.reportsToCode) ?? [];
        list.push(m);
        childrenByParent.set(m.reportsToCode, list);
      }
      continue;
    }

    const resolvedParent = m.reportsToCode && byStaffId.has(m.reportsToCode) ? m.reportsToCode : undefined;
    if (!resolvedParent) {
      roots.push(m);
    } else {
      const list = childrenByParent.get(resolvedParent) ?? [];
      list.push(m);
      childrenByParent.set(resolvedParent, list);
    }
  }

  function buildNode(staff: T): HierarchyNode<T> {
    const children = (childrenByParent.get(staff.staffId) ?? []).map(buildNode);
    return { staff, children };
  }

  return roots.map(buildNode);
}

/** Recursively counts descendants (not including the node itself) matching a predicate. */
export function countDescendants<T>(node: HierarchyNode<T>, predicate: (staff: T) => boolean): number {
  let count = 0;
  for (const child of node.children) {
    if (predicate(child.staff)) count++;
    count += countDescendants(child, predicate);
  }
  return count;
}

/** Recursively sums a numeric field across a node and all its descendants. */
export function sumSubtree<T>(node: HierarchyNode<T>, pick: (staff: T) => number): number {
  let total = pick(node.staff);
  for (const child of node.children) total += sumSubtree(child, pick);
  return total;
}

/**
 * In-memory equivalent of src/lib/downline.ts's getDownline() — walks the
 * same reportsToCode edges, breadth-first, but over an already-loaded staff
 * array instead of paginated Supabase queries. Used by admin pages that
 * already have the full staff list loaded (e.g. the staff profile page),
 * so viewing someone's downline doesn't require a second round-trip. Must
 * stay logically equivalent to getDownline — same edges, same order.
 */
export function getDownlineFromList<T extends { staffId: string; reportsToCode?: string }>(
  staffId: string,
  allStaff: T[],
  maxDepth = 4
): T[] {
  const byReportsTo = new Map<string, T[]>();
  for (const s of allStaff) {
    if (!s.reportsToCode) continue;
    const list = byReportsTo.get(s.reportsToCode) ?? [];
    list.push(s);
    byReportsTo.set(s.reportsToCode, list);
  }

  const result: T[] = [];
  const seen = new Set<string>([staffId]);
  let frontier = [staffId];
  let depth = 0;

  while (frontier.length > 0 && depth < maxDepth) {
    const nextFrontier: string[] = [];
    for (const parentId of frontier) {
      for (const child of byReportsTo.get(parentId) ?? []) {
        if (seen.has(child.staffId)) continue;
        seen.add(child.staffId);
        result.push(child);
        nextFrontier.push(child.staffId);
      }
    }
    frontier = nextFrontier;
    depth++;
  }

  return result;
}
