Touch points: `loft_metadata` (new columns), new `loft_comments` table, `LoftManager` queues and the URL import path, media_import `router.py`, the `files.updated` emit, the `file-detail-reading` slot and media_import `manifest.json`, `docs/addons/media-import.md`, `docs/reference/env-variables.md`, `docs/reference/configuration.md`, `docs/user-guide/viewers-and-players.md`.

Invariants:
- A comment fetch that fails or hangs does not stop the same import from creating the `.loft`, its metadata, thumbnail and captions.
- Subscription sync and Fetch all channel make no comment request.
- A failed refresh leaves the file's previous `loft_comments` rows unchanged.
- `GET` and `refresh` for a file on another, locked or inaccessible drive return 404, and never return another drive's comments.
- The core `comments` table is neither read nor written by this feature.
- Purging a file deletes its `loft_comments` rows; moving it to trash does not.
- A stored snapshot holds at most `MEDIA_IMPORT_COMMENTS_MAX` top-level comments and at most 5 replies per thread.
- Comment text reaches the DOM only as text, never as HTML.
- A comment or reply written by the video's own channel is tagged `[AUTHOR]` in the copy and badged in the page; every other comment, including one hearted by the author or whose display name matches the channel name, is `[VIEWER]` and unbadged.
- No comment text can make a line of the copy read as written by the video's author: a comment's lines are quoted and the role tags inside them are neutralised, so `[AUTHOR]` appears only on lines the stored author flag produced.

Revision 2026-10-03, by the user's approval of the tab design, before the first review round.
Touch points added: `frontend/src/lib/readingTabs.ts` (new core registry), the intelligence addon's `ReadingSection`, media_import's `YouTubeComments/` as an offerer, and `docs/ADDON-DEVELOPMENT.md`.
Invariants added:
- A file the comments do not apply to (not a `.loft`, or a provider without comments) gets no Comments tab and no request for its comments.
- An offered tab never changes which tab the page opens on, and **Add summary** stays last.
- Where nothing draws the reading row, the comments are still reachable, as a block of their own.
- An offered tab's panel stays mounted while another tab is open, and the tab goes when its file or its offerer goes.
- Tabs offered for one file never appear on another file's page.

Revision after round 1, 2026-10-03, on the user's decision to fix findings A and B. The reviewer proposed the first two as missing invariants; the third is the shape of finding 1.
Invariants added:
- A failure of the store step, not only of the fetch, is recorded as an error and an event is sent, so the page leaves "loading" with a message.
- A page that was open before a fetch started learns of it, and shows it, without a reload: while it has nothing, has not loaded, or offers Load comments.
- A re-read that gets no answer leaves the page as it was, the tab included, and the page keeps asking while a fetch is pending.
