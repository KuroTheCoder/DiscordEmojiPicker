# Screenshots & demo

This folder holds the demo and screenshots used in the documentation.

## Current state

| File | Where it's used | Status |
| --- | --- | --- |
| `picker-demo.gif` | README — the only demo on the landing page | ✅ done |
| `import.svg` | [docs/usage.md](../usage.md) — import modal section | placeholder, replace with `import.png` |
| `settings.svg` | [docs/usage.md](../usage.md) — settings reference | placeholder, replace with `settings.png` |

## How to swap a placeholder

1. Take a real screenshot (see below) and save it as `import.png` or `settings.png` in this folder.
2. Update the matching image link in [docs/usage.md](../usage.md) from `.svg` to `.png`.
3. Delete the old `.svg` placeholder.

Keep the README demo to just the picker GIF — the landing page stays clean; detail shots belong in the docs.

## What to capture

| File | Shows | What to do |
| --- | --- | --- |
| `import.png` | The import modal | Run **Import emojis & stickers**, add a couple of items to the queue |
| `settings.png` | The settings tab | Open **Settings → Discord Emoji Picker** |

Optional: `shortcode.png` (a `:name:` rendered in a note) and `discord-clone.png` (the Clone a server panel).

## How to capture

- **Windows** — `Win + Shift + S` (snippet), or use [ShareX](https://getsharex.com) / [ScreenToGif](https://www.screentogif.com) for a GIF demo.
- **macOS** — `Cmd + Shift + 4`, or CleanShot for GIFs.
- **Linux** — Flameshot or the GNOME screenshot tool.

## Rules

- Prefer a **light background with a normal vault**; screenshots should look like a real user's setup, not a debug build.
- Keep file sizes reasonable (compress PNGs; cap GIFs at a few MB).
- No personal info (vault names, Discord tokens) in the shots.