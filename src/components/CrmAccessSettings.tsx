"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase-client";
import { getTableCached, invalidateTableCache } from "@/lib/supabaseCache";
import { rowToStaffRecord } from "@/lib/supabaseMappers";
import type { StaffRecord } from "@/lib/types";

export default function CrmAccessSettings() {
  const [staff, setStaff] = useState<StaffRecord[] | null>(null);
  const [grantedUserIds, setGrantedUserIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [workingId, setWorkingId] = useState<string | null>(null);

  async function load() {
    try {
      const supabase = getSupabaseClient();
      const [staffData, { data: crmRows, error: crmErr }] = await Promise.all([
        getTableCached("staff", rowToStaffRecord),
        supabase.from("crm_access").select("user_id"),
      ]);
      if (crmErr) throw new Error(crmErr.message);
      setStaff(staffData);
      setGrantedUserIds(new Set((crmRows ?? []).map((r) => r.user_id)));
    } catch (err) {
      const message =
        err instanceof Error && err.message.includes("permission")
          ? "Access denied. Your account isn't in the admins table yet."
          : "Couldn't load CRM access data. Please try refreshing.";
      setError(message);
      console.error("Failed to load CRM access settings:", err);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function grant(staffMember: StaffRecord) {
    if (!staffMember.authUid) return;
    setWorkingId(staffMember.staffId);
    try {
      const supabase = getSupabaseClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { error: insertErr } = await supabase
        .from("crm_access")
        .insert({ user_id: staffMember.authUid, granted_by: user?.id });
      if (insertErr) throw new Error(insertErr.message);
      setGrantedUserIds((prev) => new Set(prev).add(staffMember.authUid!));
    } catch (err) {
      console.error("Failed to grant CRM access:", err);
      setError("Couldn't grant access. Please try again.");
    } finally {
      setWorkingId(null);
    }
  }

  async function revoke(staffMember: StaffRecord) {
    if (!staffMember.authUid) return;
    setWorkingId(staffMember.staffId);
    try {
      const supabase = getSupabaseClient();
      const { error: deleteErr } = await supabase.from("crm_access").delete().eq("user_id", staffMember.authUid);
      if (deleteErr) throw new Error(deleteErr.message);
      setGrantedUserIds((prev) => {
        const next = new Set(prev);
        next.delete(staffMember.authUid!);
        return next;
      });
    } catch (err) {
      console.error("Failed to revoke CRM access:", err);
      setError("Couldn't revoke access. Please try again.");
    } finally {
      setWorkingId(null);
    }
  }

  const filtered = useMemo(() => {
    if (!staff) return [];
    const q = search.trim().toLowerCase();
    const list = q
      ? staff.filter((s) => s.fullName.toLowerCase().includes(q) || s.staffId.toLowerCase().includes(q))
      : staff;
    return [...list].sort((a, b) => a.fullName.localeCompare(b.fullName));
  }, [staff, search]);

  const grantedCount = staff?.filter((s) => s.authUid && grantedUserIds.has(s.authUid)).length ?? 0;

  return (
    <div className="card-rise rounded-2xl border border-line bg-white p-6 shadow-sm">
      <h2 className="font-display text-base font-semibold text-ink">CRM access</h2>
      <p className="mt-1 text-sm text-slate">
        Choose which staff can use the CRM tab to track applicant follow-up. Admins always have access.
        {staff && ` Currently granted to ${grantedCount} staff member${grantedCount === 1 ? "" : "s"}.`}
      </p>

      {error && (
        <p role="alert" className="mt-4 rounded-md bg-bad/10 px-3 py-2 text-sm text-bad">
          {error}
        </p>
      )}

      <input
        className="input mt-4 max-w-xs"
        placeholder="Search staff by name or ID…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="mt-4 max-h-96 overflow-y-auto rounded-md border border-line">
        {!staff && !error && <p className="px-4 py-6 text-center text-sm text-slate">Loading…</p>}
        {staff && filtered.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-slate">No staff match "{search}".</p>
        )}
        {filtered.map((s) => {
          const isGranted = Boolean(s.authUid && grantedUserIds.has(s.authUid));
          const isWorking = workingId === s.staffId;
          return (
            <div key={s.staffId} className="flex items-center justify-between gap-3 border-t border-line px-4 py-3 first:border-t-0">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">{s.fullName}</p>
                <p className="truncate text-xs text-slate">
                  {s.tier} · {s.staffId}
                  {!s.authUid && <span className="ml-2 text-yellow-700">Hasn't logged in yet</span>}
                </p>
              </div>
              <button
                onClick={() => (isGranted ? revoke(s) : grant(s))}
                disabled={!s.authUid || isWorking}
                className={isGranted ? "btn-secondary shrink-0 text-xs" : "btn-primary shrink-0 text-xs"}
                title={!s.authUid ? "This staff member needs to log in at least once first" : undefined}
              >
                {isWorking ? "Working…" : isGranted ? "Revoke" : "Grant"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
