# Add to Litloft for Chrome

Add the current YouTube video to an existing Litloft folder from the **Add to Litloft** button on YouTube or the extension's toolbar popup.

## Install

1. Open `chrome://extensions` and enable **Developer mode**.
2. Choose **Load unpacked** and select this `extensions/chrome` directory.
3. Open the extension's **Settings**, enter your Litloft address, such as `http://localhost:3001`, and choose **Save and allow access**.
4. Choose **Check connection**. Unlock protected drives in Litloft using the same Chrome profile, then refresh the extension.
5. Pin the extension to Chrome's toolbar if you want quick access to the popup.

Litloft must be reachable from Chrome and have the `media_import` addon installed. Use the frontend address you normally open; include its port and omit any path. The server permission is optional and requested when you save the address.

## Use

Open a YouTube video, Short or saved live video. Choose **Add to Litloft**, select a drive if needed, then select the destination folder. Selecting a folder starts the import immediately; **+** only opens its subfolders. You can also choose the drive root or the last successful destination.

The extension invokes Litloft's existing URL import endpoint. Litloft creates the `.loft` entry and continues its usual metadata, thumbnail, caption and comment processing. Automatic speech-to-text uses the extension's selected mode and requires the intelligence addon. This setting is saved separately from the Litloft website's setting.

You can close the panel while an import is running. Reopening it shows the operation's result. If the response is unconfirmed, check the destination folder before trying again: the server may already have added the video. **Add another copy** deliberately starts another import, following Litloft's usual filename suffix behavior.

If a YouTube layout does not show the page button, use the toolbar popup. Channels and playlists without a current video are not imported. Watch pages with a playlist import only the current video.

The extension uses the current browser session without storing passwords or copying cookies. If protected drives remain unavailable after unlocking, check the server permission and Chrome's third-party cookie settings. After switching servers, choose a new destination.

## Development

No build step or runtime dependency is required. Run the unit tests with Node.js 22 or newer:

```sh
cd extensions/chrome
node --test
```

The browser smoke script uses an existing Playwright installation and its Chromium browser, with a temporary browser profile and a local API fixture. It does not add videos to your Litloft library:

```powershell
$env:PLAYWRIGHT_MODULE = 'D:\Litloft\frontend\node_modules\@playwright\test'
node scripts/browser-smoke.mjs
```

Set `SMOKE_OUTPUT` to preserve screenshots outside the temporary profile. The fixture checks the browser integration and cookie behavior; backend processing is covered separately by the existing media_import tests. Manifest compatibility starts at Chrome 114; browser verification must name the version actually used.
