/* =============================================================================
   PUSH EVOLUTION 100+   ·   app.js
   -----------------------------------------------------------------------------
   Offline calisthenics coach. Vanilla JS, no dependencies, no network calls.

   Module map (search for the banner comments):
     1  UTIL          small helpers
     2  DATA          exercises, cycles, ranks, badges, bosses, quests, copy
     3  STORE         state shape + localStorage persistence
     4  ENGINE        progression maths, cycle resolution, streaks
     5  RPG           xp, levels, skill trees, bosses, achievements
     6  FEEDBACK      sound, vibration, toasts, confetti, level-up
     7  WORKOUT       the tally-ring runner
     8  RENDER        screen painters
     9  SHEETS        modal dialogs (difficulty, weighted, confirm)
    10  HEALTH        check-ins + reminders
    11  BOOT          wiring, tabs, service worker, install
   ============================================================================= */

/* =============================================================================
   1 · UTIL
   ============================================================================= */

const $ = (id) => document.getElementById(id);
const el = (tag, cls, html) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html != null) n.innerHTML = html;
  return n;
};
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const sum = (a) => a.reduce((x, y) => x + y, 0);

/** Local (not UTC) date key, e.g. "2026-07-25". */
function dayKey(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function keyShift(key, days) {
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(y, m - 1, d + days);
  return dayKey(dt);
}
function daysBetween(a, b) {
  const p = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d).getTime(); };
  return Math.round((p(b) - p(a)) / 86400000);
}
function prettyDate(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}
/** Deterministic pseudo-random from a string — same quests all day, new ones tomorrow. */
function seeded(seedStr) {
  let h = 2166136261;
  for (let i = 0; i < seedStr.length; i++) { h ^= seedStr.charCodeAt(i); h = Math.imul(h, 16777619); }
  return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h ^= h >>> 13; return (h >>> 0) / 4294967296; };
}
function pickOne(arr) { return arr[Math.floor(Math.random() * arr.length)]; }


/* =============================================================================
   2 · DATA
   ============================================================================= */

/** Every movement the coach knows. `tree` routes earned reps into a skill branch. */
const EX = {
  standard:    { name: 'Standard push-up',        max: 40, tree: 'strength',  cue: 'Hands under the shoulders. Chest to the floor, elbows at 45°, lock out at the top.' },
  wide:        { name: 'Wide push-up',            max: 40, tree: 'strength',  cue: 'Hands one and a half shoulder widths apart. Chest leads, no flaring past 60°.' },
  diamond:     { name: 'Diamond push-up',         max: 30, tree: 'strength',  cue: 'Index fingers and thumbs touching. Elbows brush the ribs on the way down.' },
  incline:     { name: 'Incline push-up',         max: 40, tree: 'endurance', cue: 'Hands on a bench or chair. Body in one line — no sagging hips.' },
  decline:     { name: 'Decline push-up',         max: 30, tree: 'strength',  cue: 'Feet raised above the hands. Keep the ribs down and the neck long.' },
  tempo:       { name: 'Slow tempo push-up',      max: 25, tree: 'control',   cue: 'Three seconds down, one second up. The clock does the work, not momentum.' },
  pause:       { name: 'Pause push-up',           max: 25, tree: 'control',   cue: 'Hold two full seconds at the bottom with tension on, then drive up.' },
  explosive:   { name: 'Explosive push-up',       max: 25, tree: 'explosive', cue: 'Push hard enough that the hands leave the floor. Land soft, absorb, repeat.' },
  archer:      { name: 'Archer push-up',          max: 20, tree: 'strength',  cue: 'Shift onto one arm, the other stays straight. Alternate sides each rep.' },
  handrelease: { name: 'Hand release push-up',    max: 30, tree: 'explosive', cue: 'Chest touches down, hands lift off the floor, then press. Zero bounce.' },
  planche:     { name: 'Pseudo planche push-up',  max: 20, tree: 'strength',  cue: 'Hands at the waist, shoulders leaning past the wrists. Protract at the top.' },
  deep:        { name: 'Deep push-up',            max: 30, tree: 'control',   cue: 'Hands on two raised surfaces. Sink below the hands under control.' },
  onearm:      { name: 'One arm progression',     max: 12, tree: 'strength',  cue: 'Wide feet, free hand behind the back or on a raised surface. Both sides.' },
  clap:        { name: 'Clap push-up',            max: 15, tree: 'explosive', cue: 'Explosive rep with a clap at the peak. Only on fresh shoulders.' },
  negative:    { name: '5 second negative',       max: 12, tree: 'control',   cue: 'Five seconds lowering, reset at the top however you need to.' },
  weighted:    { name: 'Weighted push-up',        max: 30, tree: 'strength',  cue: 'Load across the upper back. Range of motion stays honest.' }
};

/**
 * The 45-day evolution. Each cycle swaps exactly one anchor movement and adds
 * new tools; the runner picks `sets` exercises from the pool, rotating daily.
 */
const CYCLES = [
  { n: 1, from: 1,   name: 'Foundation',        stage: 'Foundation Warrior',
    pool: ['standard', 'wide', 'diamond', 'incline'],
    next: 'Your incline push-up becomes a decline push-up, and tempo work joins the program.' },
  { n: 2, from: 46,  name: 'Strength Awakening', stage: 'Strength Awakening',
    pool: ['standard', 'wide', 'diamond', 'decline', 'tempo', 'pause'],
    next: 'Your wide push-up becomes an explosive push-up, and archer work joins the program.' },
  { n: 3, from: 91,  name: 'Power Phase',        stage: 'Power Phase',
    pool: ['standard', 'explosive', 'diamond', 'decline', 'archer', 'handrelease'],
    next: 'Your standard push-up becomes a pseudo planche push-up, and one arm work begins.' },
  { n: 4, from: 136, name: 'Advanced Control',   stage: 'Advanced Control',
    pool: ['planche', 'explosive', 'diamond', 'decline', 'deep', 'onearm'],
    next: 'You hold the elite pool from here and sharpen it rep by rep.' },
  { n: 5, from: 181, name: 'Elite',              stage: 'Calisthenics Elite',
    pool: ['planche', 'explosive', 'archer', 'decline', 'deep', 'onearm'],
    next: 'The program is yours now. Keep the standard, chase the numbers.' }
];

const RANKS = [
  { lv: 1,  name: 'Rookie' },
  { lv: 5,  name: 'Apprentice' },
  { lv: 10, name: 'Warrior' },
  { lv: 15, name: 'Elite Athlete' },
  { lv: 20, name: 'Calisthenics Master' },
  { lv: 30, name: 'Legend' }
];

const TREES = [
  { id: 'strength',  ico: '💪', name: 'Strength',        how: 'Hard variations, weighted sets, slow controlled reps.',
    unlocks: [[5, 'Decline push-up'], [10, 'Archer push-up'], [20, 'Pseudo planche push-up'], [30, 'One arm progression']] },
  { id: 'endurance', ico: '🔥', name: 'Endurance',       how: 'High rep sessions, streaks, long challenges.',
    unlocks: [[5, '50 push-up session'], [10, '100 push-up session'], [20, '200 push-up challenge'], [30, 'Unbroken century']] },
  { id: 'explosive', ico: '⚡', name: 'Explosive power', how: 'Explosive reps, fast tempo, jumping variations.',
    unlocks: [[5, 'Hand release push-up'], [10, 'Clap push-up'], [20, 'Power challenge circuit'], [30, 'Superman push-up']] },
  { id: 'control',   ico: '🧠', name: 'Control',         how: 'Slow tempo, pause reps, immaculate form.',
    unlocks: [[5, '5 second negative'], [10, 'Deep push-up'], [20, 'Ten second hold'], [30, 'Full tempo mastery']] }
];

const BADGES = [
  { id: 'first40',    ico: '🩶', name: 'First 40',        test: (s, ctx) => ctx.session >= 40 },
  { id: 'first100',   ico: '💯', name: 'First 100',       test: (s, ctx) => ctx.session >= 100 },
  { id: 'streak7',    ico: '🔥', name: '7 day streak',    test: (s) => s.streak >= 7 },
  { id: 'streak30',   ico: '🗓', name: '30 day streak',   test: (s) => s.streak >= 30 },
  { id: 'total1k',    ico: '🏅', name: '1,000 total',     test: (s) => s.totalPushups >= 1000 },
  { id: 'total10k',   ico: '🏆', name: '10,000 total',    test: (s) => s.totalPushups >= 10000 },
  { id: 'weighted1',  ico: '🎒', name: 'First weighted',  test: (s) => s.weighted.length > 0 },
  { id: 'decline1',   ico: '📐', name: 'First decline',   test: (s, ctx) => (ctx.exercises || []).includes('decline') },
  { id: 'explosive1', ico: '💥', name: 'First explosive', test: (s, ctx) => (ctx.exercises || []).includes('explosive') }
];

const BOSSES = [
  { id: 'b1', name: 'The 100 Push-up Wall', req: 'Complete 100 quality push-ups in a single session.',
    reward: '+500 XP · wall breaker badge', xp: 500,
    progress: (s) => clamp(s.records.bestSession / 100, 0, 1) },
  { id: 'b2', name: 'Discipline Trial', req: 'Train 30 consecutive days without a gap.',
    reward: 'Rank title: Disciplined Warrior', xp: 400,
    progress: (s) => clamp(s.bestStreak / 30, 0, 1) },
  { id: 'b3', name: 'Weighted Warrior', req: 'Complete 20 weighted push-ups carrying 10 kg.',
    reward: 'Elite strength badge', xp: 600,
    progress: (s) => clamp(s.records.bestWeightedScore / 200, 0, 1) }
];

const SIDE_QUESTS = [
  { id: 'shoulders', text: 'Stretch shoulders and chest for 5 minutes', xp: 20 },
  { id: 'steps',     text: 'Walk 5,000 steps', xp: 20 },
  { id: 'water',     text: 'Drink 2.5 litres of water', xp: 20 },
  { id: 'sleep',     text: 'Sleep 7 hours tonight', xp: 20 },
  { id: 'plank',     text: 'Hold a 60 second plank', xp: 20 },
  { id: 'wrists',    text: 'Two minutes of wrist preparation', xp: 20 },
  { id: 'protein',   text: 'Hit your protein target today', xp: 20 },
  { id: 'nosugar',   text: 'No added sugar today', xp: 20 },
  { id: 'breath',    text: 'Five minutes of nasal breathing practice', xp: 20 },
  { id: 'scapula',   text: '20 scapular push-ups as a finisher', xp: 20 }
];

/** Motivation engine — short, plain, no cheerleading. */
const COPY = {
  idle: [
    'Today you build the person you want to become.',
    'The set you do not feel like doing is the one that counts.',
    'Forty is a starting line, not a ceiling.',
    'Small numbers, repeated, become large numbers.',
    'Nobody is watching. Do it anyway.'
  ],
  done: [
    'Mission completed. Your body remembers every repetition.',
    'Logged. Recovery is part of the training now.',
    'That is one more day the plan survived contact with real life.'
  ],
  broken: [
    'Your streak is broken, but your journey continues.',
    'The gap is data, not failure. Start the count again today.'
  ],
  record: [
    'New limit destroyed.',
    'Personal record. The ceiling moved.'
  ]
};


/* =============================================================================
   3 · STORE
   ============================================================================= */

const KEY = 'pushEvolution.v1';

function freshState() {
  return {
    version: 1,
    createdAt: new Date().toISOString(),
    startDate: dayKey(),
    profile: { name: 'Push Evolution Warrior', age: 35, height: 170, weight: 82, bodyFat: 25 },

    day: 1,                 // program day, advances once per completed workout
    total: 40,              // reps prescribed for the next workout
    sets: 4,

    xp: 0, level: 1, skillPoints: 0,
    branches: { strength: 0, endurance: 0, explosive: 0, control: 0 },
    spent: { strength: 0, endurance: 0, explosive: 0, control: 0 },

    streak: 0, bestStreak: 0, lastWorkoutDate: null,
    totalPushups: 0,
    records: { bestSession: 0, bestWeightedScore: 0, bestWeight: 0 },

    history: [],            // { date, day, total, sets:[{ex,reps}], difficulty, mode, xp, cycle }
    weighted: [],           // { date, weight, reps }
    weight: { current: 2, lastBumpDay: 1 },

    badges: {},             // id -> ISO date
    bosses: {},             // id -> ISO date
    quests: null,           // { date, main, side:[{id,text,xp,done}] }
    health: [],             // { date, weight, waist, energy, sleep }
    summaries: [],          // per-cycle reports
    active: null,           // in-progress workout, so a reload never loses reps
    hold: 0,                // consecutive "Good" ratings, feeds the plateau breaker

    settings: { sound: true, vibrate: true, confetti: true, reminder: '18:00', notify: false }
  };
}

let S = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return freshState();
    // Merge so that new fields added in future versions get defaults.
    return Object.assign(freshState(), JSON.parse(raw));
  } catch (e) {
    console.warn('Save file unreadable, starting fresh.', e);
    return freshState();
  }
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); }
  catch (e) { toast('Storage full', 'Could not save. Free some space on the device.'); }
}


/* =============================================================================
   4 · ENGINE  — the coach's maths
   ============================================================================= */

/** Difficulty answers map to a multiplier on the next session's volume. */
const DIFFICULTY = [
  { n: 1, label: 'Very easy', effect: '+20%', mult: 1.20 },
  { n: 2, label: 'Easy',      effect: '+10%', mult: 1.10 },
  { n: 3, label: 'Good',      effect: 'hold', mult: 1.00 },
  { n: 4, label: 'Hard',      effect: 'hold', mult: 1.00 },
  { n: 5, label: 'Too hard',  effect: '−10%', mult: 0.90 }
];

function cycleFor(day) {
  let c = CYCLES[0];
  for (const cy of CYCLES) if (day >= cy.from) c = cy;
  return c;
}

/** Days remaining until the next evolution (0 once the program is open-ended). */
function daysToEvolution(day) {
  const nxt = CYCLES.find((c) => c.from > day);
  return nxt ? nxt.from - day : 0;
}

const VOLUME_CEILING = 250;   // absolute stop, however well the sessions go

/** Sets grow to a hard ceiling of five, never more. */
function setsFor(total) {
  return total >= 60 ? 5 : 4;
}

/** Which movement lands in which set today — the pool rotates one place a day. */
function picksFor(day, sets) {
  const pool = cycleFor(day).pool;
  return Array.from({ length: sets }, (_, i) => pool[(day - 1 + i) % pool.length]);
}

/**
 * Spread reps round-robin so the sets stay even, but never push a movement past
 * its own ceiling: 80 one-arm reps is a number, not a workout. Overflow moves to
 * whichever set still has room, and if nothing has room the total is trimmed.
 */
function distribute(total, picks) {
  const caps = picks.map((id) => EX[id].max);
  const reps = picks.map(() => 0);
  let left = Math.min(total, sum(caps));
  let i = 0;
  while (left > 0) {
    if (reps[i] < caps[i]) { reps[i]++; left--; }
    i = (i + 1) % picks.length;
  }
  return reps;
}

/** Today's prescription. `total` is a request; the plan returns what actually fits. */
function buildPlan(day = S.day, total = S.total) {
  const cy = cycleFor(day);
  const sets = setsFor(total);
  const picks = picksFor(day, sets);
  const reps = distribute(total, picks);
  return {
    day, cycle: cy, sets,
    total: sum(reps),
    capacity: sum(picks.map((id) => EX[id].max)),
    plan: picks.map((ex, i) => ({ ex, reps: reps[i] }))
  };
}

/**
 * Safe progression.
 *   · A reduction always applies in full — that is a safety signal.
 *   · An increase is capped at +20% and then damped as volume climbs, so the
 *     curve flattens instead of compounding into three hundred daily reps.
 *   · Nothing goes past the plannable capacity of tomorrow's movements.
 */
function nextTotal(current, mult, day = S.day + 1) {
  if (mult < 1) return clamp(Math.round(current * mult), 20, VOLUME_CEILING);

  const capped = Math.min(mult, 1.20);
  const damp = clamp(1 - (current - 40) / 220, 0.2, 1);
  const effective = 1 + (capped - 1) * damp;
  let next = Math.round(current * effective);
  if (capped > 1 && next <= current) next = current + 1;   // progress is progress

  // Later cycles hold harder movements and therefore less rep capacity. That caps
  // what gets *prescribed*, but it must never claw back volume already earned.
  const room = Math.max(buildPlan(day, VOLUME_CEILING).capacity, current);
  return clamp(next, 20, Math.min(VOLUME_CEILING, room));
}

/** Streak bookkeeping at launch: a missed day resets the count. */
function auditStreak() {
  if (!S.lastWorkoutDate) return;
  const gap = daysBetween(S.lastWorkoutDate, dayKey());
  if (gap > 1 && S.streak > 0) {
    S.streak = 0;
    save();
    toast('Streak reset', pickOne(COPY.broken));
  }
}


/* =============================================================================
   5 · RPG  — xp, levels, branches, badges, bosses
   ============================================================================= */

const xpForLevel = (lv) => 100 + (lv - 1) * 70;      // xp needed to leave `lv`
function levelFloor(level) {                          // cumulative xp at level start
  let t = 0;
  for (let i = 1; i < level; i++) t += xpForLevel(i);
  return t;
}
function rankFor(level) {
  let r = RANKS[0].name;
  for (const x of RANKS) if (level >= x.lv) r = x.name;
  if (S.bosses.b2 && level < 15) r = 'Disciplined Warrior';
  return r;
}

/** Branch levels use the same shape as character levels, one curve per tree. */
const branchNeed = (lv) => 50 + (lv - 1) * 45;
function branchLevel(id) {
  let xp = (S.branches[id] || 0) + (S.spent[id] || 0) * 150;
  let lv = 0;
  while (lv < 30 && xp >= branchNeed(lv + 1)) { xp -= branchNeed(lv + 1); lv++; }
  return { level: lv, into: xp, need: branchNeed(lv + 1) };
}

function addXp(amount, why) {
  if (amount <= 0) return;
  S.xp += amount;
  let leveled = 0;
  while (S.xp >= levelFloor(S.level + 1) && S.level < 99) { S.level++; S.skillPoints++; leveled++; }
  if (why) toast('+' + amount + ' XP', why, 'xp');
  if (leveled) showLevelUp();
  save();
}

function addBranchXp(id, amount) {
  if (!id || amount <= 0) return;
  const before = branchLevel(id).level;
  S.branches[id] = (S.branches[id] || 0) + amount;
  const after = branchLevel(id).level;
  if (after > before) {
    const t = TREES.find((x) => x.id === id);
    const un = t.unlocks.filter(([lv]) => lv > before && lv <= after);
    toast(t.ico + ' ' + t.name + ' ' + after, un.length ? 'Unlocked: ' + un.map((u) => u[1]).join(', ') : 'Branch level up.', 'win');
  }
}

/** Run after any state change that could earn something. */
function checkAwards(ctx = {}) {
  BADGES.forEach((b) => {
    if (S.badges[b.id]) return;
    let ok = false;
    try { ok = b.test(S, ctx); } catch (e) { ok = false; }
    if (ok) {
      S.badges[b.id] = new Date().toISOString();
      toast('Badge unlocked', b.ico + '  ' + b.name, 'win');
      addXp(75, null);
      celebrate();
    }
  });
  BOSSES.forEach((bo) => {
    if (S.bosses[bo.id]) return;
    if (bo.progress(S) >= 1) {
      S.bosses[bo.id] = new Date().toISOString();
      toast('Boss defeated', bo.name + ' · ' + bo.reward, 'win');
      addXp(bo.xp, null);
      celebrate();
    }
  });
  save();
}


/* =============================================================================
   6 · FEEDBACK  — sound, vibration, toasts, confetti
   ============================================================================= */

let audioCtx = null;
function beep(freq = 660, ms = 45, type = 'square', gain = 0.05) {
  if (!S.settings.sound) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(gain, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + ms / 1000);
    o.connect(g); g.connect(audioCtx.destination);
    o.start(); o.stop(audioCtx.currentTime + ms / 1000);
  } catch (e) { /* audio is a nicety, never a blocker */ }
}
function buzz(pattern) {
  if (!S.settings.vibrate || !navigator.vibrate) return;
  try { navigator.vibrate(pattern); } catch (e) {}
}

function toast(title, body, kind = '') {
  const t = el('div', 'toast ' + kind, `<b>${title}</b>${body || ''}`);
  $('toasts').appendChild(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 260); }, 2600);
}

function showLevelUp() {
  $('luLevel').textContent = S.level;
  $('luRank').textContent = rankFor(S.level);
  const box = $('levelup');
  box.classList.remove('hidden');
  beep(880, 90); setTimeout(() => beep(1320, 140), 100);
  buzz([30, 40, 70]);
  celebrate();
  setTimeout(() => box.classList.add('hidden'), 2200);
}

/* Lightweight canvas confetti — a few dozen rectangles, then it stops itself. */
function celebrate() {
  if (!S.settings.confetti) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const cv = $('confetti');
  const ctx = cv.getContext('2d');
  cv.width = innerWidth; cv.height = innerHeight;
  cv.classList.add('on');
  const colors = ['#E4C240', '#6C5CE7', '#F2EFE6', '#4ADE9B'];
  const bits = Array.from({ length: 60 }, () => ({
    x: innerWidth / 2 + (Math.random() - 0.5) * 160,
    y: innerHeight * 0.42,
    vx: (Math.random() - 0.5) * 7,
    vy: -6 - Math.random() * 6,
    w: 4 + Math.random() * 5, h: 7 + Math.random() * 7,
    r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3,
    c: colors[(Math.random() * colors.length) | 0]
  }));
  let frames = 0;
  (function tick() {
    ctx.clearRect(0, 0, cv.width, cv.height);
    bits.forEach((b) => {
      b.vy += 0.28; b.x += b.vx; b.y += b.vy; b.r += b.vr;
      ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.r);
      ctx.fillStyle = b.c; ctx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h); ctx.restore();
    });
    if (++frames < 120) requestAnimationFrame(tick);
    else { ctx.clearRect(0, 0, cv.width, cv.height); cv.classList.remove('on'); }
  })();
}


/* =============================================================================
   7 · WORKOUT  — the tally ring runner
   ============================================================================= */

const MODES = {
  normal:   { xp: 1.0, hint: 'Tap at the top of every rep' },
  nose:     { xp: 1.5, hint: 'Touch the circle with your nose at the bottom' },
  weighted: { xp: 2.0, hint: 'Loaded reps — minimum 20 to count' }
};

let W = null;          // live workout, mirrored into S.active
let restTimer = null;

function startWorkout(mode = 'normal') {
  const built = buildPlan();
  W = {
    day: built.day, cycle: built.cycle.n, total: built.total,
    sets: built.plan.map((p) => ({ ex: p.ex, reps: p.reps, done: 0 })),
    idx: 0, mode, weight: mode === 'weighted' ? S.weight.current : 0,
    startedAt: new Date().toISOString()
  };
  S.active = W; save();
  paintTrain();
  go('train');
}

function resumeWorkout() {
  if (!S.active) return false;
  // Abandon anything left over from a previous day.
  if (S.active.day !== S.day) { S.active = null; save(); return false; }
  W = S.active;
  paintTrain();
  return true;
}

function repsDone() { return W ? sum(W.sets.map((s) => s.done)) : 0; }

function tapRep(dir = 1) {
  if (!W) return;
  const set = W.sets[W.idx];
  const next = clamp(set.done + dir, 0, set.reps);
  if (next === set.done) {
    if (dir > 0) { buzz(6); }             // already at target — nudge to close the set
    return;
  }
  set.done = next;

  if (dir > 0) {
    beep(520 + set.done * 6, 32);
    buzz(12);
    flashTick(set.done - 1);
    $('burst').classList.remove('go'); void $('burst').offsetWidth; $('burst').classList.add('go');
    floatXp('+' + Math.round(MODES[W.mode].xp) + ' XP');
    const tp = $('tapper');
    tp.classList.add('press'); setTimeout(() => tp.classList.remove('press'), 90);
  }

  save();
  paintTrainCounts();

  if (set.done >= set.reps) {
    beep(880, 120, 'triangle'); buzz([25, 45, 25]);
    setTimeout(completeSet, 260);
  }
}

function completeSet() {
  if (!W) return;
  const last = W.idx >= W.sets.length - 1;
  if (last) return finishWorkout();
  W.idx++;
  save();
  startRest();
}

function startRest() {
  const nextEx = EX[W.sets[W.idx].ex].name;
  $('restNext').textContent = 'Up next: ' + nextEx + ' · ' + W.sets[W.idx].reps + ' reps';
  let left = 60;
  $('restN').textContent = left;
  $('rest').classList.remove('hidden');
  clearInterval(restTimer);
  restTimer = setInterval(() => {
    left--;
    $('restN').textContent = left;
    if (left <= 3 && left > 0) beep(600, 50);
    if (left <= 0) endRest();
  }, 1000);
}
function endRest() {
  clearInterval(restTimer);
  $('rest').classList.add('hidden');
  beep(880, 90);
  paintTrain();
}

function finishWorkout() {
  clearInterval(restTimer);
  $('rest').classList.add('hidden');
  askDifficulty();
}

/** Commit the session: xp, streak, records, badges, next prescription. */
function logWorkout(diff) {
  const session = repsDone();
  const mult = MODES[W.mode].xp;
  const exercises = W.sets.filter((s) => s.done > 0).map((s) => s.ex);
  const record = session > S.records.bestSession;

  // --- xp ---
  let gained = Math.round(session * mult) + 50;
  S.totalPushups += session;
  S.records.bestSession = Math.max(S.records.bestSession, session);

  // --- branch xp, routed by the movement actually performed ---
  W.sets.forEach((s) => {
    if (s.done > 0) addBranchXp(EX[s.ex].tree, s.done);
  });
  addBranchXp('endurance', Math.floor(session / 2));   // volume always feeds endurance

  // --- streak ---
  const today = dayKey();
  if (S.lastWorkoutDate !== today) {
    S.streak = (S.lastWorkoutDate && daysBetween(S.lastWorkoutDate, today) === 1) ? S.streak + 1 : 1;
    S.lastWorkoutDate = today;
    S.bestStreak = Math.max(S.bestStreak, S.streak);
    if (S.streak > 0 && S.streak % 7 === 0) gained += 200;
    if (S.streak > 0 && S.streak % 30 === 0) gained += 1000;
    S.day += 1;
  }

  // --- weighted log ---
  if (W.mode === 'weighted' && session >= 20) {
    S.weighted.push({ date: today, weight: W.weight, reps: session });
    S.records.bestWeight = Math.max(S.records.bestWeight, W.weight);
    S.records.bestWeightedScore = Math.max(S.records.bestWeightedScore, W.weight * session);
  }

  // --- history + next prescription ---
  S.history.push({
    date: today, day: W.day, total: session, cycle: W.cycle, mode: W.mode,
    difficulty: diff.n, xp: gained,
    sets: W.sets.map((s) => ({ ex: s.ex, reps: s.done }))
  });

  /* Plateau breaker. "Good" holds the volume, which is correct once — but three
     comfortable sessions in a row means the body has adapted and the coach should
     say so rather than leaving someone at forty reps forever. */
  let volMult = diff.mult;
  S.hold = (diff.n === 3) ? (S.hold || 0) + 1 : 0;
  if (S.hold >= 3) {
    volMult = 1.05;
    S.hold = 0;
    toast('Plateau broken', 'Three steady sessions. Volume goes up 5%.', 'win');
  }

  S.total = nextTotal(S.total, volMult, S.day);
  S.sets = setsFor(S.total);
  if (S.quests && S.quests.date === today) S.quests.main = true;

  // --- cycle boundary report ---
  maybeWriteSummary();

  S.active = null; W = null;
  save();

  addXp(gained, 'Session logged');
  checkAwards({ session, exercises });
  if (record && session > 0) toast('Record', pickOne(COPY.record), 'win');

  showRecap(session, gained, diff, record);
  paintAll();
  go('today');
}

/** Generate a report the first time we land in a new cycle. */
function maybeWriteSummary() {
  const cy = cycleFor(S.day);
  const done = S.summaries.some((x) => x.cycle === cy.n - 1);
  if (cy.n <= 1 || done) return;
  const prev = CYCLES[cy.n - 2];
  const rows = S.history.filter((h) => h.cycle === prev.n);
  if (!rows.length) return;
  const totals = rows.map((r) => r.total);
  S.summaries.push({
    cycle: prev.n, name: prev.name, sessions: rows.length,
    reps: sum(totals),
    first: totals[0], best: Math.max(...totals),
    avg: Math.round(sum(totals) / rows.length),
    unlocked: TREES.flatMap((t) => t.unlocks.filter(([lv]) => lv <= branchLevel(t.id).level).map((u) => u[1])),
    nextAdvice: cy.next
  });
}


/* =============================================================================
   8 · RENDER
   ============================================================================= */

function paintAll() {
  auditStreak();
  paintTop(); paintToday(); paintTrain(); paintPath(); paintStats(); paintYou();
}

/* ---------- top bar ---------- */
function paintTop() {
  $('tbLevel').textContent = S.level;
  $('tbRank').textContent = rankFor(S.level);
  $('tbStreakN').textContent = S.streak;
  $('tbStreak').classList.toggle('cold', S.streak === 0);
  const lo = levelFloor(S.level), hi = levelFloor(S.level + 1);
  $('tbXpFill').style.width = clamp(((S.xp - lo) / (hi - lo)) * 100, 0, 100) + '%';
}

/* ---------- today ---------- */
function paintToday() {
  const today = dayKey();
  const trainedToday = S.lastWorkoutDate === today;
  const b = buildPlan();

  $('todayDate').textContent = prettyDate(today);
  $('todayDayNo').textContent = S.day;
  $('todayMotto').textContent = trainedToday ? pickOne(COPY.done) : COPY.idle[S.day % COPY.idle.length];
  $('missionTotal').textContent = b.total;
  $('missionCycle').textContent = 'Cycle ' + b.cycle.n + ' · ' + b.cycle.name;
  $('missionSets').textContent = b.sets + ' sets';

  const list = $('missionSetList');
  list.innerHTML = '';
  b.plan.forEach((p, i) => {
    const li = el('li');
    li.appendChild(el('span', 'n', 'S' + (i + 1)));
    li.appendChild(el('span', 'ex', EX[p.ex].name));
    li.appendChild(el('span', 'reps', p.reps));
    list.appendChild(li);
  });

  $('btnStart').textContent = trainedToday ? 'Train again' : 'Start workout';
  $('doneNote').classList.toggle('hidden', !trainedToday);

  // evolution countdown
  const left = daysToEvolution(S.day);
  const cy = cycleFor(S.day);
  const nxt = CYCLES.find((c) => c.from > S.day);
  $('evoDays').textContent = left;
  $('evoNext').textContent = nxt ? nxt.name : 'open training';
  $('evoChange').textContent = cy.next;
  const span = nxt ? nxt.from - cy.from : 45;
  $('evoFill').style.width = clamp(((S.day - cy.from) / span) * 100, 2, 100) + '%';

  // weighted card
  $('wCurrent').textContent = S.weight.current + ' kg';
  const since = S.day - S.weight.lastBumpDay;
  $('wHint').textContent = since >= 10
    ? 'Ten days at this load. Try ' + (S.weight.current + 1) + ' kg for 20 reps today.'
    : (10 - since) + ' more days before the next load increase.';

  paintQuests();
}

function paintQuests() {
  const today = dayKey();
  if (!S.quests || S.quests.date !== today) {
    const rnd = seeded(today);
    const pool = SIDE_QUESTS.slice().sort(() => rnd() - 0.5).slice(0, 3);
    S.quests = { date: today, main: S.lastWorkoutDate === today, side: pool.map((q) => ({ ...q, done: false })) };
    save();
  }
  const ul = $('questList');
  ul.innerHTML = '';

  const main = el('li', 'q-main' + (S.quests.main ? ' done' : ''));
  main.appendChild(el('span', 'q-box', '✓'));
  main.appendChild(el('span', 'q-text', 'Complete today\'s push-up workout'));
  main.appendChild(el('span', 'q-xp', 'main'));
  ul.appendChild(main);

  S.quests.side.forEach((q) => {
    const li = el('li', q.done ? 'done' : '');
    li.appendChild(el('span', 'q-box', '✓'));
    li.appendChild(el('span', 'q-text', q.text));
    li.appendChild(el('span', 'q-xp', '+' + q.xp));
    li.addEventListener('click', () => {
      if (q.done) return;
      q.done = true; save();
      buzz(15); beep(760, 60);
      addXp(q.xp, 'Side quest cleared');
      paintQuests(); paintTop();
    });
    ul.appendChild(li);
  });
}

/* ---------- train ---------- */
function paintTrain() {
  if (!W) {
    $('trainExercise').textContent = 'No workout running';
    $('trainCue').textContent = 'Start today\'s mission from the Today tab.';
    $('trainSetLabel').textContent = 'Idle';
    $('tapCount').textContent = '0';
    $('tapTarget').textContent = '—';
    $('ringTicks').innerHTML = '';
    $('ringFill').style.strokeDashoffset = 653.45;
    $('trainFill').style.width = '0%';
    $('trainDone').textContent = '0';
    $('trainTotal').textContent = S.total;
    $('trainXp').textContent = '0';
    return;
  }
  const set = W.sets[W.idx];
  $('trainSetLabel').textContent = 'Set ' + (W.idx + 1) + ' of ' + W.sets.length +
    (W.mode === 'weighted' ? ' · ' + W.weight + ' kg' : '');
  $('trainExercise').textContent = EX[set.ex].name;
  $('trainCue').textContent = EX[set.ex].cue;
  $('tapHint').textContent = MODES[W.mode].hint;
  $('tapper').classList.toggle('nose', W.mode === 'nose');
  document.querySelectorAll('.mode-pills .pill').forEach((p) =>
    p.classList.toggle('is-on', p.dataset.mode === W.mode));
  buildTicks(set.reps);
  paintTrainCounts();
}

/** Draw one tick per prescribed rep around the ring — the set becomes a tally. */
function buildTicks(n) {
  const g = $('ringTicks');
  g.innerHTML = '';
  if (n > 40) return;                       // too many to read; the arc carries it
  for (let i = 0; i < n; i++) {
    const a = ((i + 0.5) / n) * Math.PI * 2;
    const ln = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    ln.setAttribute('x1', 120 + Math.cos(a) * 94);
    ln.setAttribute('y1', 120 + Math.sin(a) * 94);
    ln.setAttribute('x2', 120 + Math.cos(a) * 86);
    ln.setAttribute('y2', 120 + Math.sin(a) * 86);
    ln.setAttribute('class', 'tick');
    g.appendChild(ln);
  }
}
function flashTick(i) {
  const t = $('ringTicks').children[i];
  if (t) t.classList.add('lit');
}
function floatXp(text) {
  const n = el('span', 'xpfloat', text);
  document.querySelector('.ring-stage').appendChild(n);
  setTimeout(() => n.remove(), 820);
}

function paintTrainCounts() {
  if (!W) return;
  const set = W.sets[W.idx];
  $('tapCount').textContent = set.done;
  $('tapTarget').textContent = set.reps;
  $('ringFill').style.strokeDashoffset = 653.45 * (1 - set.done / set.reps);
  [...$('ringTicks').children].forEach((t, i) => t.classList.toggle('lit', i < set.done));

  const done = repsDone();
  const total = sum(W.sets.map((s) => s.reps));
  $('trainDone').textContent = done;
  $('trainTotal').textContent = total;
  $('trainFill').style.width = (done / total) * 100 + '%';
  $('trainXp').textContent = Math.round(done * MODES[W.mode].xp);
  $('btnNextSet').textContent = (W.idx >= W.sets.length - 1) ? 'Finish workout' : 'Set complete';
}

/* ---------- path ---------- */
function paintPath() {
  const lo = levelFloor(S.level), hi = levelFloor(S.level + 1);
  $('pathLevel').textContent = S.level;
  $('pathRank').textContent = rankFor(S.level);
  $('pathXp').textContent = (S.xp - lo) + ' / ' + (hi - lo) + ' XP to level ' + (S.level + 1);
  $('pathSp').textContent = S.skillPoints;
  $('pathXpFill').style.width = clamp(((S.xp - lo) / (hi - lo)) * 100, 0, 100) + '%';
  $('pathStage').textContent = 'Evolution stage: ' + cycleFor(S.day).stage + ' · day ' + S.day;

  // --- skill trees ---
  const box = $('trees');
  box.innerHTML = '';
  TREES.forEach((t) => {
    const b = branchLevel(t.id);
    const card = el('div', 'tree');
    const head = el('div', 'tree-head');
    head.appendChild(el('span', 'tree-ico', t.ico));
    head.appendChild(el('span', 'tree-name', t.name));
    head.appendChild(el('span', 'tree-lvl', 'LV ' + b.level));
    card.appendChild(head);
    card.appendChild(el('p', 'fine', t.how));
    const tr = el('div', 'track');
    const fill = el('i');
    fill.style.width = (b.into / b.need) * 100 + '%';
    tr.appendChild(fill); card.appendChild(tr);

    const ul = el('ul', 'unlocks');
    t.unlocks.forEach(([lv, name]) => {
      const li = el('li', lv <= b.level ? 'open' : '');
      li.appendChild(el('span', 'u-lv', 'LV' + lv));
      li.appendChild(el('span', '', name));
      ul.appendChild(li);
    });
    card.appendChild(ul);

    const spend = el('button', 'btn-sp', 'Spend 1 skill point');
    spend.disabled = S.skillPoints < 1;
    spend.addEventListener('click', () => {
      if (S.skillPoints < 1) return;
      S.skillPoints--; S.spent[t.id] = (S.spent[t.id] || 0) + 1;
      beep(700, 70); buzz(20); save(); paintPath(); paintTop();
      toast('Skill point spent', t.name + ' branch pushed forward.', 'win');
    });
    card.appendChild(spend);
    box.appendChild(card);
  });

  // --- bosses ---
  const bb = $('bosses');
  bb.innerHTML = '';
  BOSSES.forEach((bo) => {
    const beaten = !!S.bosses[bo.id];
    const p = beaten ? 1 : bo.progress(S);
    const c = el('div', 'boss' + (beaten ? ' beaten' : ''));
    c.appendChild(el('p', 'boss-name', bo.name));
    c.appendChild(el('p', 'boss-req', bo.req));
    const tr = el('div', 'track'); const f = el('i');
    f.style.width = p * 100 + '%'; tr.appendChild(f); c.appendChild(tr);
    const foot = el('div', 'boss-foot');
    foot.appendChild(el('span', 'boss-reward', bo.reward));
    foot.appendChild(el('span', 'boss-state', beaten ? 'Defeated' : Math.round(p * 100) + '%'));
    c.appendChild(foot);
    bb.appendChild(c);
  });

  // --- journey map ---
  const j = $('journey');
  j.innerHTML = '';
  CYCLES.forEach((c, i) => {
    const nxt = CYCLES[i + 1];
    const here = S.day >= c.from && (!nxt || S.day < nxt.from);
    const li = el('li', here ? 'here' : (S.day >= c.from ? 'reached' : ''));
    li.appendChild(el('span', 'j-day', 'Day ' + c.from));
    li.appendChild(el('b', 'j-name', c.stage));
    li.appendChild(el('span', 'j-note',
      here ? 'You are here — ' + Math.round(((S.day - c.from) / ((nxt ? nxt.from : c.from + 45) - c.from)) * 100) + '% through this cycle'
           : c.pool.slice(0, 3).map((x) => EX[x].name).join(', ')));
    j.appendChild(li);
  });

  // --- badges ---
  const bd = $('badges');
  bd.innerHTML = '';
  BADGES.forEach((b) => {
    const got = S.badges[b.id];
    const c = el('div', 'badge' + (got ? ' got' : ''));
    c.appendChild(el('span', 'badge-ico', b.ico));
    c.appendChild(el('span', 'badge-name', b.name));
    c.appendChild(el('span', 'badge-date', got ? dayKey(new Date(got)) : 'locked'));
    bd.appendChild(c);
  });
}

/* ---------- stats ---------- */
function paintStats() {
  const h = S.history;
  const avg = h.length ? Math.round(sum(h.map((x) => x.total)) / h.length) : 0;

  const stats = [
    ['Total push-ups', S.totalPushups.toLocaleString()],
    ['Average session', avg],
    ['Best session', S.records.bestSession],
    ['Longest streak', S.bestStreak],
    ['Current level', S.level],
    ['Evolution cycle', cycleFor(S.day).n + ' / 5'],
    ['Sessions logged', h.length],
    ['Heaviest load', S.records.bestWeight + ' kg']
  ];
  const g = $('statGrid');
  g.innerHTML = '';
  stats.forEach(([k, v]) => {
    const c = el('div', 'stat');
    c.appendChild(el('span', 'stat-v', v));
    c.appendChild(el('span', 'stat-k', k));
    g.appendChild(c);
  });

  drawChart($('chartWeek'), 7, true);
  drawChart($('chartMonth'), 30, false);

  // exercise report — where the work went and how hard it felt
  const map = {};
  h.forEach((row) => {
    row.sets.forEach((s) => {
      map[s.ex] = map[s.ex] || { reps: 0, diff: 0, n: 0 };
      map[s.ex].reps += s.reps;
      map[s.ex].diff += row.difficulty || 3;
      map[s.ex].n++;
    });
  });
  const ul = $('exReport');
  ul.innerHTML = '';
  const rows = Object.entries(map).sort((a, b) => b[1].reps - a[1].reps);
  if (!rows.length) {
    ul.appendChild(el('li', '', '<span class="ex-name">Nothing logged yet. Your first session fills this in.</span>'));
  }
  rows.forEach(([id, v]) => {
    const d = v.diff / v.n;
    const li = el('li');
    li.appendChild(el('span', 'ex-name', EX[id] ? EX[id].name : id));
    li.appendChild(el('span', 'ex-reps', v.reps + ' reps'));
    li.appendChild(el('span', 'ex-diff ' + (d >= 4 ? 'hard' : d <= 2.2 ? 'easy' : ''),
      d >= 4 ? 'weak point' : d <= 2.2 ? 'strong point' : 'steady'));
    ul.appendChild(li);
  });

  // cycle summaries
  const cs = $('cycleSummaries');
  cs.innerHTML = '';
  if (!S.summaries.length) {
    cs.appendChild(el('p', 'empty', 'A report is written every time you clear a 45 day cycle.'));
  }
  S.summaries.slice().reverse().forEach((s) => {
    const c = el('div', 'summary');
    c.appendChild(el('h4', '', 'Cycle ' + s.cycle + ' · ' + s.name));
    const ul2 = el('ul');
    [
      s.sessions + ' sessions, ' + s.reps.toLocaleString() + ' total push-ups',
      'Session volume moved from ' + s.first + ' to a best of ' + s.best + ' (average ' + s.avg + ')',
      'Skills open: ' + (s.unlocked.length ? s.unlocked.join(', ') : 'none yet'),
      'Next: ' + s.nextAdvice
    ].forEach((t) => ul2.appendChild(el('li', '', t)));
    c.appendChild(ul2);
    cs.appendChild(c);
  });

  // history
  const hl = $('history');
  hl.innerHTML = '';
  if (!h.length) hl.appendChild(el('p', 'empty', 'No sessions yet. The first one is 40 reps.'));
  h.slice(-30).reverse().forEach((row) => {
    const li = el('li');
    li.appendChild(el('span', 'h-date', prettyDate(row.date)));
    const m = el('div', 'h-main');
    m.appendChild(el('span', 'h-total', row.total + ' reps'));
    m.appendChild(el('span', 'h-ex', row.sets.map((s) => EX[s.ex] ? EX[s.ex].name : s.ex).join(' · ')));
    li.appendChild(m);
    li.appendChild(el('span', 'h-diff', (DIFFICULTY[(row.difficulty || 3) - 1] || {}).label || ''));
    hl.appendChild(li);
  });
}

/** Bars for the last N days, rest days included so gaps are visible. */
function drawChart(node, days, labels) {
  node.innerHTML = '';
  const today = dayKey();
  const byDate = {};
  S.history.forEach((h) => { byDate[h.date] = (byDate[h.date] || 0) + h.total; });
  const series = [];
  for (let i = days - 1; i >= 0; i--) {
    const k = keyShift(today, -i);
    series.push({ k, v: byDate[k] || 0 });
  }
  const max = Math.max(10, ...series.map((s) => s.v));
  series.forEach((s, i) => {
    const b = el('div', 'bar' + (s.v === 0 ? ' off' : (i === series.length - 1 ? ' hot' : '')));
    const bar = el('i');
    bar.style.height = clamp((s.v / max) * 100, 1.5, 100) + '%';
    bar.title = s.k + ' · ' + s.v + ' reps';
    b.appendChild(bar);
    if (labels) b.appendChild(el('span', '', s.k.slice(8) + '/' + s.k.slice(5, 7)));
    node.appendChild(b);
  });
}

/* ---------- you ---------- */
function paintYou() {
  const p = S.profile;
  $('pName').value = p.name; $('pAge').value = p.age;
  $('pHeight').value = p.height; $('pWeight').value = p.weight; $('pFat').value = p.bodyFat;

  const bmi = p.weight / Math.pow(p.height / 100, 2);
  const lean = p.weight * (1 - p.bodyFat / 100);
  $('profileMeta').textContent =
    'BMI ' + bmi.toFixed(1) + ' · lean mass ≈ ' + lean.toFixed(1) + ' kg · training since ' + prettyDate(S.startDate);

  $('sSound').checked = S.settings.sound;
  $('sVibrate').checked = S.settings.vibrate;
  $('sConfetti').checked = S.settings.confetti;
  $('sReminder').value = S.settings.reminder;
  $('version').textContent = 'Push Evolution 100+ · local save v' + S.version + ' · ' + S.history.length + ' sessions stored';

  const log = $('healthLog');
  log.innerHTML = '';
  S.health.slice(-8).reverse().forEach((h) => {
    const li = el('li');
    li.appendChild(el('span', '', prettyDate(h.date)));
    li.appendChild(el('span', '', [
      h.weight ? h.weight + ' kg' : null,
      h.waist ? h.waist + ' cm' : null,
      h.energy ? 'E' + h.energy : null,
      h.sleep ? 'S' + h.sleep : null
    ].filter(Boolean).join(' · ')));
    log.appendChild(li);
  });
}


/* =============================================================================
   9 · SHEETS
   ============================================================================= */

let sheetLocked = false;

/** `lock` means the sheet demands an answer — a finished session must be rated
    before it can be logged, so tapping the backdrop must not throw the reps away. */
function openSheet(html, build, lock = false) {
  sheetLocked = lock;
  $('sheetInner').innerHTML = html;
  $('sheet').classList.remove('hidden');
  $('sheetBg').classList.remove('hidden');
  if (build) build($('sheetInner'));
}
function closeSheet(force = false) {
  if (sheetLocked && !force) return;
  sheetLocked = false;
  $('sheet').classList.add('hidden');
  $('sheetBg').classList.add('hidden');
}

function askDifficulty() {
  openSheet(`<h3>How was today's difficulty?</h3>
    <p>Your answer sets tomorrow's volume. Be honest — the coach cannot see you.</p>
    <div class="diff-list" id="diffList"></div>`, (root) => {
    const list = root.querySelector('#diffList');
    DIFFICULTY.forEach((d) => {
      const b = el('button', 'diff');
      b.appendChild(el('span', 'diff-n', d.n));
      b.appendChild(el('span', 'diff-t', d.label));
      b.appendChild(el('span', 'diff-e', d.effect));
      b.addEventListener('click', () => { closeSheet(true); logWorkout(d); });
      list.appendChild(b);
    });
  }, true);
}

function showRecap(session, xp, diff, record) {
  const b = buildPlan();
  openSheet(`<h3>${record ? 'New limit destroyed' : 'Mission complete'}</h3>
    <p>${session} push-ups · +${xp} XP · rated “${diff.label}”.</p>
    <div class="card" style="margin:0 0 8px">
      <span class="label">Next session</span>
      <p style="margin:0;color:var(--chalk);font-size:15px">
        <b style="font-family:var(--mono);font-size:22px;color:var(--citrine)">${b.total}</b> push-ups across ${b.sets} sets
      </p>
      <p class="fine">${b.plan.map((p) => EX[p.ex].name + ' ' + p.reps).join(' · ')}</p>
    </div>
    <button class="btn btn-primary" id="recapOk">Close</button>`,
    (root) => root.querySelector('#recapOk').addEventListener('click', closeSheet));
}

function weightedSheet() {
  const suggested = S.weight.current;
  openSheet(`<h3>Log a weighted set</h3>
    <p>Minimum 20 reps for the set to count toward the strength tree.</p>
    <div class="form-grid">
      <label style="grid-column:auto">Load (kg)<input type="number" id="wKg" inputmode="decimal" step="0.5" value="${suggested}"></label>
      <label style="grid-column:auto">Reps<input type="number" id="wReps" inputmode="numeric" value="20"></label>
    </div>
    <button class="btn btn-primary" id="wSave">Save set</button>
    <button class="btn btn-ghost" id="wCancel">Cancel</button>`, (root) => {
    root.querySelector('#wCancel').addEventListener('click', closeSheet);
    root.querySelector('#wSave').addEventListener('click', () => {
      const kg = parseFloat(root.querySelector('#wKg').value) || 0;
      const reps = parseInt(root.querySelector('#wReps').value, 10) || 0;
      if (reps < 20) { toast('Not counted', 'A weighted set needs at least 20 reps.'); return; }
      S.weighted.push({ date: dayKey(), weight: kg, reps });
      S.totalPushups += reps;
      S.records.bestWeight = Math.max(S.records.bestWeight, kg);
      S.records.bestWeightedScore = Math.max(S.records.bestWeightedScore, kg * reps);
      if (kg > S.weight.current) { S.weight.current = kg; S.weight.lastBumpDay = S.day; }
      addBranchXp('strength', reps * 2);
      addXp(reps * 2, 'Weighted set logged');
      checkAwards({ session: reps, exercises: ['weighted'] });
      closeSheet(); paintAll();
    });
  });
}

function confirmSheet(title, body, okText, onOk) {
  openSheet(`<h3>${title}</h3><p>${body}</p>
    <button class="btn btn-danger" id="cfOk">${okText}</button>
    <button class="btn btn-ghost" id="cfNo">Keep everything</button>`, (root) => {
    root.querySelector('#cfNo').addEventListener('click', closeSheet);
    root.querySelector('#cfOk').addEventListener('click', () => { closeSheet(); onOk(); });
  });
}


/* =============================================================================
   10 · HEALTH + REMINDERS
   ============================================================================= */

function saveHealth() {
  const row = {
    date: dayKey(),
    weight: parseFloat($('hWeight').value) || null,
    waist: parseFloat($('hWaist').value) || null,
    energy: clamp(parseInt($('hEnergy').value, 10) || 0, 0, 5) || null,
    sleep: clamp(parseInt($('hSleep').value, 10) || 0, 0, 5) || null
  };
  if (!row.weight && !row.waist && !row.energy && !row.sleep) {
    toast('Nothing to save', 'Fill at least one field.');
    return;
  }
  S.health = S.health.filter((h) => h.date !== row.date);
  S.health.push(row);
  if (row.weight) S.profile.weight = row.weight;
  save();
  ['hWeight', 'hWaist', 'hEnergy', 'hSleep'].forEach((id) => ($(id).value = ''));
  addXp(15, 'Check-in saved');
  paintYou(); paintTop();
}

let reminderTimer = null;
function scheduleReminder() {
  clearTimeout(reminderTimer);
  if (!S.settings.notify || Notification.permission !== 'granted') return;
  const [h, m] = (S.settings.reminder || '18:00').split(':').map(Number);
  const now = new Date();
  const at = new Date();
  at.setHours(h, m, 0, 0);
  if (at <= now) at.setDate(at.getDate() + 1);
  reminderTimer = setTimeout(() => {
    if (S.lastWorkoutDate !== dayKey()) fireReminder();
    scheduleReminder();
  }, at - now);
}
function fireReminder() {
  const body = 'Your evolution mission awaits — ' + S.total + ' push-ups, ' + S.sets + ' sets.';
  try {
    if (navigator.serviceWorker && navigator.serviceWorker.ready) {
      navigator.serviceWorker.ready.then((reg) =>
        reg.showNotification('Push Evolution 100+', { body, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', tag: 'pe-daily' }));
    } else {
      new Notification('Push Evolution 100+', { body, icon: 'icons/icon-192.png' });
    }
  } catch (e) { /* notifications are optional */ }
}


/* =============================================================================
   11 · BOOT
   ============================================================================= */

function go(name) {
  document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('is-active', s.id === 'screen-' + name));
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('is-on', t.dataset.screen === name));
  window.scrollTo(0, 0);
}

function wire() {
  /* tabs */
  document.querySelectorAll('.tab').forEach((t) =>
    t.addEventListener('click', () => { go(t.dataset.screen); buzz(8); }));

  /* today */
  $('btnStart').addEventListener('click', () => {
    if (W) { go('train'); return; }
    startWorkout('normal');
    toast('Workout started', 'Tap the circle once per repetition.');
  });
  $('btnWeighted').addEventListener('click', weightedSheet);

  /* train */
  const tapper = $('tapper');
  // pointerdown gives us nose taps, finger taps and mouse in one handler
  tapper.addEventListener('pointerdown', (e) => { e.preventDefault(); tapRep(1); });
  tapper.addEventListener('keydown', (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); tapRep(1); } });
  $('btnMinus').addEventListener('click', () => tapRep(-1));
  $('btnNextSet').addEventListener('click', () => { if (W) completeSet(); });
  $('btnSkipRest').addEventListener('click', endRest);
  $('btnQuit').addEventListener('click', () => {
    if (!W) { go('today'); return; }
    confirmSheet('Leave this workout?', 'Reps already counted are kept and the workout stays open — you can come back to it today.',
      'Leave workout', () => go('today'));
  });
  document.querySelectorAll('.mode-pills .pill').forEach((p) =>
    p.addEventListener('click', () => {
      const mode = p.dataset.mode;
      if (!W) { startWorkout(mode); return; }
      if (repsDone() > 0) { toast('Mode locked', 'Finish or leave this session before switching mode.'); return; }
      W.mode = mode;
      if (mode === 'weighted') W.weight = S.weight.current;
      save(); paintTrain();
    }));

  /* you */
  $('btnSaveProfile').addEventListener('click', () => {
    S.profile = {
      name: $('pName').value.trim() || 'Push Evolution Warrior',
      age: clamp(parseInt($('pAge').value, 10) || 35, 10, 99),
      height: clamp(parseFloat($('pHeight').value) || 170, 100, 230),
      weight: clamp(parseFloat($('pWeight').value) || 82, 30, 250),
      bodyFat: clamp(parseFloat($('pFat').value) || 25, 3, 60)
    };
    save(); paintYou();
    toast('Profile saved', 'The coach has your numbers.');
  });
  $('btnSaveHealth').addEventListener('click', saveHealth);

  $('sSound').addEventListener('change', (e) => { S.settings.sound = e.target.checked; save(); if (e.target.checked) beep(760, 60); });
  $('sVibrate').addEventListener('change', (e) => { S.settings.vibrate = e.target.checked; save(); if (e.target.checked) buzz(25); });
  $('sConfetti').addEventListener('change', (e) => { S.settings.confetti = e.target.checked; save(); });
  $('sReminder').addEventListener('change', (e) => { S.settings.reminder = e.target.value; save(); scheduleReminder(); });

  $('btnNotify').addEventListener('click', async () => {
    if (!('Notification' in window)) { $('notifyState').textContent = 'This browser has no notification support.'; return; }
    const res = await Notification.requestPermission();
    S.settings.notify = res === 'granted';
    save(); scheduleReminder();
    $('notifyState').textContent = S.settings.notify
      ? 'Reminder set for ' + S.settings.reminder + ' on days you have not trained.'
      : 'Notifications are blocked. Enable them for this app in browser settings.';
  });

  /* data */
  $('btnExport').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' });
    const a = el('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'push-evolution-' + dayKey() + '.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  });
  $('btnImport').addEventListener('click', () => $('fileImport').click());
  $('fileImport').addEventListener('change', (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const data = JSON.parse(r.result);
        if (!data || typeof data.day !== 'number') throw new Error('shape');
        S = Object.assign(freshState(), data);
        save(); W = null; resumeWorkout(); paintAll();
        toast('Backup restored', S.history.length + ' sessions loaded.', 'win');
      } catch (err) {
        toast('Import failed', 'That file is not a Push Evolution backup.');
      }
    };
    r.readAsText(f);
    e.target.value = '';
  });
  $('btnReset').addEventListener('click', () =>
    confirmSheet('Erase everything?', 'Every session, badge and level is deleted from this device. This cannot be undone — export a backup first if you want one.',
      'Erase everything', () => { localStorage.removeItem(KEY); S = freshState(); W = null; save(); paintAll(); go('today'); toast('Data erased', 'Day 1 again.'); }));

  /* overlays */
  $('sheetBg').addEventListener('click', closeSheet);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSheet(); });
}

/* install prompt */
let deferredInstall = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstall = e;
  $('btnInstall').classList.remove('hidden');
});
document.addEventListener('click', (e) => {
  if (e.target && e.target.id === 'btnInstall' && deferredInstall) {
    deferredInstall.prompt();
    deferredInstall.userChoice.finally(() => {
      deferredInstall = null;
      $('btnInstall').classList.add('hidden');
    });
  }
});

/* service worker */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () =>
    navigator.serviceWorker.register('service-worker.js').catch((e) => console.warn('SW registration failed', e)));
}

/* keep the ring honest if the tab was left open overnight */
document.addEventListener('visibilitychange', () => { if (!document.hidden) { auditStreak(); paintTop(); paintToday(); } });

/* go */
wire();
auditStreak();
resumeWorkout();
paintAll();
scheduleReminder();

/* manifest shortcuts land on a specific screen */
(function openFromShortcut() {
  const want = new URLSearchParams(location.search).get('screen');
  if (!want || !$('screen-' + want)) return;
  if (want === 'train' && !W) startWorkout('normal');
  else go(want);
})();
