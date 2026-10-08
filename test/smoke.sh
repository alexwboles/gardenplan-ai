#!/bin/bash
# GardenPlan smoke tests — file presence, syntax, core logic sanity.
set -u
DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$DIR"
PASS=0; FAIL=0
ok()   { PASS=$((PASS+1)); echo "PASS: $1"; }
bad()  { FAIL=$((FAIL+1)); echo "FAIL: $1"; }

# 1. expected files exist
for f in index.html css/style.css js/data.js js/garden.js js/app.js README.md test/e2e.sh; do
  [ -f "$f" ] && ok "file exists: $f" || bad "missing file: $f"
done

# 2. JS syntax valid
for f in js/data.js js/garden.js js/app.js; do
  node --check "$f" 2>/dev/null && ok "syntax ok: $f" || bad "syntax error: $f"
done

# 3. index.html wires up the scripts
grep -q 'js/data.js' index.html && grep -q 'js/garden.js' index.html && grep -q 'js/app.js' index.html \
  && ok "index.html loads data.js, garden.js, app.js" || bad "index.html missing script tags"

# 4+. logic checks via node
node << 'NODEEOF'
const G = require('/home/hatch/workspace/gardenplan-ai/js/garden.js');
const GD = require('/home/hatch/workspace/gardenplan-ai/js/data.js');
let pass = 0, fail = 0;
const ok  = (n) => { pass++; console.log('PASS: ' + n); };
const bad = (n) => { fail++; console.log('FAIL: ' + n); };

// plant bank shape
(GD.PLANTS.length >= 40 && GD.PLANTS.every(p => p.name && p.sun && p.water && p.harvest > 0))
  ? ok('plant bank: ' + GD.PLANTS.length + ' plants, all with sun/water/harvest') : bad('plant bank shape');
Object.keys(GD.ZONE_FROST).length === 13
  ? ok('zone frost table covers zones 1-13') : bad('zone table');

// every plant has at least one planting path (indoor->transplant or sow)
const noPath = GD.PLANTS.filter(p => p.transplant == null && p.sow == null);
(noPath.length === 0) ? ok('every plant has a transplant or sow path') : bad('no path: ' + noPath.map(p=>p.name).join(','));

// frost date math: zone 7, 2026 -> 2026-04-01
const f = G.frostDate('7', 2026, GD.ZONE_FROST);
(G.toISO(f) === '2026-04-01') ? ok('zone 7 frost = 2026-04-01') : bad('frost: ' + (f && G.toISO(f)));
G.frostDate('99', 2026, GD.ZONE_FROST) === null ? ok('unknown zone -> null') : bad('zone 99');

// schedule: tomato (indoor 6, transplant +2, harvest 75) from 2026-04-01
const byName = G.plantsByName(GD.PLANTS);
const s = G.scheduleFor(byName['Tomato'], f);
(s.indoorStart === '2026-02-18' && s.transplant === '2026-04-15' && s.harvestFrom === '2026-06-22')
  ? ok('tomato schedule: indoor 2026-02-18, transplant 2026-04-15, harvest from 2026-06-22')
  : bad('tomato: ' + JSON.stringify(s));
// carrot (sow -3 => before frost)
const c = G.scheduleFor(byName['Carrot'], f);
(c.sow === '2026-03-11' && c.transplant === null)
  ? ok('carrot: direct sow 2026-03-11 (3 wks pre-frost), no transplant') : bad('carrot: ' + JSON.stringify(c));

// planting validation
let plantings = [];
let badP = G.addPlanting(plantings, { plantName: 'Nope', date: 'blah', method: 'x', qty: '0' }, byName);
(!badP.ok && badP.errors.length === 4 && plantings.length === 0)
  ? ok('addPlanting rejects bad plant/date/method/qty (4 errors)') : bad('planting validation');

// reminders: tomato planted today -> watering tasks in next 14 days (medium = every 4d)
const today = G.todayISO();
G.addPlanting(plantings, { plantName: 'Tomato', date: today, method: 'transplant', qty: 2 }, byName);
const rem = G.reminders(plantings, byName, today, 14, GD.WATER_INTERVAL, GD.FERTILIZE_DAYS);
const waters = rem.filter(r => r.kind === 'water');
(waters.length >= 3 && waters.length <= 5)
  ? ok('reminders: ' + waters.length + ' waterings in 14d for medium-water plant') : bad('waterings: ' + waters.length);
// mint is high water -> every 2 days -> more tasks
let p2 = [];
G.addPlanting(p2, { plantName: 'Mint', date: today, method: 'transplant', qty: 1 }, byName);
const rem2 = G.reminders(p2, byName, today, 14, GD.WATER_INTERVAL, GD.FERTILIZE_DAYS);
(rem2.filter(r => r.kind === 'water').length >= 6)
  ? ok('high-water mint gets denser watering schedule') : bad('mint schedule');

// harvest totals
let harvests = [];
G.addHarvest(harvests, { plantingId: plantings[0].id, date: today, qty: '3.5', unit: 'lbs' }, plantings);
G.addHarvest(harvests, { plantingId: plantings[0].id, date: today, qty: '2', unit: 'lbs' }, plantings);
const t = G.harvestTotals(harvests);
(t['Tomato'] && t['Tomato'].qty === 5.5 && t['Tomato'].entries === 2 && t['Tomato'].unit === 'lbs')
  ? ok('harvest totals: Tomato 5.5 lbs over 2 entries') : bad('harvest totals');
let badH = G.addHarvest(harvests, { plantingId: 'nope', date: today, qty: '-1', unit: '' }, plantings);
(!badH.ok && badH.errors.length === 3) ? ok('addHarvest rejects bad planting/negative qty/blank unit') : bad('harvest validation');

// date utils
(G.parseISO('2026-02-29') === null && G.parseISO('2024-02-29') instanceof Date)
  ? ok('parseISO: rejects 2026-02-29, accepts leap day 2024') : bad('parseISO');
G.diffDays(G.parseISO('2026-04-01'), G.parseISO('2026-04-15')) === 14
  ? ok('diffDays 14 across two weeks') : bad('diffDays');

// storage round-trip
G.storageSet('tkey', [1, 2]);
JSON.stringify(G.storageGet('tkey', null)) === '[1,2]' ? ok('storage round-trip works') : bad('storage broken');

// finishPlanting: archives with finishedDate, removes from active
let pl3 = [];
G.addPlanting(pl3, { plantName: 'Zucchini', date: today, method: 'sow', qty: 2 }, byName);
const finRec = G.finishPlanting(pl3, pl3[0].id, today);
(finRec && finRec.finishedDate === today && pl3.length === 0 && G.finishPlanting(pl3, 'nope', today) === null)
  ? ok('finishPlanting archives with finishedDate; unknown id -> null') : bad('finishPlanting');

// daysToHarvest: label math for a fresh tomato planting (harvest 75d)
let pl4 = [];
G.addPlanting(pl4, { plantName: 'Tomato', date: today, method: 'transplant', qty: 1 }, byName);
const dh = G.daysToHarvest(pl4[0], byName, today);
(dh && dh.days === 68 && dh.label === 'harvest in ~68 days')
  ? ok('daysToHarvest: fresh tomato -> harvest in ~68 days') : bad('daysToHarvest: ' + JSON.stringify(dh));
// backdated tomato deep in window -> open now
const old = G.toISO(G.addDays(G.parseISO(today), -80));
const dh2 = G.daysToHarvest({ plantName: 'Tomato', date: old }, byName, today);
(dh2 && dh2.label === 'harvest window open now')
  ? ok('daysToHarvest: 80-day-old tomato -> window open now') : bad('daysToHarvest old: ' + JSON.stringify(dh2));

// task done-state: toggle on/off by stable key
const r0 = { date: today, kind: 'water', text: 'Water Tomato (1×)' };
const k0 = G.taskKey(r0);
let doneMap = G.toggleTaskDone({}, r0);
(doneMap[k0] && !G.toggleTaskDone(doneMap, r0)[k0])
  ? ok('toggleTaskDone toggles done state on then off') : bad('toggleTaskDone');

// CSV exports
let pl5 = [];
G.addPlanting(pl5, { plantName: 'Basil', date: today, method: 'transplant', qty: 4, notes: 'Bed A, "north"' }, byName);
const pc = G.plantingsToCSV(pl5).split('\n');
(pc[0] === 'plant,date,method,qty,notes' && pc[1] === 'Basil,' + today + ',transplant,4,"Bed A, ""north"""')
  ? ok('plantingsToCSV header + quoted row') : bad('plantingsToCSV: ' + pc[1]);
const hc = G.harvestsToCSV([{ date: today, plantName: 'Basil', qty: 2, unit: 'bunches' }]).split('\n');
(hc[0] === 'date,plant,qty,unit' && hc[1] === today + ',Basil,2,bunches')
  ? ok('harvestsToCSV header + row') : bad('harvestsToCSV');

// filterReminders narrows by kind
const remAll = G.reminders(pl4, byName, today, 14, GD.WATER_INTERVAL, GD.FERTILIZE_DAYS);
const wOnly = G.filterReminders(remAll, 'water');
(wOnly.length > 0 && wOnly.every(r => r.kind === 'water') && G.filterReminders(remAll, 'all').length === remAll.length)
  ? ok('filterReminders: water-only subset + all passthrough') : bad('filterReminders');

console.log('---');
console.log('smoke-node: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
NODEEOF
[ "$?" -eq 0 ] && ok "node logic checks all green" || bad "node logic checks failed"

echo "---"
echo "smoke: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
