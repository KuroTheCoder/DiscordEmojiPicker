# Changelog

All notable changes to Discord Emoji Picker.

## Unreleased

### Added

- **System emoji set (offline)**: the Emoji pack tab can render ~240 emojis locally from your device's emoji font (Segoe UI Emoji on Windows) with no download.
- **Per-provider set folders**: importing a pack (Twemoji, Noto Emoji, OpenMoji) or the system emoji set automatically creates a matching set folder (e.g. `discordemojipicker/emojis/twemoji/`), so sets stay organized without manual setup.

### Changed

- Default folders are now `discordemojipicker/emojis` and `discordemojipicker/stickers` — a visible, single home for all media instead of hidden dot-folders. Existing installs keep their current folders.

### Fixed

- Import modal crashed before rendering the queue, status, and Import button (the status element was created after the body was rendered).
- Emoji pack name resolution: Discord-style names like `sweat_smile` or `heart_eyes` now resolve (fallback alias map), so the popular set imports fully instead of failing.
- Pack downloads strip variation selectors (`fe0f`) from codepoints, fixing 404s for emojis like ☀️, ❄️, and ✌️ on some packs.
- Downloads are throttled slightly to avoid CDN rate-limit failures on large sets.
- System emoji rendering is more robust (fallback export path) and cleans up its canvas elements.

## 1.1.0 - 2026-08-14

### Added

- **Sample sets on first run**: the plugin seeds a small Cats emoji set and Pets sticker set into `.gl-emoji/` and `.gl-stickers/` so fresh installs work out of the box. Delete them anytime.
- **Emoji packs tab reworked**: three open-license packs to choose from — Twemoji, Noto Emoji, and OpenMoji — plus an **Add popular set** button that queues ~250 common emojis with one click.
- A curated sample pack (the full source images) ships in the repository under `docs/Sample sets/`.

## 1.0.1 - 2026-08-14

### Changed

- Emoji and sticker folders now default to `.gl-emoji` and `.gl-stickers` — dot-folders that Obsidian hides from the file explorer, so they no longer clutter vault navigation. Existing installs keep their current folders.
- Settings tab now uses the declarative settings API (`getSettingDefinitions`): settings appear in Obsidian 1.13+ settings search, with the imperative layout kept for older versions.
- Vault scans narrowed: the plugin walks only the configured folders instead of enumerating the whole vault.
- Vault access and clipboard use are disclosed in the README's security section (clipboard is only read on the explicit "Read clipboard image" action).

### Fixed

- Hover tooltip glitches on the picker (repositioning throttled with `requestAnimationFrame`).
- Shortcode preview images no longer trigger the drag-resize overlay of the image-converter plugin (`draggable="false"`).
- Shortcode rendering now uses Obsidian's `createEl`/`createFragment` DOM helpers instead of `document.createElement`.

## 1.0.0 - 2026-08-14

Initial release.

### Features

- Emoji and sticker picker with set navigation, live search, and a "recently used" row.
- Insert emojis and stickers as shortcodes (`:name:`), native embeds, or raw HTML.
- Shortcode rendering in the editor and reading mode, with editor autocomplete.
- Import modal with a queue: drag & drop or paste links from Discord, local files, clipboard, note embeds, and emoji packs.
- Clone emojis and stickers from Discord servers using a user or bot token.
- Set management (create, delete, open folders) in the settings tab and import modal.
- Themable picker (Default, Compact, Vibrant, Minimal) built on CSS variables.