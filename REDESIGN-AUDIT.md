# Redesign Audit — gardenplan-ai (2026-10-13)

**Competitors studied:** Planter (companion-planting grid, frost-date-aware plant cards, bed layouts), Gardenize (plant database with photo records, care reminders, green botanical UI), SeedTime (calendar-first journal, task lists, harvest logging).

## Visual gaps
1. **Theme is generic green-on-white.** Garden apps are botanical journals — cream paper, serif botanical headings, plant cards with type coding. Ours looks like a generic admin panel. → "gardener's journal" identity: cream paper, deep leaf green, clay accent, Fraunces serif display (already loaded, unused).
2. **Plantings table is flat.** SeedTime/Gardenize show growth stages visually. Ours lists dates only. → growth-progress strips (planted → harvest window) on each planting.
3. **Calendar cards lack companion info.** Planter's signature is companion data; we HAVE antagonist data but only show it as a global warning. → per-card "avoid planting near" badges.
4. **Reminders look like a plain list.** Gardenize care reminders read as checkable task cards. → checklist card styling.

## Functional / flow gaps
1. **No per-planting growth progress.** → progress strip computed from plant.harvest windows (data exists: daysToHarvest).
2. **Antagonist data hidden in calendar.** → per-card avoid-neighbors from ANTAGONISTS.

## Decisions
- Keep: setup/frost engine, reminders engine + done state, plantings CRUD, watering, harvest log + CSV, succession hints, companion warnings.
- Identity: "the gardener's journal" — cream paper, leaf-green ink, clay accents, serif botanical titles, sharp corners, type-colored plant cards.
