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
- **Refresh metadata**, which fetches the metadata and captions again;
- **Generate captions with speech-to-text**, which downloads the audio for the intelligence addon to transcribe;
- the caption status, for example **YouTube has no captions for this video**. When a download failed, click the status to try again.

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
- Some videos cannot be embedded outside the provider's site.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| Import fails for a URL that used to work | yt-dlp is out of date. Rebuild the backend image (`docker compose up -d --build`). |
| No captions | The video has none, or they could not be downloaded. The caption status under the player says which. |
| **Embedded playback is disabled for this video** | The owner does not allow embedding. Use **Watch on YouTube**. |
| **Refresh metadata** changes nothing | The fetch failed. Check `docker compose logs backend`. |
| A subscription shows **Backoff active** | Listing the channel's videos is failing. Check `docker compose logs backend`; if the provider is down, wait. |

## See also

- [yt-dlp](https://github.com/yt-dlp/yt-dlp) for supported sites.
- [Addon overview](overview.md) for per-drive policy.

## Fetching a whole channel

Open a channel's detail panel in **Manage** and select **Fetch all channel**. The background worker imports public uploads into `.loft` entries, including Shorts and saved livestreams, with available metadata and captions. It does not download video files. Each batch imports at most 15 new entries, spaces new video requests by at least eight seconds, waits 2–3 minutes after finishing, and continues. You can close the page; progress and the next attempt survive a backend restart.

**Stop fetching** stops before the next video; a request already in progress may finish. Pausing the subscription pauses the task too. Existing imports are kept. The panel shows completion, a pause, or an error, and the next batch time while waiting. Manual **Fetch more** and **Sync now** are unavailable while the task is active.

An upstream failure or caption rate limit stops the task and applies a one-hour cooldown. During that pause, **Fetch more**, **Sync now**, and **Fetch all channel** cannot start; changing the subscription's cooldown setting does not clear the pause. Review any failed items and retry them separately; use **Fetch all channel** again after the cooldown to continue discovering history. Private, removed, or otherwise inaccessible videos cannot be imported. Conservative pauses reduce request pressure but cannot guarantee that the provider will never restrict access. Listing reuses the existing increasing-prefix approach, so older listing pages may be requested again, with a two-second delay between extraction requests.

API: `POST /api/addons/media_import/subscriptions/{id}/fetch-all` starts the task; `DELETE` at the same path stops it. Both require the owning `X-Lit-Drive` and return the subscription, including `fetch_all_status` (`idle`, `active`, `completed`, `cancelled`, `error`) and nullable `fetch_all_next_at` (the next batch time when active, or the error pause end when errored). Starting is idempotent while active; a paused source, pending sync, or unexpired cooldown returns 409. Non-channel sources return 400 and inaccessible subscriptions return 404.
