"use client";

import { Fragment, useEffect, useMemo, useState, type CSSProperties } from "react";
import { Phone, ChevronDown, ChevronUp } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase-client";
import { getTableCached, invalidateTableCache } from "@/lib/supabaseCache";
import { rowToApplicationRecord, rowToOutreachRecord, outreachPatchToRow } from "@/lib/supabaseMappers";
import CrmGate from "@/components/CrmGate";
import CrmShell from "@/components/CrmShell";
import Skeleton from "@/components/Skeleton";
import { applicationStatusLabel } from "@/lib/phase2Status";
import type { ApplicationRecord, OutreachRecord, OutreachStatus, Reachability } from "@/lib/types";

const STATUS_FILTERS: { id: string; label: string }[] = [
  { id: "all", label: "All statuses" },
  { id: "phase1_submitted", label: "Phase 1 submitted" },
  { id: "phase2_email_sent", label: "Phase 2 email sent" },
  { id: "phase2_marked_complete", label: "Phase 2 complete" },
];

function defaultOutreach(applicationId: string): OutreachRecord {
  return {
    applicationId,
    outreachStatus: "not_called",
    callCount: 0,
    updatedAt: "",
  };
}

export default function CrmPage() {
  return (
    <CrmGate>
      <CrmShell>
        <CrmBoard />
      </CrmShell>
    </CrmGate>
  );
}

function CrmBoard() {
  const [apps, setApps] = useState<ApplicationRecord[] | null>(null);
  const [outreachByAppId, setOutreachByAppId] = useState<Map<string, OutreachRecord>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);

  async function load() {
    try {
      const [appsData, outreachData] = await Promise.all([
        getTableCached("applications", rowToApplicationRecord),
        getTableCached("applicant_outreach", rowToOutreachRecord),
      ]);
      setApps(appsData);
      const map = new Map<string, OutreachRecord>();
      for (const o of outreachData) map.set(o.applicationId, o);
      setOutreachByAppId(map);
    } catch (err) {
      setError("Couldn't load CRM data. Please try refreshing.");
      console.error("Failed to load CRM data:", err);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    if (!apps) return [];
    const q = search.trim().toLowerCase();
    return apps.filter((a) => {
      if (statusFilter !== "all" && a.status !== statusFilter) return false;
      if (!q) return true;
      return (
        a.applicantName?.toLowerCase().includes(q) ||
        a.phone?.toLowerCase().includes(q) ||
        a.email?.toLowerCase().includes(q) ||
        a.businessName?.toLowerCase().includes(q)
      );
    });
  }, [apps, search, statusFilter]);

  async function saveOutreach(applicationId: string, patch: Partial<Omit<OutreachRecord, "applicationId">>) {
    setSavingId(applicationId);
    try {
      const supabase = getSupabaseClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const now = new Date().toISOString();
      const merged: Partial<Omit<OutreachRecord, "applicationId">> = {
        ...patch,
        updatedAt: now,
        ...(user?.id ? { updatedBy: user.id } : {}),
      };
      const { error: upsertErr } = await supabase
        .from("applicant_outreach")
        .upsert(outreachPatchToRow(applicationId, merged));
      if (upsertErr) throw new Error(upsertErr.message);

      setOutreachByAppId((prev) => {
        const next = new Map(prev);
        const current = next.get(applicationId) ?? defaultOutreach(applicationId);
        next.set(applicationId, { ...current, ...merged });
        return next;
      });
      invalidateTableCache("applicant_outreach");
    } catch (err) {
      console.error("Failed to save outreach:", err);
      setError("Couldn't save that change. Please try again.");
    } finally {
      setSavingId(null);
    }
  }

  function toggleOutreachStatus(applicationId: string, current: OutreachStatus) {
    const next: OutreachStatus = current === "called" ? "not_called" : "called";
    const patch: Partial<Omit<OutreachRecord, "applicationId">> = { outreachStatus: next };
    if (next === "called") {
      const existing = outreachByAppId.get(applicationId) ?? defaultOutreach(applicationId);
      patch.callCount = existing.callCount + 1;
      patch.lastContactedAt = new Date().toISOString();
    }
    saveOutreach(applicationId, patch);
  }

  function setReachability(applicationId: string, value: Reachability) {
    saveOutreach(applicationId, { reachability: value });
  }

  function logCall(applicationId: string) {
    const existing = outreachByAppId.get(applicationId) ?? defaultOutreach(applicationId);
    saveOutreach(applicationId, {
      callCount: existing.callCount + 1,
      lastContactedAt: new Date().toISOString(),
      outreachStatus: "called",
    });
  }

  function openNotes(applicationId: string) {
    const existing = outreachByAppId.get(applicationId);
    setNoteDraft(existing?.notes ?? "");
    setExpandedId(expandedId === applicationId ? null : applicationId);
  }

  function saveNotes(applicationId: string) {
    saveOutreach(applicationId, { notes: noteDraft });
    setExpandedId(null);
  }

  return (
    <div>
      <header className="mb-6">
        <p className="font-mono text-xs uppercase tracking-widest text-gold">Follow-up</p>
        <h1 className="mt-1 font-display text-2xl font-semibold text-ink">CRM</h1>
        <p className="mt-1 text-sm text-slate">
          Track outreach on grant applicants — who's been called, whether they're reachable, and what's next.
        </p>
      </header>

      {error && (
        <p role="alert" className="mb-4 rounded-md bg-bad/10 px-3 py-2 text-sm text-bad">
          {error}
        </p>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          className="input max-w-xs"
          placeholder="Search name, phone, email, business…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="input max-w-xs" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          {STATUS_FILTERS.map((f) => (
            <option key={f.id} value={f.id}>
              {f.label}
            </option>
          ))}
        </select>
        {apps && <span className="text-xs text-slate">{filtered.length} of {apps.length}</span>}
      </div>

      <div className="overflow-hidden rounded-card border border-line bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-paper text-xs uppercase tracking-wide text-slate">
              <tr>
                <th className="px-4 py-3">Applicant</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Outreach</th>
                <th className="px-4 py-3">Reachability</th>
                <th className="px-4 py-3">Calls</th>
                <th className="px-4 py-3">Last contact</th>
                <th className="px-4 py-3">Notes</th>
              </tr>
            </thead>
            <tbody>
              {!apps && !error && (
                <>
                  {Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i} className="border-t border-line">
                      {Array.from({ length: 8 }).map((_, j) => (
                        <td key={j} className="px-4 py-3.5">
                          <Skeleton className="h-3.5 w-full max-w-[110px]" />
                        </td>
                      ))}
                    </tr>
                  ))}
                </>
              )}
              {apps && filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate">
                    {apps.length === 0 ? "No applications yet." : `No applicants match your search.`}
                  </td>
                </tr>
              )}
              {filtered.map((a, i) => {
                const outreach = outreachByAppId.get(a.applicationId) ?? defaultOutreach(a.applicationId);
                const isExpanded = expandedId === a.applicationId;
                const isSaving = savingId === a.applicationId;
                return (
                  <Fragment key={a.applicationId}>
                    <tr
                      className="row-rise border-t border-line transition-colors duration-150 hover:bg-paper"
                      style={{ "--delay": `${Math.min(i, 14) * 30}ms` } as CSSProperties}
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-ink">{a.applicantName || "—"}</p>
                        <p className="text-xs text-slate">{a.businessName || "—"}</p>
                      </td>
                      <td className="px-4 py-3">
                        {a.phone ? (
                          <a href={`tel:${a.phone}`} className="inline-flex items-center gap-1 font-mono text-xs text-brand hover:underline">
                            <Phone size={12} strokeWidth={2} />
                            {a.phone}
                          </a>
                        ) : (
                          <span className="text-slate">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                            a.status === "phase2_marked_complete" ? "bg-brand/10 text-brand" : "bg-goldSoft text-ink"
                          }`}
                        >
                          {applicationStatusLabel(a)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => toggleOutreachStatus(a.applicationId, outreach.outreachStatus)}
                          disabled={isSaving}
                          className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
                            outreach.outreachStatus === "called" ? "bg-brand/10 text-brand" : "bg-mist text-slate"
                          }`}
                        >
                          {outreach.outreachStatus === "called" ? "Called" : "Not called"}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <button
                            onClick={() => setReachability(a.applicationId, "reachable")}
                            disabled={isSaving}
                            className={`rounded-full px-2 py-1 text-xs font-medium transition ${
                              outreach.reachability === "reachable" ? "bg-brand/10 text-brand" : "bg-mist text-slate"
                            }`}
                          >
                            Reachable
                          </button>
                          <button
                            onClick={() => setReachability(a.applicationId, "not_reachable")}
                            disabled={isSaving}
                            className={`rounded-full px-2 py-1 text-xs font-medium transition ${
                              outreach.reachability === "not_reachable" ? "bg-bad/10 text-bad" : "bg-mist text-slate"
                            }`}
                          >
                            Not reachable
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => logCall(a.applicationId)}
                          disabled={isSaving}
                          className="text-sm font-medium text-ink hover:text-brand"
                          title="Log another call attempt"
                        >
                          {outreach.callCount} <span className="text-xs text-slate">(+1)</span>
                        </button>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate">
                        {outreach.lastContactedAt
                          ? new Date(outreach.lastContactedAt).toLocaleString("en-NG", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
                          : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => openNotes(a.applicationId)}
                          className="flex items-center gap-1 text-xs text-slate hover:text-ink"
                        >
                          {outreach.notes ? "Edit" : "Add"}
                          {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                        </button>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="border-t border-line bg-paper">
                        <td colSpan={8} className="px-4 py-3">
                          <textarea
                            className="input min-h-[80px] w-full"
                            placeholder="Notes on this applicant…"
                            value={noteDraft}
                            onChange={(e) => setNoteDraft(e.target.value)}
                          />
                          <div className="mt-2 flex gap-2">
                            <button onClick={() => setExpandedId(null)} className="btn-secondary text-xs">
                              Cancel
                            </button>
                            <button onClick={() => saveNotes(a.applicationId)} disabled={isSaving} className="btn-primary text-xs">
                              {isSaving ? "Saving…" : "Save notes"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
