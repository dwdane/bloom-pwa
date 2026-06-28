# Bloom PWA

A lightweight, on-the-go web version of Bloom. This is the companion to the
native Flutter app, not a replacement — the Flutter app remains the primary,
fully-featured version. Built as a vanilla HTML/CSS/JS PWA with no build step and
no dependencies, so it deploys to GitHub Pages by dropping the files in.

## What's in the app now

Four tabs along the bottom:

- **Week** — the size-comparison hero, due-date countdown, "Baby this week," a
  collapsible "Your body this week," encouragement, and rotating sourced facts,
  with forward/back week navigation.
- **Log** — weight and bump-size logging. Each saves tagged with the current
  week, shows your latest value, and draws a gentle trend chart once you have two
  or more entries (positively framed, no clinical lines). Units follow your
  Settings choice.
- **Food** — "Can I eat this?" search over 53 entries (24 safe, 17 in
  moderation, 12 avoid), including cooked/raw and pasteurized/unpasteurized
  variations as separate results. Tap a result for the reasoning, how to make it
  safer, and the source.
- **Settings** — metric/imperial toggle and editing your dates.

The gestational math, week content (weeks 4–40, 112 facts), and food database
are all ported faithfully from the native app and verified to match.

## Deliberately not here yet

Symptom/feeling tracking (lower priority, planned next), per-week summaries, the
fuller trends screen, PIN lock, celebrations, and photos. Storage is plain
IndexedDB for now; a Web Crypto encryption layer is the planned follow-up.

## Deploy (same as the storage test)

1. Put all files at the root of a repo (single flat folder — no subfolders).
2. Settings → Pages → Deploy from a branch → `main` / root.
3. Open the published URL, then on iPhone: Share → Add to Home Screen.

## Local preview

```
python -m http.server 8000
```

Open `http://127.0.0.1:8000`.

## Files

- `index.html` — shell
- `styles.css` — mauve theme matching the native app
- `weekContent.js` — week 4–40 content (ported)
- `foodDatabase.js` — 53 food-safety entries + ranked search (ported)
- `gestational.js` — dating math (ported, verified)
- `charts.js` — canvas line chart for weight/bump trends
- `db.js` — IndexedDB layer (settings + entries)
- `app.js` — shell, navigation, and the Week / Log / Food / Settings views
- `sw.js` — service worker
- `manifest.json`, `icon-*.png` — PWA install assets
