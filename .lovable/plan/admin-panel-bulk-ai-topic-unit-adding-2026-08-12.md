# Admin Panel + Bulk AI Topic/Unit Adding

## 1. Roles & Admin Panel

**Roles storage**: new `app_role` enum (`admin`, `user`) + `user_roles` table (separate from profiles, security-definer `has_role()` function). Your account gets the `admin` role seeded by email — tell me which email to use when you approve.

**Access rules**
- Regular users: unchanged (only their own notes).
- Admin: full read + edit + delete on every user's notes, plus can view all profiles.
- Admin also keeps normal user mode — the same app, with an extra "Admin" entry in the header menu.

**New `/admin` route** (guarded: redirects non-admins to `/`)
- Users list: display name, email, notes count, joined date. Search by email/name.
- Click a user → their notes list (subject, course, language, level, date).
- Open any note → the existing notes viewer with full edit/add/delete/export, saving back to that user's record.
- Delete a note from the admin list.
- A clear "viewing as admin" banner so it's obvious whose data is open.

## 2. Bulk AI topic & unit adding + file import

**Import topics/notes from a file** (Word .docx, Markdown .md, JSON, PDF)
- "Import" button in both the Add topic and Add unit dialogs.
- PDF/DOCX text is extracted in the browser (pdfjs + mammoth); .md and .json are read directly.
- JSON in the app's own notes shape imports units/topics with their content as-is; other formats are parsed into units → topics with their text as content.
- Preview screen before inserting: which units/topics were detected, with checkboxes to drop any.
- Options: import into the current unit as topics, or append as new units; and optionally "regenerate content with AI" for imported topic names that have no body.



**Add topic dialog (multi)**
- Textarea: one topic name per line (comma-separated also accepted).
- Detail level + language selectors (as today).
- "Add empty" adds all names with blank content; "Generate with AI" generates content for each topic, with progress ("3/7 generated") and per-topic failure kept visible instead of aborting the batch.

**Add unit dialog (syllabus-style)**
- Unit number + unit name.
- Textarea for that unit's topics, one per line — same syllabus feel as the home page.
- Buttons: "Add unit only", "Add unit + topics (empty)", "Add unit + generate all with AI".

**Generation behaviour**
- Requests run in small parallel batches (3 at a time) so 10+ topics stay fast without hitting rate limits.
- Rate limit / credit errors surface once with a clear message; already-generated topics are kept.
- Works identically for fresh notes and history notes (and admin-opened notes).

## Technical notes
- Migration: `app_role` enum, `user_roles` table with GRANTs + RLS, `has_role()` security-definer function, admin-scoped policies added to `notes_history` and `profiles`, plus admin `SELECT` on `user_roles`.
- Seed the admin role for your email via a data insert after the migration.
- `useAuth` extended with an `isAdmin` flag (queried from `user_roles`); new `AdminRoute` guard component.
- New files: `src/pages/Admin.tsx`, `src/pages/AdminUserNotes.tsx`, `src/components/AdminRoute.tsx`, `src/hooks/useIsAdmin.ts`.
- `NotesViewer.tsx`: the two dialogs move to multi-input state; a shared `generateTopics()` helper with a concurrency limit replaces the single-topic calls to the `generate-topic` function (function itself unchanged).
