"use client";

import { useState, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import type { HierarchyNode } from "@/lib/staffHierarchy";

interface HierarchyTreeProps<T> {
  nodes: HierarchyNode<T>[];
  renderRow: (node: HierarchyNode<T>, depth: number) => ReactNode;
  getKey: (staff: T) => string;
  depth?: number;
}

export default function HierarchyTree<T>({ nodes, renderRow, getKey, depth = 0 }: HierarchyTreeProps<T>) {
  return (
    <div className="divide-y divide-line">
      {nodes.map((node) => (
        <TreeRow key={getKey(node.staff)} node={node} renderRow={renderRow} getKey={getKey} depth={depth} />
      ))}
    </div>
  );
}

function TreeRow<T>({
  node,
  renderRow,
  getKey,
  depth,
}: {
  node: HierarchyNode<T>;
  renderRow: (node: HierarchyNode<T>, depth: number) => ReactNode;
  getKey: (staff: T) => string;
  depth: number;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0;

  return (
    <div>
      <div className="flex items-start gap-2 px-4 py-3.5" style={{ paddingLeft: `${16 + depth * 24}px` }}>
        {hasChildren ? (
          <button
            onClick={() => setExpanded((v) => !v)}
            aria-label={expanded ? "Collapse" : "Expand"}
            className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded text-slate transition-transform hover:bg-paper"
          >
            <ChevronRight size={14} className={`transition-transform duration-150 ${expanded ? "rotate-90" : ""}`} />
          </button>
        ) : (
          <span className="mt-1 h-5 w-5 shrink-0" />
        )}
        <div className="min-w-0 flex-1">{renderRow(node, depth)}</div>
      </div>
      {hasChildren && expanded && (
        <div className="border-t border-line">
          <HierarchyTree nodes={node.children} renderRow={renderRow} getKey={getKey} depth={depth + 1} />
        </div>
      )}
    </div>
  );
}
