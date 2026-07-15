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

## 2. Wiring up the onboarding sheet sync (Phase 1)

`functions/src/sheetsSync.ts` reads your existing staff-onboarding Google Sheet and keeps the
`staff` collection current. Before deploying it:

- Share the sheet (read-only is enough) with a Google Sheets API service account you create.
- Set these as Cloud Functions params (via `firebase functions:config:set` or a `.env` in
  `functions/`, depending on your Firebase CLI version):
  `ONBOARDING_SHEET_ID`, `GOOGLE_SHEETS_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_SHEETS_PRIVATE_KEY`
- **Confirm the exact column headers** in each of the three tabs (Regional Coordinator, State
  Coordinator, Marketing Officer) — the code currently assumes
  `Sequence | Full Name | Email | Phone | State | Active` in that order. Adjust the indices in
  `sheetsSync.ts` to match your real sheet, and confirm the `115545925` program-code suffix in
  the staffId format is actually constant across every staff member.

Deploy with:
```bash
cd functions && npm install && npm run deploy
```

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
