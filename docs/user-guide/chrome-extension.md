# Adding YouTube videos from Chrome

After [installing the extension](../getting-started/chrome-extension.md), open a YouTube video and choose **Add to Litloft** beside the video's actions. The same action is available in the extension's Chrome toolbar popup, including when YouTube's layout does not show the page button.

Choose a drive if more than one is accessible, then select a folder to add the video immediately. **+** expands a folder without adding anything. **Drive root** saves at the top of the drive. **Last used** offers your last successful destination after its access is checked again.

The extension imports the current video on watch, Shorts and live pages. A watch URL containing a playlist adds only that video. Channel and playlist pages without a current video are not destinations for this action.

An **Added** result means the entry exists and Litloft continues its usual metadata, thumbnail, caption and comment processing. You can close the panel while the request runs and reopen it to see the result. **Open added video** takes you to the entry in Litloft.

If the server response was not confirmed, use **Check folder in Litloft** before trying again. The video may already have been added. **Add another copy** intentionally repeats a successful import and uses Litloft's usual filename suffix.

In extension **Settings**, **Speech-to-text** has the same three choices as Litloft: **Use captions**, **If no captions**, and **Always**. This setting is remembered separately from the website; the default is **Use captions**. Automatic transcription requires the intelligence addon.

Protected drives use your current Litloft session in the same Chrome profile. Unlock them in Litloft and refresh the extension. If they remain unavailable, check the extension's permission for the server and Chrome's third-party cookie settings. Switching servers clears the last destination so you can choose a folder on the new server.
