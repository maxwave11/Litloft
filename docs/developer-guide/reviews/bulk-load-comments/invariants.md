Touch points: `SelectionBar` (new addon group, `BulkAction.disabled`), new `frontend/src/lib/selectionActions.ts`, new slot `selection-bar-actions`; media_import `ADDON_META.slots`, `slots.ts`, new `LoadCommentsAction.tsx`, new endpoint `POST /link/comments/load-missing` calling `loft_manager.enqueue_comments`, one `files.updated` emit; `docs/ADDON-DEVELOPMENT.md`, `docs/addons/media-import.md`, `docs/reference/api.md`, `docs/user-guide/`.

Invariants:
- Pressing the button never changes a video that already has a stored comment set: its comments, `comments_fetched_at`, `comments_total` and `comments_error_kind` are untouched, and it is not queued.
- Pressing it queues exactly the selected, active, YouTube `.loft` files of the current drive that have no stored comment set and are not already queued — no more, no fewer.
- No file outside the drive in `X-Lit-Drive` is queued, and the response for an id on another drive is the same as for an id that does not exist.
- A file in the trash or missing is never queued.
- Nothing is requested before the button is pressed; a press sends one request per 1000 selected `.loft` files and none when the selection holds no `.loft`.
- After a press that queued N > 0 videos, one `files.updated` is emitted naming exactly those N; after a press that queued none, nothing is emitted.
- After a press the button cannot send another request until the selection changes, except after a failed request.
- With no addon offering an action, the selection bar's actions, their order and the narrow-screen overflow are exactly as before.
- An addon action never stays on the bar on a narrow screen, is never drawn as danger, and is never shown in the trash view.
- Core code names no addon and no action.

Revision after round 1, 2026-10-04, on the user's decision after seeing the bar in the app. F1 (width) proposed the first; the second follows from putting the result in a status line.
Invariants added:
- Every action on the bar is fully visible at every viewport width from 640px up: the row never scrolls or clips, with or without an addon action, in English and Japanese.
- A button's name is drawn only where the card is wide enough for all of them; where it is not, each button has the same name as its tooltip.
- An addon action's label does not change with its result; the result is in the status line above the actions, which is absent while no action sets one.
