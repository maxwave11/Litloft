# Chrome extension browser and backend verification

Date: 2026-10-04. All browser runs used disposable profiles and all imports used disposable fixture drives. No user library or browser profile was modified.

## Verified

- Installed Chrome 153.0.8010.54: unpacked MV3 worker, options, configured-origin access, page button and common popup controller. Installed Edge 154.0.4258.48 also passed the integration fixture.
- Browser fetch preserved the real backend's HttpOnly, SameSite=Strict access_token cookie and the separate lit_viewer cookie. A protected drive was absent before normal unlock and available afterward.
- Root, empty and nested Unicode folders; expansion made zero import requests. Nested selection sent the canonical URL, matching Unicode body/header drive and existing STT mode, once.
- The production FastAPI media_import link handler registered the file and created .loft, thumbnail, caption VTT and metadata/comment results through its existing worker. A baseline request using the website's payload followed the same handler and completed the same processing. Only external YouTube responses were replaced with fixtures.
- HTTP 500 produced unknown, with no automatic retry. Native operation tests cover concurrent selections, worker recreation, persistence failure and explicit repeat.
- Watch SPA changes retain one button, channel navigation removes it. A real YouTube watch page displayed the button and its popover above recommendations.
- BFCache regression was reproduced before the fix: the document token and persisted pageshow survived browser Back, but the button disappeared. After the fix the same cached document restored exactly one button.

Screenshots are under chrome-screenshots and browser-round-* beside this record. The browser harness emits its actual version and checks; source is extensions/chrome/scripts/browser-smoke.mjs. The isolated Docker backend source is integration_backend.py beside this record.

## Limits

- The native optional-host permission prompt cannot be driven by this headless runner. Successful automated runs pregranted only the loopback fixture host in a temporary manifest copy. Grant/deny in the user's Chrome profile remains a manual installation check.
- The popup controller was exercised in a normal extension tab while the YouTube tab stayed active. Native toolbar-popup opening/closing is a manual check; attempts to attach the headless Chrome native action target did not provide a usable automation surface.
- Chrome 114 is a manifest compatibility floor, not a tested browser version. HTTPS LAN deployments, all YouTube layout variants, Japanese browser UI and mobile layouts were not manually verified.
- No intelligence addon or speech model was available in the disposable test backend. STT payload and the existing handler path were checked; actual transcription was not run.
- Existing media_import tests: 109 passed in Docker, with one existing Starlette deprecation warning. No backend or addon source, addon gitlink or Docker Compose change was required.
