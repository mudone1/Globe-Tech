# Globe-Tech — SME Grant Referral Platform

This is the Phase 1 + Phase 2 build from the build plan: token-based staff referral links, the
onboarding-sheet sync, the admin staff list, and the public application form. Phase 3
(automated email + Sheets backup) is written but disabled until you supply an ESP key —
see below. Phases 5–7 (fuller dashboard polish, QA, deployment) build on this once 1–3 are live.

## What's in this repo

```
src/app/apply/[token]/     Public referral link → resolves token server-side → application form
src/app/admin/staff/       Admin: staff list with one-click copy-link (Phase 1)
src/app/admin/dashboard/   Admin: leaderboard, mark-complete toggle, CSV export (Phase 5 preview)
src/lib/                   Firebase client + admin SDK setup, referral token logic, shared types
functions/                 Cloud Functions: onboarding sheet sync (Phase 1), Phase-2 email + Sheets backup (Phase 3)
firestore.rules            Security rules — the real access control (the admin UI gate alone isn't enough)
```

## 1. Before you can run this at all

You'll need a Firebase project (create it yourself in the Firebase console — this build assumes
it exists):

1. Create the Firebase project, enable **Firestore** and **Authentication** (email/password).
2. Copy `.env.local.example` to `.env.local` and fill in:
   - The `NEXT_PUBLIC_FIREBASE_*` values from Project settings → General → Your apps → Web app.
   - `FIREBASE_SERVICE_ACCOUNT_KEY` — generate one at Project settings → Service accounts →
     Generate new private key, then paste the whole JSON as a single line.
3. Deploy the security rules: `firebase deploy --only firestore:rules`
4. Create an `admins/{uid}` document (any content) for each admin's Firebase Auth UID, so the
   dashboard and staff list are visible to them — see the comment at the top of `firestore.rules`.

Then:
```bash
npm install
npm run dev
```

## 2. Onboarding sheet sync (Phase 1) — runs in this app, not Firebase Functions

Deploying Cloud Functions requires Firebase's Blaze (pay-as-you-go) plan, even at zero real usage
— that's a Firebase platform rule, not something we can configure around. Rather than requiring
that, the sheet sync runs as part of this Next.js app instead (`src/lib/sheetsSync.ts`), hosted
on Vercel, which stays free at this scale.

It reads three tabs — **Marketing Officer**, **State Coordinator**, and **Regional Cord** — and
matches columns by header name (Staff Code, Full Name, Tier, Email Address, Phone No., State of
Residence), so it's tolerant of the small header differences between tabs. Rows with no Staff
Code yet (not approved) are skipped automatically.

**To wire it up:**

1. Enable the Google Sheets API and create a service account (Google Cloud Console → APIs &
   Services → Credentials → Create Credentials → Service Account → add a JSON key).
2. Share your onboarding sheet with that service account's email, as a Viewer.
3. Add these to your environment variables (both locally in `.env.local` and in Vercel → Settings
   → Environment Variables):
   ```
   ONBOARDING_SHEET_ID=          (the long ID from the sheet's URL)
   GOOGLE_SHEETS_SERVICE_ACCOUNT_EMAIL=
   GOOGLE_SHEETS_PRIVATE_KEY=
   ```
4. Redeploy on Vercel so it picks up the new env vars.

**Two ways to trigger a sync:**
- Click **"Sync now"** on `/admin/staff` — runs immediately, good for right after new staff register.
- Automatically once a day via Vercel Cron (`vercel.json`, already configured to hit
  `/api/cron/sync-staff` at 6am daily). Set `CRON_SECRET` to any random string in your env vars
  (both locally and in Vercel) so only Vercel's own scheduler can trigger it — otherwise anyone
  who finds the URL could trigger a sync. Change the `schedule` in `vercel.json` if you want a
  different time; Vercel's Hobby plan allows once-daily cron jobs (Pro allows more frequent).

The original Firebase Cloud Functions version of this sync is still in `functions/` for
reference, in case you upgrade to Blaze later and want automatic 15-minute syncing instead — it's
not deployed or required for the app to work.

## 3. Enabling Phase 3 (automated email + Sheets backup)

`functions/src/onApplicationCreated.ts` is fully written but needs:

- A Resend or SendGrid account and API key, with a verified sender domain → `RESEND_API_KEY`
- A new, blank Google Sheet for the applications backup, shared (edit access) with the same
  service account used above → `APPLICATIONS_BACKUP_SHEET_ID`

Until those are set, new applications will still save correctly to Firestore — they just won't
trigger an email or backup row yet, and the failure is logged to `emailLogs` rather than silently
disappearing.

## 4. What's intentionally not automated

Per the build plan, FirstBank's onboarding form is outside anything this project can script.
Phase 4 is a manual hand-off: the referral code is shown in large text on the confirmation screen
and in the Phase-2 email, with plain instructions for where to paste it. There's no auto-fill into
FirstBank's form — an admin marks "Phase 2 complete" by hand once they confirm the applicant has
opened the account.

## 5. What to send back before the next phase

- **Before Phase 2 polish**: confirm if any fields beyond the six in the plan (name, email,
  phone, business name, business type, grant amount) should be on the application form.
- **Before Phase 3**: the ESP account/API key and the blank backup Sheet, per above.
- **Before Phase 5 finishing**: the list of staff who should have dashboard login access, and
  whether staff should see their *own* numbers (not just admins) — the rules file has a
  commented path for this already.
