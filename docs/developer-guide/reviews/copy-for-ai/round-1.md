# Copy for AI: review, round 1

Reviewed: core `feat/copy-for-ai` at `d8e4de4eb9e3553b51c46224603c7cd22cdc7993`;
`addons/media_import` `833f3ca..b4d23c9`; `addons/intelligence` `fb096858..63c57ba`.
Reviewer worked from the fixed SHAs, fixed nothing, and restored every mutation.

Evidence labels: `[introduced]` = in a file or function this change creates or
changes, or shown by running the same reproduction against the base.
`[pre-existing]` = the defect is in code this change does not touch.

## (a) Places the diff reaches that are not in the touch-point list

Candidates for a missing invariant, none of them found broken except where a finding below says so.

1. `runExport.ts` `exportFile` is now exported and called from the file page. It
   still does `readOriginalUrl` (a `GET /api/files/{id}/stream` for every `.loft`) as
   well as running every provider. The stream handler writes nothing (checked: no
   `db.`/commit/WatchHistory in it), so "pressing the button writes nothing" holds.
2. A `markdown-export-sections` `AddonSlot` is now mounted for **every** file page that
   passes a `file` (not only when the viewer presses the button, and not only when a
   transcript exists). Opening any media page therefore loads the media_import chunk
   and registers both providers in the global `exportSections` store. No network call
   is made by registration, so nothing is written or fetched, but it is a new
   per-page-view cost and a new place where a provider chunk that fails to load
   changes what the button copies (finding 1, finding 2).
3. `useExportProviders` is shared with `MarkdownExportContainer`. The dialog's
   behaviour is unchanged (checked against `git show develop:...MarkdownExportContainer.tsx`:
   same 5 s timer from mount, same `ready` expression, same `plan` effect; the 16
   container tests pass). The new consumer differs in one respect: its timer starts at
   `ReadingSection` mount, not at slot mount (finding 1).
4. `formatCommentsSection` is also the batch export's builder, so the batch export's
   comments are re-ordered. The spec accepts this. It is not in the invariants list.
5. `FileDetailContainer.addonSlotProps.file` reaches every slot on the file page and,
   through `FileActions`/`FileActionRow` `addonProps` spreading, `file-actions-menu`
   entries. I looked for an addon slot component with a `file` prop of another meaning,
   or that spreads props onto a DOM node: none found (only `CardIndicators` and
   `CardMetadata` spread props, and they are card slots that do not get these props).
6. `GET /analysis-prompt` has no `addon_feature` gate, so it answers on a drive where the
   intelligence addon is policy-off, for anyone who can open the drive. The text is
   operator-wide, not drive data, so this is a note, not a finding.

## Findings

### 1. The "providers ready" timer starts before the slot it waits for is mounted  [introduced]

`frontend/src/components/markdownExport/useExportProviders.ts:28-38`,
`addons/intelligence/frontend/ReadingSection.tsx:64,153,186,254`.

`ReadingSection` calls `useExportProviders()` at line 64, so the 5 s `timedOut` timer
starts when the component mounts. The `markdown-export-sections` slot is rendered at line 186,
after `if (tab === null) return null` (line 153); `tab` is set only after both the transcript
and the summaries have loaded. In the dialog the hook and the slot mount together, so
"5 s" means "5 s of waiting for providers". Here it can mean "5 s of waiting for the
transcript". Once the transcript or summaries take longer than 5 s, `ready` is true the
moment the button first appears, with `providers` empty or partial. The button is enabled
(`disabled={!ready || preparing}`), the viewer clicks, `exportFile` runs with no transcript
provider, and the viewer gets "Could not prepare the text to copy". A second click, a few
hundred ms later, works.

Reproduction (hook only, run and deleted): mock `useAddonSlots` with two entries and nothing
offered; mount `useExportProviders`; advance 5001 ms. Result: `ready === true`,
`providers === []`, `unavailable === ["Transcript","Comments"]`. In `ReadingSection` that
state is what the button sees on its first frame when loading took more than 5 s.
Not reproducible against the base: the hook did not exist; the dialog's identical logic
is correct because its slot mounts with it.

The disabled state during the wait (up to 5 s) has no explanation for the viewer or for
assistive technology (opacity only; no title, no `aria-describedby`).

Severity view: low to medium; self-heals on the next click, but the first click on a slow
page is the one that fails.

### 2. The "comments are missing" notice does not cover every case the invariant names  [introduced]

`addons/intelligence/frontend/ReadingSection.tsx:122,133-137`;
invariant: "A video whose comments are absent, not applicable or failed to load is copied
with its transcript and prompt, and the viewer is told the comments are missing."

Two of the three named cases are silent:

- **not applicable** (a local video, a non-`.loft`): the code tells the viewer nothing, and a
  test (`does not mention a section that never applies to the file`) pins that. The spec's
  toast bullet lists `empty`/`not-applicable`/`failed` together, so the code and the test
  have moved away from both the spec and the invariant. This may be intentional (a toast
  naming YouTube comments on a local file would be noise) but the invariant text was not revised.
- **absent** (the comments provider never registered, for example the media_import slot
  chunk is slow or fails to load): `const { providers } = exportProviders;` drops
  `exportProviders.unavailable`, which the dialog uses for exactly this
  (`gapUnavailable`). The button copies the transcript and says only "Copied for AI".
  Reproduction (run and deleted): `exportProviders.providers = [transcript()]`,
  `exportProviders.unavailable = ["YouTube comments"]`, press. Toasts observed:
  `success: [["Copied for AI"]]`, `error: []`.

Together with finding 1 this is the realistic path: a provider that has not loaded yet is
not an exotic state on a cold page.

Severity view: low to medium. The viewer pastes a document with no comments believing it has them.

### 3. Tests that would let regressions through  [introduced]

Mutations that survived (details in the list below):

- M14: deleting `{file && <AddonSlot id={EXPORT_SECTIONS_SLOT} props={{ drive }} />}`
  (`ReadingSection.tsx:186`) leaves all 40 tests green. `AddonSlot` is mocked to `null`, so
  nothing asserts that the component mounts the slot with that id and the drive. Without it
  the providers never register and every click ends in "Could not prepare".
- M13: dropping `|| preparingForAi` from `disabled` (line 254) leaves all tests green.
- M18: never calling `setPreparingForAi(false)` leaves all tests green (a button that stays
  disabled forever after one copy).
- `getAnalysisPrompt` (`api.ts`) is only ever called through a mock; its URL, the
  `X-Lit-Drive` header and the empty-text rejection are not asserted anywhere. Changing the
  URL to a path that is not in the manifest keeps the suite green.
- P12: deleting the `/analysis-prompt` entry from `manifest.json` leaves all 26 backend tests
  green. The proxy then answers 404 "Route not found" to the button's `GET /analysis-prompt`,
  so every copy fails with "Could not prepare the text to copy". The admin routes have the
  manifest parity test; the viewer route has nothing equivalent.
- P14: deleting `app.include_router(analysis_prompt.router)` from `main.py` also leaves the
  backend tests green: they build their own `FastAPI()` and include the router themselves, so
  the real app's wiring is not exercised.
- Admin section: removing `maxLength` (A4) and removing `<ApplyMarker when="now" />` (A5)
  both survive. Both are UI-only; the second is the one that says "applies at once".

Severity view: low (test gaps), except the three wires the feature hangs on (slot mount, manifest
entry, `include_router`), each of which turns the button into a permanent "Could not prepare" with a green suite.

### 4. The Comments tab's Copy is not held against re-ordering  [introduced]

`addons/media_import/frontend/commentsMarkdown.ts:77,94`; invariant: "The Comments tab's Copy
... [is] unchanged from today."

Mutations M24 (`formatCommentsMarkdown` body now sorts) and M25 (`body()` itself sorts, so both
functions sort) leave all 48 media_import tests green. The only test that compares the two
(`matches the page's copy apart from its heading, legend and the order`) uses one top-level
comment, so it cannot tell sorted from unsorted. A future "make them consistent" edit would
change the page's Copy and nothing would fail. No existing test gave this protection before
the change either, but the change is what created a second ordering, and the invariant
names it.

Severity view: low.

### 5. A non-UTF-8 override file makes `GET /analysis-prompt` return 500  [pre-existing helper, declared invariant]

`addons/intelligence/app/_overrides_io.py:65` (not in this diff);
used by `app/analysis_prompt.py:68-72`. Invariant: "A malformed, wrong-typed or unknown-schema
override file never breaks the button: the default prompt is used."

`read_override_payload` catches `(OSError, json.JSONDecodeError)`. `Path.read_text(encoding="utf-8")`
on a file that is not valid UTF-8 raises `UnicodeDecodeError`, which is neither. Reproduction
(run in the intelligence image): write `b'\xff\xfe\x00bad'` to `analysis-prompt-overrides.json`,
`GET /analysis-prompt` -> **500**. `GET /admin/analysis-prompt` fails the same way, and
`AdminAnalysisPromptSettingsSection` renders only the load error in that state: the Save
and Reset buttons are not rendered, so an operator cannot repair it from the GUI and must
delete the file by hand. A realistic way to get there is hand-editing the JSON in an editor that
saves UTF-16 (Windows Notepad).

`[pre-existing]` for the helper (the same read exists for every other override file; the
helper is unchanged in this diff). The consequence for this feature is introduced, and the
test list the author wrote for the malformed case (`{not json`, `[]`, wrong type, blank,
missing key, unknown schema) does not include undecodable bytes.

Severity view: low (needs out-of-band corruption), but it is a declared invariant.

### 6. `PUT /admin/analysis-prompt` with a lone surrogate returns 500 and leaves a `.tmp` file  [introduced]

`addons/intelligence/app/routers/admin.py:437-446` -> `_overrides_io.py:113`.

`{"prompt": "\ud800 hi"}` passes `validate` (not blank, short, no NUL), then
`tmp.write_text(..., encoding="utf-8")` raises `UnicodeEncodeError`. Reproduction (intelligence
image): status 500; directory listing afterwards: `['analysis-prompt-overrides.json.tmp']`.
The real override file is untouched, so no saved prompt is lost; the stray `.tmp` is overwritten
by the next save. Reachable only by an administrator posting raw JSON (a textarea cannot
produce a lone surrogate), so this is a 500 where the spec says 400.

Severity view: very low.

### 7. The Japanese description names the button in English  [introduced]

`addons/intelligence/frontend/messages/ja.json:418` (`settings.analysisPrompt.description`):
"「Copy for AI」が動画の…". The Japanese button label is "AI用にコピー"
(`readableTranscriptCopyForAi`). An operator using the Japanese UI is told to look for a control
that is not called that. Key sets in en/ja are identical and the `{sections}` placeholder matches
in both (checked by script).

Severity view: very low.

### 8. The default prompt calls every pinned comment "the channel's own voice"  [introduced]

`addons/intelligence/app/analysis_prompt.py:30`: "pinned comments and [AUTHOR] comments are
the channel's own voice."

A pinned comment is chosen by the channel but can be written by anyone, and the document tags
it `[VIEWER]`. The sentence tells the model to treat a pinned viewer comment as the speaker's
position, which is what the next sentence ("Never present a comment's claim as the video's
claim") forbids. Whether to delete or reword is the author's call; the effect is on the content
of every default copy, not on code.

Severity view: low.

### 9. A blank title gives an empty heading, and `Copy` handles it differently  [introduced]

`frontend/src/components/markdownExport/document.ts:163` (`oneLine(entry.file.title)`), and
`ReadingSection.tsx:112` for the contrast.

`PUT /api/files/{id}` accepts `title: ""` (`FileUpdate.title: str | None`, applied without a
check). The existing **Copy** uses `title || filename`; **Copy for AI** uses `file.title`
only, so such a video produces `## ` with nothing after it and the model has no name for the
video. In the batch export the same `videoBlock` has the same behaviour (shared code), but this
is the first single-video path built on it.

Severity view: very low.

### 10. The export never aborts, so a stalled provider leaves the button disabled  [introduced]

`addons/intelligence/frontend/ReadingSection.tsx:127` (`new AbortController().signal`, never
aborted), `:120-149`.

A provider whose request never settles keeps `preparingForAi` true and the button disabled until
the page is left; there is no Cancel as in the dialog, and no unmount cleanup. The proxy has
a 15 s per-request timeout, so it needs a hung backend rather than a slow one. Separately, the
copy is not tied to the page: observed (run and deleted) that unmounting `ReadingSection` while the
prompt request is pending still calls `copyText` and shows "Copied for AI" after the viewer has
left, and a file or drive change mid-flight copies the old file's document under a toast that does
not say which. No state update warning, no data written.

Severity view: very low.

## Perspectives checked with no finding

- **Access boundary.** Route matching in `addon_proxy._match_route` takes the first route whose
  path matches; no earlier `{param}` route can swallow `/analysis-prompt` or
  `/admin/analysis-prompt`. `GET /analysis-prompt` is `scope=drive`, not `drive_optional`: no
  `X-Lit-Drive` -> 400, a drive the viewer cannot access -> 403. The three admin methods share one
  manifest entry with `pre_check: {type: admin}`; the existing parity test checks that entry
  exists, carries the admin pre-check, and that its `methods` cover the router (mutations P11
  killed; P10 see list). A non-admin cannot reach `PUT`/`DELETE` through the proxy.
- **PUT validation.** Blank/whitespace, over 20 000, NUL and the exact cap are table-tested;
  whitespace is kept byte for byte (mutation P4 killed). The textarea's `maxLength` counts UTF-16
  units, the server counts code points, so the client is the stricter of the two.
- **Override file.** Written through `*.tmp` + `os.replace`; unknown `schema_version`, wrong type,
  blank and malformed JSON all fall back to the default (tested). The one gap is finding 5.
- **No restart-pending.** None of the three admin handlers calls `_notify_core_restart_pending`;
  a test monkeypatches it to raise and exercises PUT and DELETE.
- **Injection.** Ran adversarial comment texts through `formatCommentsSection` (run and deleted): CR,
  U+2028, U+0085, VT, FF inside the text; `[AUTHOR]` at a line start; a heading and a rule inside the
  text; `[AUTHOR]` inside the author name and in reply authors. No output line starts with
  `- [AUTHOR]` except genuine ones; every text line is `>`-quoted and the tag is rewritten to
  `(AUTHOR)`. (FS/GS/RS, U+001C-001E, are not treated as line breaks by the code; JavaScript and
  Markdown do not treat them as such either, and the tag is neutralised anyway.) The prompt is the
  first thing in the clipboard text and nothing user-supplied is placed before it; the video block
  follows a `---` rule. Transcript paragraphs are whitespace-collapsed, so a subtitle cue cannot
  contain a newline; a chapter title is not collapsed (`readableTranscript.ts` `sectionBlocks`),
  which is `[pre-existing]` and shared with Copy and the batch export.
- **Sort.** `[...comments].sort` with `Number(b.is_pinned) - Number(a.is_pinned) || (b.like_count ?? -1) - (a.like_count ?? -1)`:
  stable (Node >= 11), `null` after `0`, and an `undefined` `is_pinned` yields `NaN`, which `||`
  skips, so it degrades to the likes order. Replies untouched. In-place sorting would be
  harmless because `getLoftComments` returns a fresh object per call (M23 is an equivalent mutant).
- **Core / addon coupling.** Core names no addon: `markdown-export-sections` is a slot id, and the
  only strings shared with intelligence are the provider ids, held in `exportIds.ts` inside the
  addon. Intelligence imports nothing from media_import; it reads only the `ExportSectionProvider`
  contract and labels. The one soft coupling worth stating: `missing` is built from provider
  `label`s, which are translated UI strings, so the toast says what each provider is called, not
  what it is.
- **Extra `file` prop on every slot.** No slot component found that spreads props onto a DOM element
  or that has its own `file` prop (see (a) 5). The object is rebuilt on every render already.
- **i18n.** en/ja key sets identical; placeholders match.
- **Touch / a11y of the button.** Same class string as **Copy** (`pointer-coarse:min-h-11`), icon from
  `lucide-react`, wrapper wraps (`flex-wrap`). The disabled-without-explanation point is in finding 1.
- **`MarkdownExportContainer` refactor.** Dialog timer and readiness unchanged; container tests pass.
- **Writes.** The button writes no row, no file, no tag, no history: every request it makes is a GET.
  No comment fetch is queued: `CommentsExportSection` reads stored comments
  (`getLoftComments`) and never calls refresh/load.

## Mutations tried

`want` is declared before the run. "KILLED" = at least one test failed.

Core, `markdownExport/document.ts` (tests: `src/components/markdownExport`)

| id | mutation | want | result |
|---|---|---|---|
| M1 | drop the `hasSection` null guard in `assembleVideoMarkdown` | kill | KILLED (4) |
| M2 | no preambles in `assembleVideoMarkdown` | kill | KILLED (2) |
| M3 | `preamblesFor` ignores whether a section was produced | kill | KILLED (8) |
| M4 | do not `trim()` section markdown | live | KILLED (2) -- my expectation was wrong; the trim is held |
| M5 | do not `oneLine` the single-video title | kill | KILLED (1) |
| M6 | do not `oneLine` the provider label | kill | LIVE -- labels are fixed translated strings; the `oneLine` on them predates the change |
| M6b | batch block also writes preambles (twice) | kill | KILLED (1) |
| M6c | batch block gets preambles | kill | KILLED (1) |
| M6d | single block writes preambles twice | kill | KILLED (1) |

`ReadingSection.tsx` (tests: `ReadingSection.test.tsx`, 40)

| id | mutation | want | result |
|---|---|---|---|
| M7 | allow a copy without a transcript section | kill | KILLED (2) |
| M8 | drop `video === null` (equivalent when the transcript is a section) | live | LIVE, as meant |
| M9 | video before prompt | kill | KILLED |
| M10 | no `---` separator | kill | KILLED |
| M11 | name `not-applicable` as missing | kill | KILLED |
| M11b | name only `failed` as missing | kill | KILLED |
| M12 | button not disabled until ready | kill | KILLED |
| M13 | not disabled while preparing | kill | **LIVE** (finding 3) |
| M14 | do not mount the export slot | kill | **LIVE** (finding 3) |
| M15 | fetch the prompt for another drive | kill | KILLED |
| M16 | invert the clipboard-result branch | kill | KILLED (5) |
| M17 | missing-notice uses the plain message | kill | KILLED (2) |
| M18 | never clear `preparingForAi` | live | LIVE (finding 3: should be killed) |
| M19 | providers = [] | kill | KILLED (5) |

media_import `commentsMarkdown.ts` (tests: `commentsMarkdown.test.ts`, `CommentsExportSection.test.tsx`, 48)

| id | mutation | want | result |
|---|---|---|---|
| M20 | no pinned term | kill | KILLED (5) |
| M20b | no likes term | kill | KILLED |
| M21 | `null` likes as 0 | kill | KILLED |
| M22 | ascending likes | kill | KILLED (3) |
| M23 | sort in place | live | LIVE (equivalent: fresh object per fetch) |
| M24 | `formatCommentsMarkdown` sorts | kill | **LIVE** (finding 4) |
| M25 | `body()` sorts, so both sort | kill | **LIVE** (finding 4) |

Admin section (tests: `AdminAnalysisPromptSettingsSection.test.tsx`, 6)

| id | mutation | want | result |
|---|---|---|---|
| A1 | PUT sends trimmed text | kill | KILLED |
| A2 | Save enabled for blank text | kill | KILLED |
| A3 | Reset always shown | kill | KILLED (2) |
| A4 | no `maxLength` | kill | **LIVE** (finding 3) |
| A5 | no `ApplyMarker` | kill | **LIVE** (finding 3) |
| A6 | no reload after save | live | KILLED (2) -- reload is held |

Intelligence backend (tests: `test_analysis_prompt.py`, `test_admin_manifest_parity.py`, 26, in the runtime image)

| id | mutation | want | result |
|---|---|---|---|
| P1 | NUL check removed | kill | KILLED |
| P2 | cap `>` -> `>=` | kill | KILLED |
| P3 | blank check on unstripped text | kill | KILLED (2) |
| P4 | strip the saved prompt | kill | KILLED (2) |
| P5 | accept a blank override file | kill | KILLED |
| P6 | PUT skips `validate` | kill | KILLED (5) |
| P7 | admin view `is_default` always false | kill | KILLED |
| P8 | viewer route always returns the default | kill | KILLED (2) |
| P9 | PUT writes to another directory | kill | KILLED (3) |
| P10 | manifest: admin entry loses `pre_check` | kill | KILLED (parity test) |
| P11 | manifest: admin entry loses PUT and DELETE | kill | KILLED (parity test) |
| P12 | manifest: `/analysis-prompt` entry removed | kill | **LIVE** (finding 3) |
| P13 | DELETE reports `removed: true` always | kill | KILLED |
| P14 | viewer router not included in `main.py` | kill | **LIVE** (finding 3) |

TOTAL: 10 findings
