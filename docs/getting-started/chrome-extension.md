# Chrome extension

The Chrome extension lets you add the current YouTube video to Litloft without copying its URL.

1. Open `chrome://extensions` and enable **Developer mode**.
2. Select **Load unpacked** and choose `extensions/chrome` in your Litloft checkout.
3. Open the extension's **Settings** and enter the Litloft address you normally use, including its port, for example `http://localhost:3001`. Enter only the server address, without a path.
4. Choose **Save and allow access**, then **Check connection**.
5. For protected drives, open Litloft and unlock them in the same Chrome profile. Refresh the extension's folder list afterward.

The server needs the [media_import addon](../addons/media-import.md). A drive whose URL import action is disabled is unavailable in the extension. You can pin **Add to Litloft** to Chrome's toolbar for convenient access.

When updating the extension files, choose **Reload** on its card in `chrome://extensions` and refresh any already-open YouTube tabs.

See [Adding YouTube videos](../user-guide/chrome-extension.md) for folder selection, speech-to-text and import results.
