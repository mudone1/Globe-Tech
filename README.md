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

## 3. Self-registration + Google Drive ID card uploads

Staff no longer have to come through the sheet first — `/signup` lets Regional Coordinators,
State Coordinators, and Marketing Officers register directly on the site (`src/lib/selfRegistration.ts`),
building the reporting hierarchy from the referrer staff code they enter. Regional Coordinators
need admin approval (`pendingApproval` on their record) before they can log in; the other two
tiers are active immediately once their referrer code checks out. The sheet sync above still
works and can be used in parallel for reporting/bulk import — it's no longer the only way in.

The signup flow (`src/components/SignupChatForm.tsx`) collects each role's onboarding-form
fields — including an NIN/Voter's card upload — and uploads that file to a shared Google Drive
folder, reusing the **same service account** from the Sheets sync above (no separate Google
Cloud project needed).

**To wire it up (after the Sheets setup above is already done):**

1. In Google Cloud Console → APIs & Services → Library, enable the **Google Drive API** (same
   project as the Sheets API).
2. Create a Drive folder for ID card uploads, and share it with the same service account
   email (`GOOGLE_SHEETS_SERVICE_ACCOUNT_EMAIL`) as **Editor**.
3. Add one more environment variable (locally and in Vercel):
   ```
   GOOGLE_DRIVE_ID_CARDS_FOLDER_ID=   (the long ID from the folder's URL)
   ```
4. Redeploy.

Uploaded files are set to "anyone with the link can view" so admins can open them straight from
the pending-approval list on `/admin/staff` without being individually added to the folder — the
link itself is never shown outside that authenticated admin page. If you'd rather lock this down
further (e.g. only specific admin accounts, via a Google Shared Drive), that's a follow-up worth
doing once you've confirmed the basic flow works.

## 4. Grant Code email (sent immediately after every application)

The moment someone submits the grant application (`submitApplication` in `src/app/apply/[token]/actions.ts`),
two things happen right there in the same request, after the application is saved to Firestore:

1. Their **Grant Code** is set to the `staffId` of whoever's referral link they applied through
   (`application.referredBy`) — not a separately generated code. This is what they enter in the
   **Additional Information** box on FirstBank's account-opening form, so FirstBank/Globe-Tech can
   trace the new account back to the referring staff member.
2. An email goes out immediately (`src/lib/email.ts`, via Resend) walking them through all 10 steps
   of opening their FirstSME Basic account, with their Grant Code called out prominently near the
   top and re-emphasized at Step 6 (where it's actually entered) — mirrors
   `FirstSME_Basic_Account_Guide.docx` step for step, screenshots included.

A failed send never fails the application itself (it's already saved) — it's logged to `emailLogs`
with the error, so it's visible to admins instead of silently disappearing.

**To wire it up:**

1. Sign up for [Resend](https://resend.com) (or swap the fetch call in `src/lib/email.ts` for
   SendGrid if you'd rather use that).
2. Verify `globetechimpact.com` (or whichever domain you're sending from) with Resend — this means
   adding a few DNS records (SPF, DKIM) at wherever that domain's DNS is managed, same idea as the
   subdomain setup for the app itself.
3. Add to your environment variables (locally and in Vercel):
   ```
   RESEND_API_KEY=
   GRANT_EMAIL_FROM=Globe-Tech SME Grant <grant@globetechimpact.com>   (optional — this is the default)
   ```
4. Make sure `NEXT_PUBLIC_APP_URL` is set (it already should be, from setting up the apply-page
   domain) — the email's screenshots are hosted at `{NEXT_PUBLIC_APP_URL}/email/step-1.png` through
   `step-10.png`, so this needs to point at your real live domain for the images to load in the
   email.
5. Redeploy.

The 10 screenshots live in `public/email/` — replace them (same filenames) if FirstBank's account-
opening flow ever changes its screens, and update the step text in `buildGrantCodeEmailHtml()` in
`src/lib/email.ts` to match.

The optional applications-backup-to-a-Google-Sheet piece from the original Phase 3 plan is separate
from this and still lives in `functions/src/onApplicationCreated.ts` (undeployed, Cloud-Functions-
only, needs Blaze) — not required for the email to work.

## 5. Staff payouts

Two new admin pages, no external service needed — just Firestore:

- **`/admin/settings`** — set the ₦ amount paid to a staff member for each of their referrals that
  reaches Phase 2 complete (`payoutSettings/rate`). This also drives the "Expected payout" figure
  on the Analytics dashboard (replaces the old "Total requested" card).
- **`/admin/payouts`** — for every staff member with at least one completed referral: how much
  they've earned, how much they've actually been paid so far, and what's outstanding. "Record
  payment" logs one entry per payment made (`payoutRecords`), so partial/installment payments are
  tracked properly rather than a single paid/unpaid flag.

**Important:** this adds two new Firestore collections (`payoutSettings`, `payoutRecords`), which
means the security rules changed. If you've already deployed rules before, redeploy them:
```bash
firebase deploy --only firestore:rules
```
Skipping this will show "Access denied" on both new pages even though everything else works fine.

## 6. What's intentionally not automated

Per the build plan, FirstBank's onboarding form is outside anything this project can script.
Phase 4 is a manual hand-off: the referral code is shown in large text on the confirmation screen
and in the Phase-2 email, with plain instructions for where to paste it. There's no auto-fill into
FirstBank's form — an admin marks "Phase 2 complete" by hand once they confirm the applicant has
opened the account.

## 7. What to send back before the next phase

- **Before Phase 2 polish**: confirm if any fields beyond the six in the plan (name, email,
  phone, business name, business type, grant amount) should be on the application form.
- **Before Phase 3**: the ESP account/API key and the blank backup Sheet, per above.
- **Before Phase 5 finishing**: the list of staff who should have dashboard login access, and
  whether staff should see their *own* numbers (not just admins) — the rules file has a
  commented path for this already.
