## Behavior

Shortcodes inside syntax-highlighted code blocks (e.g., ```js, ```python) display as plain text (:smile:) rather than rendering as emoji images.

## Why

Syntax highlighters (Prism) fragment code into token `<span>` elements for highlighting:
- `:smile:` becomes `<span class="token punctuation">:</span><span class="token function">smile</span><span class="token punctuation">:</span>`

This breaks the contiguous `:name:` pattern the shortcode regex needs to match.

## Workarounds

1. **Use plain code blocks** (no language):
   ```
   :smile:
   ```
   — renders as emoji ✓

2. **Use callouts** — renders as emoji ✓

3. **Inline code** `:smile:` — renders as emoji in reading mode ✓

## Tradeoff

Rendering emoji in highlighted blocks would require replacing the entire highlighted DOM structure, losing all syntax coloring. The current behavior preserves highlighting at the cost of shortcode rendering in those specific blocks.

This is a known limitation with no clean fix without hooking into Obsidian's markdown pipeline before Prism runs.