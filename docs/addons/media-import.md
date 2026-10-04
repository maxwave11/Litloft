# media_import addon

The `media_import` addon turns a video URL into a small `.loft` file in your library. The video itself is not downloaded: a `.loft` plays through the provider's embedded player. The addon can also follow YouTube channels and playlists and import their new videos.

It runs inside the backend, is scoped to a drive, and appears in the sidebar as **YouTube & Feeds**, under **Sources**.

## What it provides

- **Import from URL** turns a video URL into a `.loft` file in the folder you choose.
- yt-dlp fetches the title, channel, description, publication date, duration, thumbnail and chapters.
- When the video has captions, one `.vtt` file in the video's language is saved next to the `.loft`.
- With the [intelligence addon](intelligence.md), a video without captions can be transcribed with speech-to-text.
- YouTube and Vimeo play in embedded players inside Litloft. Other sites show a link card.
- You can subscribe to a YouTube channel or playlist, and its new videos are imported on a schedule.
- A YouTube video's most-liked comments are saved too, with the video author's own comments and replies marked, and can be copied for an AI assistant. See [YouTube comments](#youtube-comments).

## Installation

media_import is built into the backend image whenever `addons/media_import/` is checked out. Rebuild after checking it out:

```bash
docker compose up -d --build
```

The image build installs yt-dlp from the addon's `requirements.txt`. To stop the addon loading, leave the submodule uninitialised; see [Enabling and disabling addons](overview.md#enabling-and-disabling-addons).

## Per-drive policy

In `drives.json`, or in **Addon policy** at `/admin/settings`:

```json
{
  "name": "YouTube",
  "addons": {
    "media_import": { "url_import": true }
  }
}
```

| Feature | Default | Effect when `false` |
|---|---|---|
| `url_import` | `true` | Hides **Import from URL** in the **Add** menu for this drive. The **YouTube & Feeds** page and the API still import. |

## Importing a video

There are two ways in:

- **Add** menu: on Home or in a Library folder, open **Add** and choose **Import from URL**. The dialog starts at the current folder (the drive root on Home) and imports one video. If the import fails, the URL and folder stay filled in so you can try again. A channel, playlist or feed URL is not imported here; the dialog offers **Open Media Import**, which opens the **YouTube & Feeds** page.
- **YouTube & Feeds** page: open **Manage** and paste the URL into **Add a source**. For a single video you can also choose **Speech-to-text**: **Use captions**, **If no captions**, or **Always**. The choice is remembered.

The `.loft` file is created at once, named after the video title. If a file with that name exists, a number is added, for example `Title (1).loft`. The metadata, thumbnail and captions are then fetched in the background, so they appear a moment later.

Caption downloads that failed for a temporary reason, such as rate limiting, are tried again when the backend starts.

## The `.loft` file

A `.loft` file is JSON and holds only the provider and the URL:

```json
{
  "provider": "youtube",
  "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
}
```

The fetched metadata is stored in Litloft's database, not in the file. The captions are a separate file with the same name and a `.vtt` extension, in the same folder.

The provider is `youtube`, `vimeo` or `soundcloud` when the URL matches one of those sites, and `generic` otherwise.

## Watching

| Provider | Player |
|---|---|
| YouTube | Embedded YouTube player. **Player** switches between the **Litloft** and **YouTube** controls. |
| Vimeo | Embedded Vimeo player. |
| SoundCloud and others | A link card that opens the original page. |

Your position in a YouTube video is saved like a local video's, so it appears under **Continue Watching** on Home. The Vimeo player does not report its position.

If the owner has disabled embedding, the page says **Embedded playback is disabled for this video** and offers **Watch on YouTube**.

In the [iOS app](../user-guide/ios-app.md), the YouTube player's settings have **Open in the iOS player**, which plays the video in iOS's own full-screen player. From there the video can continue in picture-in-picture when you leave the app. A browser does not show this button.

## Below the player

The addon adds a panel under the player with:

- the channel name, publication date and the start of the description;
- a link to the original page, **Watch on YouTube** for YouTube and **Open original** for other sites, which opens in a new tab;
- the caption status, for example **YouTube has no captions for this video**. When a download failed, click the status to try again.

Two actions for a `.loft` are in the file's menus:

- **Refresh metadata**, in the `...` menu, fetches the metadata and captions again.
- **Generate captions with speech-to-text**, in the **AI** menu, downloads the audio for the intelligence addon to transcribe. The AI menu is part of the intelligence addon.

Both show their result as a notification.

## YouTube comments

The comments are a **Comments** tab in the row of tabs at the end of the page of a YouTube `.loft`, after the summaries and before **Add summary**. Once they are loaded the tab reads **Comments (N)**. The row belongs to the [intelligence addon](intelligence.md): on a drive where it is off, the comments show as a block of their own with a **YouTube comments** heading, below the page.

- **What is saved.** The video's top comments, in YouTube's "top" order: at most 300, each with its author, like count, and whether it is pinned or liked by the video's author, and up to 5 replies under each. A video with 12,000 comments keeps 300 of them. The tab shows how many of the video's comments it holds and when they were loaded.
- **When.** Importing a single video, with **Import from URL** or the **Add a source** form, loads its comments in the background once the metadata is in. Videos that arrive through a subscription, **Fetch more**, **Sync now** or **Fetch all channel** do not; their tab offers **Load comments**, with a note that loading can take a few minutes and that you can leave the page. **Refresh** replaces the saved comments with a new set. A failed refresh keeps the previous set, and the tab says why; for a rate limit or an unknown failure the message has a **Try again** link.
- **Several videos at once.** Select videos in a file list and press **Load comments** in the selection bar (on a narrow screen it is under the `…` button). It queues every selected YouTube `.loft` that has no saved comments: videos never loaded and videos whose first load failed. Videos with saved comments, videos already queued and files that are not YouTube `.loft` files are skipped, so the button never replaces a saved set. The bar shows **Loading started (N)** with the number queued, or **Nothing to load**, in a line above the actions; **Couldn't start** means the request failed and the button can be pressed again. The button stays disabled until the selection changes. On a screen too narrow for every button name, the buttons are icons and the name is the tooltip. The cards' comments icons turn yellow at once and green or red as each video finishes. The queue is sequential, so many videos take a while, and it is kept in memory: a backend restart empties it, and the unfinished videos show gray again.
- **The video's author.** The author's own comments and replies carry an **Author** badge and a coloured rule on the left; everyone else's have neither. A comment the author liked shows a small heart and stays a viewer's comment. The author is recognised by the channel, never by the name shown, because anyone can pick a name.
- **Long lists.** The first 20 comments are shown; **Show all** opens the rest. Replies are folded under **N replies**.
- **Copy** puts all the comments on the clipboard as Markdown, ready to paste into an AI assistant next to the transcript. Every comment and reply starts with `[AUTHOR]` (the video's own channel) or `[VIEWER]` (anyone else), likes are exact numbers, and a header says how many comments and replies the author wrote:

  ```markdown
  # YouTube comments: Video title
  Top 2 of 12345, fetched 2026-10-03. The video author wrote 1 of the comments and replies below.
  [AUTHOR] = the video's own channel. [VIEWER] = anyone else.

  - [VIEWER] @someone · 1200 likes · hearted by author
    > At 12:40 he confuses correlation with causation
    - [AUTHOR] @channel · 340 likes
      > Fair, the study says the opposite
  ```

  Each line of a comment's own text is quoted with `>`, and an `[AUTHOR]` or `[VIEWER]` typed inside a comment is changed to `(AUTHOR)` or `(VIEWER)`, so a comment cannot pass for the author's.

The comments are not indexed: search and Ask do not see them, and the intelligence addon does not read them. Copy them into an assistant yourself.

**Export as Markdown**, the selection bar's action for several videos, adds a **YouTube comments** section for each `.loft` whose comments are loaded: the line saying how many were loaded and when, then the same list as **Copy**, with the same `[AUTHOR]` and `[VIEWER]` tags and a key to them under the document title. It only uses what is already saved and never loads comments itself; a `.loft` without saved comments is named in the warning shown before the document.

Loading is slow on purpose. YouTube serves the replies of each thread in a request of its own, so one video can take a couple of hundred requests, spaced a second apart, and a fetch can last minutes. `MEDIA_IMPORT_COMMENTS_MAX` sets the number of top-level comments kept; see [environment variables](../reference/env-variables.md#media_import_comments_max).

API, both drive-scoped (`X-Lit-Drive`):

- `GET /api/addons/media_import/link/{file_id}/comments` returns `supported`, `state` (`none`, `queued`, `ready` or `error`), `error_kind`, `fetched_at`, `total` and the comments, each with its replies. After a failed refresh `state` is `error` and the previous comments are still returned. `supported` is `false` for a `.loft` that is not YouTube's.
- `POST /api/addons/media_import/link/{file_id}/comments/refresh` queues a fetch and answers `202` with `{ "status": "queued" }` or `{ "status": "already_queued" }`. A `.loft` that is not YouTube's, or has no metadata yet, is `400`.

Both answer `404` for a drive the caller cannot see, and for a file that is missing or in the trash. `GET` also answers `404` for a `.loft` that has no metadata yet.

- `POST /api/addons/media_import/link/comments/load-missing` takes `{ "file_ids": [...] }`, 1 to 1000 IDs, and answers `202` with `{ "queued": N, "skipped": M }`. It queues, in the order given, the active YouTube `.loft` files of the drive that have no saved comments and are not already queued. Everything else counts as skipped, without saying why: a file on another drive, a missing or trashed file and an unknown ID look the same. A drive the caller cannot see answers `404`.

## Search and Ask

Core search finds a `.loft` by its filename, which is the video title. With the [intelligence addon](intelligence.md), the captions and speech-to-text transcripts are indexed too, so semantic search and Ask can find a video by what is said in it.

## YouTube & Feeds

The page is at `/drive/{drive}/addons/media_import` and has two views.

**Manage** has the **Add a source** form, your subscriptions, and **Recent activity**. In the form, a single video URL becomes a `.loft`, and a YouTube channel or playlist URL becomes a subscription.

**Watch** shows videos from subscriptions you chose to show, in two lanes:

- **Regular sources**: subscriptions set to **Regular source**. At most two of the newest videos from each, and at most 12 in total. This lane has no **Show more**.
- **Recent videos**: subscriptions set to **Show in recent videos**, newest first, 12 at a time with **Show more**.

Each subscription has a **Show in Watch** setting, chosen when you add it and changeable in its details in Manage:

- **Library only**: videos are imported and searchable, including by Ask, but are not shown in Watch.
- **Show in recent videos**
- **Regular source**

A video that two subscriptions share appears once. A card shows how far you have watched, and **Watched** when you have finished. It offers **Add to collection** and **Open the source page**.

The page opens on Watch when any subscription on the drive is set to something other than **Library only**, and on Manage otherwise. Videos you are part-way through are listed on Home under **Continue Watching**, not here.

## Subscriptions

Paste a YouTube channel or playlist URL into **Add a source** and choose **Subscribe**. Under **Advanced** you can set how many existing videos to import first (**Backfill (initial import count)**).

Litloft checks each subscription for new videos about once an hour. The interval is the subscription's **Cooldown (min)**, 60 by default. New videos are saved as `.loft` files in the subscription's destination folder.

A subscription's details show its schedule, destination and imported items, with:

- **Pause** / **Resume**, and **Sync now** to check immediately;
- **Fetch more** to import up to the selected number of uploads not yet in the subscription, including Shorts and saved livestreams for YouTube channels. The request runs in the background;
- **Retry** and **Ignore** for failed items;
- **Resolve…** for an item whose filename is already taken;
- **Delete subscription**, which stops tracking new videos. Files already imported stay.

## Limits

- The addon never saves the video file. Only the speech-to-text audio is downloaded, temporarily, for transcription.
- yt-dlp reads public web pages, and the provider may throttle many imports made in a short time. Throttled caption downloads are retried later.
- Encrypted (DRM) streams are not supported.
- Only the top comments of a YouTube video are saved, not all of them, and not for Vimeo or other sites.
- Some videos cannot be embedded outside the provider's site.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| Import fails for a URL that used to work | yt-dlp is out of date. Rebuild the backend image (`docker compose up -d --build`). |
| No captions | The video has none, or they could not be downloaded. The caption status under the player says which. |
| **Embedded playback is disabled for this video** | The owner does not allow embedding. Use **Watch on YouTube**. |
| **Refresh metadata** changes nothing | The fetch failed. Check `docker compose logs backend`. |
| The Comments tab says **YouTube is limiting requests right now** | YouTube refused the request. Wait, then press **Refresh**. |
| **Comments are turned off or unavailable for this video** | The author turned them off, or YouTube shows none for this viewer. |
| **This video is unavailable, so its comments cannot be read** | The video is private or removed. |
| **The comments could not be loaded** | Another failure. Check `docker compose logs backend`, then press **Refresh**. |
| A subscription shows **Backoff active** | Listing the channel's videos is failing. Check `docker compose logs backend`; if the provider is down, wait. |

## Video card indicators

Video cards show the saved channel name and a comments icon alongside the transcript and summary indicators. The icons have no background. Green comments means a successful fetch, including a snapshot with zero comments; faded gray means not fetched, yellow fading means queued or fetching, and red means the first fetch failed. An existing successful snapshot remains green after a failed refresh. Sources without comment support omit that icon. Channel names truncate in narrow cards. View and video-like counts are not currently stored or displayed.

## See also

- [yt-dlp](https://github.com/yt-dlp/yt-dlp) for supported sites.
- [Addon overview](overview.md) for per-drive policy.

## Fetching a whole channel

Open a channel's detail panel in **Manage** and select **Fetch all channel**. The background worker imports public uploads into `.loft` entries, including Shorts and saved livestreams, with available metadata and captions. It does not download video files. Each batch imports at most 15 new entries, spaces new video requests by at least eight seconds, waits 2–3 minutes after finishing, and continues. You can close the page; progress and the next attempt survive a backend restart.

**Stop fetching** stops before the next video; a request already in progress may finish. Pausing the subscription pauses the task too. Existing imports are kept. The panel shows completion, a pause, or an error, and the next batch time while waiting. Manual **Fetch more** and **Sync now** are unavailable while the task is active.

An upstream failure or caption rate limit stops the task and applies a one-hour cooldown. During that pause, **Fetch more**, **Sync now**, and **Fetch all channel** cannot start; changing the subscription's cooldown setting does not clear the pause. Review any failed items and retry them separately; use **Fetch all channel** again after the cooldown to continue discovering history. Private, removed, or otherwise inaccessible videos cannot be imported. Conservative pauses reduce request pressure but cannot guarantee that the provider will never restrict access. Listing reuses the existing increasing-prefix approach, so older listing pages may be requested again, with a two-second delay between extraction requests.

API: `POST /api/addons/media_import/subscriptions/{id}/fetch-all` starts the task; `DELETE` at the same path stops it. Both require the owning `X-Lit-Drive` and return the subscription, including `fetch_all_status` (`idle`, `active`, `completed`, `cancelled`, `error`) and nullable `fetch_all_next_at` (the next batch time when active, or the error pause end when errored). Starting is idempotent while active; a paused source, pending sync, or unexpired cooldown returns 409. Non-channel sources return 400 and inaccessible subscriptions return 404.
