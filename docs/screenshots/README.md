# Screenshots

> **Status: placeholders.** The README currently shows gray `*.svg` placeholders. This file explains what real screenshots to take and how to swap them in. Just say "add the screenshots" and the README links get updated too.

This folder holds the screenshots used in the [README](../../README.md#demo). They are referenced by file name, so keep these names.

## How to swap a placeholder

1. Take a screenshot (see below) and save it as `picker.png`, `import.png`, or `settings.png` in this folder.
2. Update the matching image link in [README.md](../../README.md#demo) from `.svg` to `.png`.
3. Delete the old `.svg` placeholder.
4. Optionally delete the `<!-- TODO: replace these placeholder SVGs ... -->` comment in the README.

## What to capture

| File | Shows | What to do |
| --- | --- | --- |
| `picker.png` | The emoji picker | Open a note, open the picker (smile ribbon icon), leave a few sets visible |
| `import.png` | The import modal | Run **Import emojis & stickers**, add a couple of items to the queue |
| `settings.png` | The settings tab | Open **Settings → Discord Emoji Picker** |

Optional extras (nice for the docs but not required): `shortcode.png` (a `:name:` rendered in a note) and `discord-clone.png` (the Clone a server panel in the import modal).

## How to capture

- **Windows** — `Win + Shift + S` (snippet), or use [ShareX](https://getsharex.com) / [ScreenToGif](https://www.screentogif.com) for a GIF demo.
- **macOS** — `Cmd + Shift + 4`, or CleanShot for GIFs.
- **Linux** — Flameshot or the GNOME screenshot tool.
- A short **GIF** of picking and inserting an emoji is the most convincing demo — drop it at `picker.gif` and swap the README link.

## Rules

- Prefer a **light background with a normal vault**; screenshots should look like a real user's setup, not a debug build.
- Keep file sizes reasonable (compress PNGs; cap GIFs at a few MB).
- No personal info (vault names, Discord tokens) in the shots.

Once the files are in place, the images in the README render automatically — no code changes needed.