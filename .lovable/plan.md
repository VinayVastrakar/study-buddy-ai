## Goal
NotesViewer me ek "Export" dropdown add karna jisse user apne generated/saved notes ko **PDF, DOCX, Markdown, ya JSON** format me download kar sake — proper formatting ke saath (units → topics hierarchy, headings, spacing). Ye NotesViewer component ke andar rahega, isliye Index page (fresh generation) aur NotesView page (history se opened) — dono jagah automatic available ho jayega.

## Approach

Ek naya utility module `src/lib/exportNotes.ts` banayenge jo `GeneratedNotes` object leke 4 formats me file generate karega. Phir NotesViewer header me existing badges ke saath ek shadcn `DropdownMenu` add karenge with 4 export options.

### Format details
- **PDF** — `jspdf` use karke: title page (subject, course, language, level) + har unit ka heading + har topic ka sub-heading + content with word-wrap and page-breaks. Font: Helvetica (jsPDF built-in, koi custom font load nahi).
- **DOCX** — `docx` library: HEADING_1 for subject, HEADING_2 for units, HEADING_3 for topics, Normal paragraphs for content. `Packer.toBlob` → download.
- **Markdown** — Pure string builder: `# subject`, `## Unit N — name`, `### topic`, content paragraphs. `.md` blob.
- **JSON** — `JSON.stringify(notes, null, 2)` as `.json` blob (backup / reimport friendly).

Sab downloads sanitized filename use karenge: `<subject>-notes.<ext>`.

### UI change
NotesViewer ke top-right badges wale div me ek `DropdownMenu` add karenge:
```
[Download ▼]  [Language]  [Level N]
```
Options: Export as PDF / Word (.docx) / Markdown / JSON. Har click par corresponding exporter run karega and toast show karega.

## Files
- **New** `src/lib/exportNotes.ts` — 4 exporter functions + filename helper.
- **Edit** `src/components/NotesViewer.tsx` — import exporters, add DropdownMenu button in header.
- **Package installs** — `jspdf` and `docx` (bun add).

## Technical notes
- `jspdf` handles multi-page automatically via `splitTextToSize` + manual `addPage()` when y > page height.
- `docx` v9 supports `HeadingLevel.HEADING_1/2/3` and `Packer.toBlob()` in browser.
- No backend/db changes needed — pure client-side export.
- No changes to Index.tsx or NotesView.tsx (they already use NotesViewer).