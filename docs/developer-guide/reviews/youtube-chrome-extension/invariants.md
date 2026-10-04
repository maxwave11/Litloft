# YouTube Chrome extension: R-0

Status: approved with the spec by the user on 2026-10-03.

## Touch points

New extensions/chrome client; existing /api/auth/status, /api/drives, /api/drives/{drive}/folders, addon-policies, /api/addons/status and /api/addons/media_import/link. Existing media_import creation and enqueue_fetch, File registration and metadata/captions/comments/STT workers are consumed without modification. No new tables, endpoints or WS events. Design rules: access control, drive boundary, viewer credentials, addon policy and no core-to-addon dependencies.

## Invariants

- Closed drives are absent from destination lists; stale inaccessible destinations never bypass server authorization.
- The POST body drive and percent-encoded X-Lit-Drive name the same accessible drive; folder paths remain relative to it.
- Import uses the public media_import link handler and its existing processing queue; extension writes no files or database rows directly.
- Extension requests preserve the browser's access and viewer cookies without storing or exposing them to YouTube.
- Content messages cannot select a different Litloft host, arbitrary API endpoint or video outside the sender's current YouTube tab.
- Expanding a folder sends no import; a selected destination starts one active request, and an ambiguous response never triggers an automatic retry.
- Changing video, server or drive prevents stale asynchronous responses from submitting to or replacing the new selection.
- UI success requires a valid creation response; it does not claim captions, comments or STT have completed.

## Supervisor revision after round 1

The reachable BFCache defect from finding 3 is accepted for correction. On restoring a supported YouTube document with an available action anchor through browser Back/Forward, exactly one page button becomes available again and remains usable after subsequent SPA navigation.
