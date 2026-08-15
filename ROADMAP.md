# Roadmap

## Done

### Import onboarding
The import modal has its own guided tour (drop zone, source tabs, queue,
import button), shown on first import and re-runnable via the `?` button in the
modal footer or **Settings → Start import onboarding**. It reuses the generic
`GuidedTour` (`src/ui/tour.ts`), which the picker tour also uses. The
`importOnboardingSeen` setting mirrors `onboardingSeen`; the **Show onboarding
tours** toggle controls both.

## Notes

- Tours cover: picker (search, tabs, ⋮ menu, move, resize toggle, resize corner)
  and import (import into, set, new set, category, drop zone, source tabs,
  queue, import button).
- `GuidedTour` renders ring/bubble layers above its container's content, so it
  can run inside any container (fixed panel or modal).
