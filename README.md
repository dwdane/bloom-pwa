# Bloom — Pregnancy Companion (PWA)

A calm, private, week-by-week pregnancy companion that runs as an app on your
phone with no account and no internet required after install. This is a
lightweight web companion to the native Bloom app.

> **Status: in development — not for general public use.** Bloom is a personal
> project under active development and is **not currently intended for the
> general public**. It is provided **as is, with no warranty**, for personal and
> evaluation use only. **Use it at your own risk.**

> **Important — not medical advice.** Bloom is for general information only. It
> does not provide medical advice and does not replace your healthcare provider.
> If you have a concern, contact your provider; in an emergency, call your local
> emergency number. See [disclaimer.html](disclaimer.html).

---

## What Bloom does

- **Week view** — a friendly size comparison (with your baby's name and an
  "it's a girl/boy" touch once set), a calendar day strip showing where you are
  in the week, a due-date countdown, what's developing for baby, a tuck-away
  "your body this week," encouragement, and rotating facts with sources. Browse
  any week, and the first time you reach a new week, a little celebration.
- **Log** — pick any day on the calendar strip and log your feelings, symptoms
  (each with its own emoji), weight, and bump size for that day. A daily summary
  highlights the good moments, gentle "things that may help" suggestions appear
  for symptoms, you can review and delete a day's entries, and collapsible trends
  show weight, bump, and how you've been feeling over time.
- **Tools** — a contraction timer and a kick counter, each with plain guidance
  and clear "when to call your provider" advice.
- **Lists** — flexible, named, collapsible checklists plus a free-notes pad.
  Start from generous templates (hospital bag, birth preferences, doctor
  questions, registry, nursery, postpartum) or build your own; add, check off,
  and delete freely.
- **Food** — a "Can I eat this?" search covering common foods and drinks, with a
  reminder to follow your provider's advice and full source attributions.
- **Settings** (top-right gear) — units, your dates, and your baby's name and sex.
- **Works offline** and installs to your home screen like a native app.

---

## Install it on your phone

Bloom installs straight from the web — no app store needed.

### iPhone or iPad (use Safari)

1. Open the Bloom web address in **Safari** (this must be Safari, not Chrome, for
   install to work on iOS).
2. Tap the **Share** button (the square with an upward arrow).
3. Scroll down and tap **Add to Home Screen**.
4. Tap **Add**. Open Bloom from its new home-screen icon.

### Android (use Chrome)

1. Open the Bloom web address in **Chrome**.
2. Tap the **⋮** menu (top right).
3. Tap **Install app** (or **Add to Home screen**).
4. Confirm. Bloom appears in your app drawer and on your home screen.

### Desktop (Chrome or Edge)

1. Open the Bloom web address.
2. Click the **install icon** in the address bar (a small monitor/plus icon), or
   open the **⋮** menu and choose **Install Bloom**.

Installing matters on iPhone in particular: an installed (home-screen) app gets
much stronger storage protection than a page kept open in the browser.

---

## How your data is handled

Bloom is built to be as private as possible:

- **Everything stays on your device.** Your dates, logs, and preferences are
  saved only in your browser's on-device storage for this app.
- **No account, no servers, no analytics.** There is nothing to sign into, and no
  server we control ever receives your information. We cannot see your data.
- **No tracking or ads.** Bloom uses no cookies, ad identifiers, or third-party
  trackers.
- **You're in control of deletion.** Removing the app and clearing its site data
  permanently deletes everything; we never held a copy to recover.

The full details are in the in-app pages, which are also plain web pages you can
link to:

- [Privacy Policy](privacy.html)
- [Terms of Use](terms.html)
- [Medical Disclaimer](disclaimer.html)

One honest note: the very first time you load or install Bloom, the static web
host that serves the files may log a standard web request (for example, your IP
address), exactly as visiting any website does. That's handled by the host, isn't
linked to anything you enter, and stops once the app is installed and running
offline. This is described in the Privacy Policy.

---

## Updating

Bloom caches itself for offline use. When the files are updated on the host,
reopening the installed app picks up the new version on the next launch (the
service worker cache version is bumped on each release). Your saved data is
preserved across updates.

---

## For developers

Pure vanilla HTML/CSS/JS. No build step, no dependencies, no npm.

### Deploy (GitHub Pages)

1. Put every file at the **root** of a repository (a single flat folder — there
   are no subfolders, so a phone can upload them in one selection).
2. In the repo: **Settings → Pages → Deploy from a branch → `main` / root**.
3. Open the published URL. HTTPS (required for the service worker) is automatic.

### Local preview

```
python -m http.server 8000
```

Open `http://127.0.0.1:8000`.

### Files

| File | Purpose |
| --- | --- |
| `index.html` | App shell |
| `styles.css` | Styling (mauve theme) |
| `weekContent.js` | Week 4–40 content |
| `foodDatabase.js` | Food-safety entries, search, source names |
| `logOptions.js` | Feeling/symptom vocabulary + emoji |
| `symptomRelief.js` | Symptom relief tips + movement guidance |
| `listTemplates.js` | Starter templates for the Lists tab |
| `gestational.js` | Pregnancy dating math |
| `charts.js` | Canvas trend + bar charts |
| `db.js` | IndexedDB layer (day- and week-scoped queries) |
| `app.js` | Views, daily tracking, tools, and navigation |
| `sw.js` | Service worker (offline) |
| `manifest.json`, `icon-*.png` | Install assets |
| `privacy.html`, `terms.html`, `disclaimer.html` | Legal pages |

### Before public release — please read

The Privacy Policy, Terms of Use, and Medical Disclaimer here are written to be
solid, honest starting points that match how the app actually works (local-only,
no data collection). They are **not legal advice.** Before distributing this app
publicly — especially as a pregnancy/health app — have them reviewed by a
qualified lawyer for your jurisdiction. Areas that commonly need attention:

- Confirming the contact, governing jurisdiction, and licensing details (the
  legal pages currently state these will be provided in connection with a wider
  release).
- Regional privacy laws (e.g. GDPR in the EU/UK, CCPA in California) and whether
  a data-processing or cookie banner is needed for the hosting layer.
- App-store and listing requirements if you ever wrap or publish it.
- Health-app and consumer-protection rules that may apply where your users are.

### Roadmap (not yet in this build)

Per-week notes, on-device encryption of stored data (Web Crypto), and an optional
PIN lock. Photos are intentionally out of the web version.
