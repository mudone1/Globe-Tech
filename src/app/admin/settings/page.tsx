"use client";

import { useEffect, useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { getFirebaseDb, getFirebaseAuth } from "@/lib/firebase-client";
import AdminGate from "@/components/AdminGate";
import AdminShell from "@/components/AdminShell";
import type { PayoutSettingsRecord, ReferralLinkSettingsRecord } from "@/lib/types";

export default function SettingsPage() {
  return (
    <AdminGate>
      <AdminShell>
        <div className="mx-auto max-w-2xl">
          <header className="mb-6">
            <p className="font-mono text-xs uppercase tracking-widest text-gold">Admin</p>
            <h1 className="mt-1 font-display text-2xl font-semibold text-ink">Settings</h1>
          </header>
          <PayoutSettings />
          <div className="mt-6">
            <ReferralLinkVisibility />
          </div>
        </div>
      </AdminShell>
    </AdminGate>
  );
}

function PayoutSettings() {
  const [rate, setRate] = useState<string>("");
  const [savedRate, setSavedRate] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const snap = await getDoc(doc(getFirebaseDb(), "payoutSettings", "rate"));
        if (snap.exists()) {
          const data = snap.data() as PayoutSettingsRecord;
          setSavedRate(data.perCompletionAmount);
          setRate(String(data.perCompletionAmount));
        } else {
          setRate("0");
        }
      } catch (err) {
        const message =
          err instanceof Error && err.message.includes("permission")
            ? "Access denied. Your account isn't in the admins collection yet, or the Firestore rules haven't been published — see the README."
            : "Couldn't load settings. Please try refreshing.";
        setError(message);
        console.error("Failed to load payout settings:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handleSave() {
    const amount = Number(rate);
    if (!Number.isFinite(amount) || amount < 0) {
      setError("Enter a valid amount (0 or more).");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const uid = getFirebaseAuth().currentUser?.uid;
      const record: PayoutSettingsRecord = {
        perCompletionAmount: amount,
        updatedAt: new Date().toISOString(),
        ...(uid ? { updatedBy: uid } : {}),
      };
      await setDoc(doc(getFirebaseDb(), "payoutSettings", "rate"), record);
      setSavedRate(amount);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError("Couldn't save. Please try again.");
      console.error("Failed to save payout settings:", err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {error && (
        <p role="alert" className="mb-6 rounded-md bg-bad/10 px-3 py-2 text-sm text-bad">
          {error}
        </p>
      )}

      <div className="card-rise rounded-2xl border border-line bg-white p-6 shadow-sm">
        <h2 className="font-display text-base font-semibold text-ink">Payout per completed referral</h2>
        <p className="mt-1 text-sm text-slate">
          The amount (₦) paid to a staff member for each of their referrals whose application
          reaches <strong>Phase 2 complete</strong>. This drives the "Expected payout" figure on
          the Analytics dashboard and the earned amounts on the Payouts page.
        </p>

        {loading ? (
          <p className="mt-4 text-sm text-slate">Loading…</p>
        ) : (
          <>
            <div className="mt-5 flex items-end gap-3">
              <label className="block flex-1">
                <span className="mb-1.5 block text-sm font-medium text-ink">Amount per completion (₦)</span>
                <input
                  className="input"
                  type="number"
                  min={0}
                  step={100}
                  value={rate}
                  onChange={(e) => setRate(e.target.value)}
                />
              </label>
              <button onClick={handleSave} disabled={saving} className="btn-primary">
                {saving ? "Saving…" : saved ? "Saved ✓" : "Save"}
              </button>
            </div>
            {savedRate !== null && (
              <p className="mt-3 text-xs text-slate">
                Currently: <strong>₦{savedRate.toLocaleString()}</strong> per completed referral.
              </p>
            )}
          </>
        )}
      </div>
    </>
  );
}

function ReferralLinkVisibility() {
  const [linksHidden, setLinksHidden] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const snap = await getDoc(doc(getFirebaseDb(), "appSettings", "referralLinks"));
        // Defaults to hidden when never set — mirrors the server default in
        // areReferralLinksHidden() so this toggle reflects reality on first load.
        setLinksHidden(snap.exists() ? (snap.data() as ReferralLinkSettingsRecord).linksHidden : true);
      } catch (err) {
        const message =
          err instanceof Error && err.message.includes("permission")
            ? "Access denied. Your account isn't in the admins collection yet, or the Firestore rules haven't been published — see the README."
            : "Couldn't load settings. Please try refreshing.";
        setError(message);
        console.error("Failed to load referral link settings:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handleSave(nextHidden: boolean) {
    setSaving(true);
    setError(null);
    try {
      const uid = getFirebaseAuth().currentUser?.uid;
      const record: ReferralLinkSettingsRecord = {
        linksHidden: nextHidden,
        updatedAt: new Date().toISOString(),
        ...(uid ? { updatedBy: uid } : {}),
      };
      await setDoc(doc(getFirebaseDb(), "appSettings", "referralLinks"), record);
      setLinksHidden(nextHidden);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError("Couldn't save. Please try again.");
      console.error("Failed to save referral link settings:", err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {error && (
        <p role="alert" className="mb-6 rounded-md bg-bad/10 px-3 py-2 text-sm text-bad">
          {error}
        </p>
      )}

      <div className="card-rise rounded-2xl border border-line bg-white p-6 shadow-sm">
        <h2 className="font-display text-base font-semibold text-ink">Staff referral links</h2>
        <p className="mt-1 text-sm text-slate">
          While hidden, staff can still log in and reset their password, but their referral link
          on the dashboard is replaced with a "check back soon" message — the link itself keeps
          working underneath, it's just not shown to them. Use this while applications are paused
          (e.g. awaiting bank verification training) so staff don't start sharing it early.
        </p>

        {loading || linksHidden === null ? (
          <p className="mt-4 text-sm text-slate">Loading…</p>
        ) : (
          <>
            <div className="mt-5 flex items-center gap-3">
              <button
                onClick={() => handleSave(true)}
                disabled={saving}
                className={linksHidden ? "btn-primary" : "btn-secondary"}
              >
                Hidden
              </button>
              <button
                onClick={() => handleSave(false)}
                disabled={saving}
                className={!linksHidden ? "btn-primary" : "btn-secondary"}
              >
                Visible
              </button>
              {saved && <span className="text-xs text-brand">Saved ✓</span>}
            </div>
            <p className="mt-3 text-xs text-slate">
              Currently: <strong>{linksHidden ? "Hidden from staff" : "Visible to staff"}</strong>.
            </p>
          </>
        )}
      </div>
    </>
  );
}
