# Roadmap

## Next up

### Import onboarding
The picker has a guided tour (`src/emoji/onboarding.ts`, re-runnable via the `?`
button in the footer or **Settings → Start onboarding**), but the import modal
(`src/ui/import.ts`) does not.

Ideas for a future import tour:
- Highlight the dropzone, the import source tabs, and the import queue.
- Reuse the ring/bubble system from `PickerOnboarding` (it renders above a
  container's content, so it works for modals too).
- Add an `importSeen` setting mirroring `onboardingSeen`, shown on first import
  and re-runnable from a small `?` in the modal footer.
- Keep the tour short: dropzone → source → queue → confirm. Sticky "Got it"
  steps only where a real interaction is required.

## Notes

- The picker tour covers: search, tabs, ⋮ menu, move, resize toggle, resize corner.
- Import (button in the picker's search bar) has no tour yet — this is the item above.
