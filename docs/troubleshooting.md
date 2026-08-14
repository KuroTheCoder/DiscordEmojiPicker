# Troubleshooting & FAQ

## The picker shows "No images yet"

The picker reads from your configured **Emoji folder** and **Sticker folder**. Check:

- The folders exist and contain images (PNG, GIF, or webp).
- **Settings → Emoji folder / Sticker folder** points at the right place.
- Images inside a subfolder appear under that set; images in the folder root form the general set.
- After adding files while Obsidian is running, the picker refreshes automatically — if it doesn't, close and reopen it.

## Shortcodes don't render

- Make sure **Insert style** is set to **Shortcode** for new inserts.
- In the editor, **Render shortcodes in editor** must be on to see images in live preview / source mode; reading mode always renders them.
- The shortcode must match a file name exactly: `:party-parrot:` needs a file named `party-parrot`.

## The editor suggest popup doesn't appear

The suggest triggers when you type `:` in a note. If it doesn't show, restart Obsidian (the plugin registers an editor suggest that needs a full reload to pick up) and confirm the plugin is enabled.

## Discord cloning fails

- **"No Discord token set"** — add a token in **Settings → Discord**, then use **Test connection** to verify it.
- **"Could not connect"** — the token or token type is wrong, or the token was revoked. Test with a known-good bot token first.
- **No servers listed** — a bot must be added to the server you want to clone from; a user token needs to be logged in and the **Token type** set to **User account**.
- **Some animated stickers are missing** — Lottie-only stickers can't be saved as images and are skipped on purpose.

## Importing from Discord links does nothing

- Links must be CDN links (`cdn.discordapp.com/...` or `media.discordapp.net/...`). Copy them from the **share / copy link** menu in Discord.
- Animated emojis must be downloaded as `.gif` — the picker keeps the file's original format.

## Drag & drop doesn't add anything

Drag images onto the dropzone in the **Link** tab of the import modal (the queue area). Dragging onto Obsidian's window elsewhere does nothing.

## Where is my data stored?

Settings, including your Discord token, live in `<Vault>/.obsidian/plugins/discord-emoji-picker/data.json`. Everything stays in your vault — nothing is uploaded anywhere except what you explicitly send to Discord's API/CDN.

## Deleted a set by accident

Set deletion moves the images to your system trash (Obsidian's **FileManager.trashFile**), then removes the folder. Restore them from the trash; the folder needs to be recreated manually.

## The "Open folder" button doesn't work

Opening folders in the system file manager is desktop-only. On Windows, if the folder opens in the background (behind Obsidian), you can usually fix it by upgrading Obsidian — the plugin prefers the main-process shell call that brings the window to the front.

## Does it work on mobile?

Yes — the plugin is not desktop-only. Image picking, inserting, and importing work on mobile. The **Open folder** buttons and Discord token testing require desktop.

## Something still broken?

Open an issue at [github.com/KuroTheCoder/DiscordEmojiPicker/issues](https://github.com/KuroTheCoder/DiscordEmojiPicker/issues) and include: Obsidian version, plugin version, OS, and what you did step by step.