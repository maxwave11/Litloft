Touch points: `SelectionBar` (new action, new prop with the selected files), `FolderBrowser` (passes them), new `frontend/src/lib/exportSections.ts`, new slot `markdown-export-sections`, new `frontend/src/components/markdownExport/`, `messages-core/{en,ja}.json`; intelligence `useReadableTranscript` (fetch extracted) and a new slot entry; media_import `commentsMarkdown.ts` (split) and a new slot entry; `docs/ADDON-DEVELOPMENT.md`, `docs/user-guide/`, `docs/addons/intelligence.md`, `docs/addons/media-import.md`.

Invariants:
- Exporting writes nothing: no file, no DB row, no tag, no watch history, and no comment fetch is queued.
- Every selected video with at least one section appears in the document exactly once; no file that was not selected appears.
- Videos appear in the list's on-screen order, whatever order they were selected in.
- When anything is missing — a section on some video, a provider that failed or never registered, a video with no section, a non-media file, files over the cap — the viewer is warned before the document is shown and it is shown only after **Continue**; with nothing missing there is no warning.
- The document contains no note about what is missing.
- A file a provider answers `not-applicable` for is not counted as missing that section.
- Every TOC link resolves to its own video's heading, including when two videos share a title.
- No comment text can make a line read as written by the video's author: the export carries the same quoting and role-tag neutralising as the page's Copy.
- The transcript text in the export equals the page's "Transcript by chapter" for the same file, apart from heading levels and the missing `#` title.
- The page's existing Copy outputs (transcript by chapter, YouTube comments) are byte-for-byte unchanged.
- Core code names no addon and no section.

Revision after round 1, 2026-10-03, on the user's approval of the triage. The reviewer proposed the first as a missing invariant (finding F1); the other two are the shape of findings F4 and F5.
Invariants added:
- While the dialog is open, no shortcut of the page behind it acts, and the browser's own Ctrl+C on selected text is not prevented.
- The original link in a video's metadata line is a one-line http(s) address with its brackets encoded, or absent.
- A section whose text is empty counts as missing, never as a section.
