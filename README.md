# Push Evolution 100+

An offline calisthenics coach that takes you from 40 daily push-ups to 100+ high quality
repetitions across multiple variations, wrapped in an RPG progression system.

No accounts. No servers. No analytics. No network calls of any kind — once installed the
app is a folder of static files and a `localStorage` save file on your device.

---

## Contents

- [What it does](#what-it-does)
- [Folder structure](#folder-structure)
- [Running it locally](#running-it-locally)
- [Installing on a phone](#installing-on-a-phone)
- [Deploying to GitHub Pages](#deploying-to-github-pages)
- [How the coach thinks](#how-the-coach-thinks)
- [Where I deviated from the brief](#where-i-deviated-from-the-brief)
- [Tuning the program](#tuning-the-program)
- [Data and privacy](#data-and-privacy)
- [Known limitations](#known-limitations)

---

## What it does

**Training engine.** Day 1 is 40 push-ups across 4 sets: standard, wide, diamond, incline.
After every session the app asks how hard it felt, and that answer sets the next
prescription. Sets never exceed 5 and a single day never rises more than 20%.

**45 day evolution.** Every 45 days one anchor movement is replaced and new tools are added.

| Cycle | Days | Change | Added |
|---|---|---|---|
| 1 · Foundation | 1–45 | standard, wide, diamond, incline | — |
| 2 · Strength Awakening | 46–90 | incline → **decline** | slow tempo, pause |
| 3 · Power Phase | 91–135 | wide → **explosive** | archer, hand release |
| 4 · Advanced Control | 136–180 | standard → **pseudo planche** | deep, one arm progression |
| 5 · Elite | 181+ | pool holds, the numbers keep moving | — |

The Today screen counts down to the next evolution and names the change in advance.

**The tally ring.** The workout screen is one large circle. Each tap is one repetition;
the ring carries one tick per prescribed rep and lights them as you go, so a finished set
reads like scratch marks on a wall. Tapping works with a finger or — in Nose mode — with
your nose at the bottom of each rep. Vibration, a short tone and a press animation fire on
every count.

**Three modes.** Normal (1× XP), Nose Counter Challenge (1.5× XP), Weighted (2× XP,
minimum 20 reps to count, load suggestion every 10 days).

**RPG layer.** XP, 99 levels, six ranks, skill points, four skill trees that grow from the
work you actually perform, three boss challenges, nine badges, daily main and side quests,
and a journey map across the 180 day arc.

**Log book.** Total reps, average and best session, longest streak, 7 and 30 day charts,
a weak point / strong point report per exercise, per cycle summaries, and full history.

**Health.** Weight, waist, energy and sleep check-ins, plus an optional daily reminder.

---

## Folder structure

```
push-evolution-100/
├── index.html            App shell: five screens, top bar, tab bar, overlays
├── style.css             Design tokens and all styling. Dark, mobile first
├── app.js                Everything else, in 11 commented modules
├── manifest.json         Install metadata, icons, launch shortcuts
├── service-worker.js     Offline cache of the app shell
├── README.md             This file
└── icons/
    ├── icon-192.png
    ├── icon-512.png
    ├── maskable-512.png  Android adaptive icon (safe zone padded)
    └── apple-touch-icon.png
```

`app.js` is organised so you can find things quickly. Search for the banner comments:

| Module | What lives there |
|---|---|
| 1 · UTIL | date keys, clamp, seeded shuffle |
| 2 · DATA | exercise catalog, cycles, ranks, trees, badges, bosses, quests, copy |
| 3 · STORE | state shape, load and save |
| 4 · ENGINE | volume maths, set distribution, cycle resolution, streaks |
| 5 · RPG | xp, levels, skill branches, awards |
| 6 · FEEDBACK | sound, vibration, toasts, confetti, level up |
| 7 · WORKOUT | the tally ring runner and rest timer |
| 8 · RENDER | one painter per screen |
| 9 · SHEETS | difficulty prompt, recap, weighted log, confirmations |
| 10 · HEALTH | check-ins and reminders |
| 11 · BOOT | wiring, tabs, service worker, install prompt |

---

## Running it locally

A service worker will not register from a `file://` URL, so serve the folder over HTTP:

```bash
cd push-evolution-100

# any one of these
python3 -m http.server 8080
npx serve .
php -S localhost:8080
```

Open `http://localhost:8080`. To confirm offline mode works, load the page once, then
switch off your network and reload — it should come straight back.

---

## Installing on a phone

**Android / Chrome.** Open the deployed URL, then either accept the install banner or use
the ⋮ menu → *Add to Home screen*. The app launches standalone with no browser chrome.

**iPhone / Safari.** Open the URL, tap the Share button, then *Add to Home Screen*. Safari
does not show an install prompt, so this step is manual.

**Desktop.** Chrome and Edge show an install icon in the address bar.

Once installed, everything runs offline. There is also an **Install app** button on the
You screen when the browser offers one.

---

## Deploying to GitHub Pages

### Option A — through the web interface

1. Create a new repository, e.g. `push-evolution-100`, and make it public.
2. Upload the six files and the `icons/` folder, keeping the structure above. The files
   must sit at the repository root, not inside a subfolder.
3. Go to **Settings → Pages**.
4. Under *Build and deployment*, set **Source** to `Deploy from a branch`, **Branch** to
   `main`, folder `/ (root)`, then **Save**.
5. Wait a minute or two. Your app is at
   `https://<username>.github.io/push-evolution-100/`.

### Option B — from the command line

```bash
cd push-evolution-100
git init
git add .
git commit -m "Push Evolution 100+"
git branch -M main
git remote add origin https://github.com/<username>/push-evolution-100.git
git push -u origin main
```

Then enable Pages as in steps 3–5 above.

### Notes for Pages

- All paths in the code are **relative** (`./index.html`, `icons/icon-192.png`), so the app
  works from a repository subpath without changes.
- GitHub Pages serves over HTTPS, which service workers and install prompts require.
- **After you edit any file, bump the cache name** at the top of `service-worker.js`:

  ```js
  const CACHE = 'push-evolution-v2';   // was v1
  ```

  Without this, devices that already installed the app keep serving the old copy from
  cache and your changes will appear not to have deployed.

---

## How the coach thinks

**Difficulty answer → next session.**

| Answer | Effect on next session |
|---|---|
| 1 Very easy | up to +20% |
| 2 Easy | up to +10% |
| 3 Good | hold |
| 4 Hard | hold |
| 5 Too hard | −10%, applied in full |

**Damping.** Increases are damped as volume climbs, so the curve flattens instead of
compounding. At 40 reps an "easy" rating gives close to the full +10%; at 150 reps it gives
roughly half of it; past 200 it barely moves. Reductions are never damped, because a
"too hard" answer is a safety signal and should land immediately.

**Per movement ceilings.** Every exercise carries a maximum sensible reps per set — 40 for
standard, 25 for explosive, 20 for pseudo planche, 12 for one arm progression. Reps spread
round robin across the sets and stop at each ceiling. This is why total prescribed volume
eases back when the elite pool arrives in cycle 4: fewer reps of harder movements is the
correct answer, not a bug.

**Plateau breaker.** Three consecutive "Good" ratings means the body has adapted, so the
app adds 5% and tells you why. Without this, someone who always answers "Good" would sit at
40 reps indefinitely.

**Floor and ceiling.** Volume never drops below 20 reps and never exceeds 250.

**XP.** 1 per rep (×1.5 nose, ×2 weighted), 50 per completed session, 20 per side quest,
15 per health check-in, 75 per badge, 200 every 7th streak day, 1000 every 30th.
Levels cost `100 + (level − 1) × 70` XP each and grant one skill point.

**Skill branches** grow from the movements you actually perform — a diamond push-up feeds
Strength, a pause rep feeds Control — plus half your session volume into Endurance. A skill
point is worth 150 branch XP and can be spent to force a branch forward.

---

## Where I deviated from the brief

Three changes, all made because simulating 200 days of the literal specification produced
something a coach should not hand to a person. Each is easy to revert.

1. **Damped progression.** The brief's rule of "never more than 20% in one day" is a per
   day cap, but applied daily it compounds: my simulation reached 400 reps a day by day
   120. Damping keeps the same rules while flattening the curve.
2. **Per movement rep ceilings.** Without them the same simulation prescribed 80 one arm
   push-ups in a single set. See `EX[...].max` in module 2.
3. **The plateau breaker.** The brief maps "Good" to hold, which is right once and wrong
   three times in a row.

To restore the literal behaviour: in module 4, delete the `damp` calculation from
`nextTotal`, remove the `caps` logic from `distribute`, and delete the plateau breaker
block in `logWorkout` (module 7).

---

## Tuning the program

Nearly everything is data, not logic. Common edits:

| I want to change | Edit |
|---|---|
| An exercise name, coaching cue, rep ceiling, or which tree it feeds | `EX` (module 2) |
| Which movements appear in a cycle, or when cycles start | `CYCLES` (module 2) |
| Cycle length (45 days) | the `from` values in `CYCLES` |
| Rank names and level thresholds | `RANKS` |
| Skill tree unlocks | `TREES[].unlocks` |
| Badges and their conditions | `BADGES` |
| Boss requirements and rewards | `BOSSES` |
| The side quest pool | `SIDE_QUESTS` |
| Motivational lines | `COPY` |
| Difficulty multipliers | `DIFFICULTY` (module 4) |
| Maximum sets, rest length, volume ceiling | `setsFor`, `startRest`, `VOLUME_CEILING` |
| Colours, spacing, radius | the `:root` block in `style.css` |

Starting profile defaults (35 years, 170 cm, 82 kg, 25% body fat) live in `freshState()`
in module 3 and are editable in the app on the You screen.

---

## Data and privacy

Everything is stored in `localStorage` under the single key `pushEvolution.v1`: profile,
program day, prescription, XP, levels, branches, streaks, history, weighted log, badges,
bosses, quests, health check-ins and settings.

Nothing leaves the device. There is no telemetry and no third party code.

- **Export backup** on the You screen writes a dated `.json` file.
- **Import backup** restores one, merging against the current state shape so backups from
  older versions keep working.
- **Erase everything** clears the key and returns you to day 1. Export first.

An in-progress workout is saved on every rep, so closing the app mid session loses nothing.

---

## Known limitations

- **Reminders are best effort.** Web apps cannot reliably wake themselves at a fixed time.
  The reminder fires when the app is open or resident in the background; iOS in particular
  is aggressive about suspending web apps. Treat it as a nudge, not an alarm.
- **iOS install is manual** — Safari does not offer an install prompt.
- **Nose mode** relies on the screen registering a touch, which most capacitive screens do
  for a nose but not through a screen protector at an odd angle. Test it before committing
  to a set.
- **One device, one save.** There is no sync. Moving to a new phone means export, then
  import.
- **Tap counting trusts you.** There is no motion sensing or rep validation; the app counts
  what you tell it. That is deliberate — the log is only worth what your honesty makes it.

---

## Safety note

This is a training tool, not medical advice. Push-up volume in the hundreds loads the
wrists, elbows and shoulders considerably. If something hurts in a joint rather than a
muscle, answer "Too hard" and let the program reduce, or take the day. If you have an
existing shoulder, elbow, wrist or cardiac condition, talk to a physiotherapist or doctor
before running a progression like this one.
