"use client";

import { useState } from "react";

export default function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard API can fail in some contexts (older Safari, insecure origin) — fail silently,
      // the value is still visible on screen for a manual copy.
    }
  }

  return (
    <button type="button" onClick={handleCopy} className="btn-secondary">
      {copied ? "Copied ✓" : label}
    </button>
  );
}
