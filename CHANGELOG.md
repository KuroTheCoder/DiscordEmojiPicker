# Changelog

All notable changes to Discord Emoji Picker.

## Unreleased

### Added

- **Three-level folders & a horizontal category bar**: sets are now level-1 folders and categories are level-2 folders inside them (`discordemojipicker/emojis/twemoji/faces/`). The picker keeps the vertical bar for sets and adds a horizontal bar for categories — pick a set, then filter by category.
- **Smooth transitions**: switching sets, categories, or emoji/sticker tabs crossfades the grid and staggers items in with a gentle rise; respects your system's reduced-motion setting.
- **Pack organization options**: choose **Per pack** (each pack is its own set with category folders inside) or **Combined** (all packs plus the system emoji set merge into one set with shared categories, custom-named — default **packs**).
- **Folder-name auto-suggest on drop**: dragging in a whole folder of images fills the **Set (subfolder)** field with the source folder's name — still editable before importing.
- **System emoji set (offline)**: the Emoji pack tab can render ~240 emojis locally from your device's emoji font (Segoe UI Emoji on Windows) with no download.
- **Category (sub-subfolder) field** in the import modal for placing dropped/pasted images into a category of the chosen set.
- **Per-provider set folders**: custom names typed into the pack tab import into the pack's set under a `custom` category (e.g. `discordemojipicker/emojis/twemoji/custom/`), so sets stay organized without manual setup.

### Changed

- **Picker feel**: the panel now animates in, tooltips fade, grid items lift on hover, and the rise-stagger is capped so large sets animate quickly.
- **Set order**: **General** now always sits first, followed by sets alphabetically.
- **Import feedback**: the queue is grouped by target set/category, a live **Importing x of y** counter runs during imports, and a **Cancel** button lets you stop a large import mid-way (finished items are kept).
- **Settings**: every set row gained a **Rename** action, and the emoji/sticker folder settings now show the resolved path and whether the folder exists yet.
- **Touch devices**: bigger tap targets (nav, category pills) and tap-fast handling on the picker.
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