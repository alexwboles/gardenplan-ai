#!/bin/bash
# GardenPlan e2e tests — full user flows through the logic engine.
set -u
DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$DIR"
node << 'NODEEOF'
const G = require('/home/hatch/workspace/gardenplan-ai/js/garden.js');
const GD = require('/home/hatch/workspace/gardenplan-ai/js/data.js');
let pass = 0, fail = 0;
const ok  = (n) => { pass++; console.log('PASS: ' + n); };
const bad = (n) => { fail++; console.log('FAIL: ' + n); };
const byName = G.plantsByName(GD.PLANTS);

// Flow 1: zone 5 gardener, frost 2026-04-20, full pepper schedule
const frost = G.frostDate('5', 2026, GD.ZONE_FROST);
const ps = G.scheduleFor(byName['Bell Pepper'], frost);
(G.toISO(frost) === '2026-04-20' && ps.indoorStart === '2026-02-23' && ps.transplant === '2026-05-11')
  ? ok('flow1: zone 5 frost 2026-04-20; pepper indoor 2026-02-23, transplant 2026-05-11')
  : bad('flow1: ' + G.toISO(frost) + ' ' + JSON.stringify(ps));

// Flow 2: fall-planted garlic — sow 20 weeks pre-frost lands in fall 2025
const gs = G.scheduleFor(byName['Garlic'], frost);
(gs.sow === '2025-12-01')
  ? ok('flow2: garlic sow 2025-12-01 (fall planting for next summer)') : bad('flow2: ' + gs.sow);

// Flow 3: plant three things today, reminders cover water + feed + harvest window
let plantings = [];
const today = G.todayISO();
G.addPlanting(plantings, { plantName: 'Zucchini', date: today, method: 'sow', qty: 2 }, byName);
G.addPlanting(plantings, { plantName: 'Basil', date: today, method: 'transplant', qty: 4 }, byName);
// backdate a tomato so its harvest window is open now
const plantedAgo = G.toISO(G.addDays(G.parseISO(today), -(byName['Tomato'].harvest - 3)));
G.addPlanting(plantings, { plantName: 'Tomato', date: plantedAgo, method: 'transplant', qty: 2 }, byName);
const rem = G.reminders(plantings, byName, today, 14, GD.WATER_INTERVAL, GD.FERTILIZE_DAYS);
const kinds = {};
rem.forEach(r => { kinds[r.kind] = (kinds[r.kind] || 0) + 1; });
(kinds.water >= 6 && kinds.feed >= 1 && kinds.harvest >= 1)
  ? ok('flow3: reminders mix water(' + kinds.water + ') feed(' + (kinds.feed||0) + ') harvest(' + (kinds.harvest||0) + ')')
  : bad('flow3 kinds: ' + JSON.stringify(kinds));
// sorted by date
let sorted = true;
rem.forEach((r, i) => { if (i && rem[i-1].date > r.date) sorted = false; });
sorted ? ok('flow3b: reminders sorted by date') : bad('flow3b order');

// Flow 4: harvest logging end-to-end with mixed units
let harvests = [];
const zuc = plantings[0];
G.addHarvest(harvests, { plantingId: zuc.id, date: today, qty: '4', unit: 'count' }, plantings);
G.addHarvest(harvests, { plantingId: zuc.id, date: today, qty: '2.5', unit: 'lbs' }, plantings);
G.addHarvest(harvests, { plantingId: zuc.id, date: today, qty: '3', unit: 'count' }, plantings);
const t = G.harvestTotals(harvests);
(t['Zucchini'].entries === 3 && t['Zucchini'].qty === 9.5 && t['Zucchini'].unit === 'count')
  ? ok('flow4: zucchini 9.5 total over 3 entries, most-common unit "count"') : bad('flow4: ' + JSON.stringify(t['Zucchini']));

// Flow 5: remove a planting; its future tasks disappear
G.deletePlanting(plantings, plantings[1].id);
const remAfter = G.reminders(plantings, byName, today, 14, GD.WATER_INTERVAL, GD.FERTILIZE_DAYS);
const basilTasks = remAfter.filter(r => /Basil/.test(r.text));
(basilTasks.length === 0 && plantings.length === 2)
  ? ok('flow5: deleted planting produces zero future tasks') : bad('flow5: ' + basilTasks.length + ' basil tasks remain');
G.deletePlanting(plantings, 'missing') === false
  ? ok('flow5b: deleting unknown planting returns false') : bad('flow5b');

// Flow 6: frost override — custom date drives the whole calendar
const custom = G.parseISO('2026-03-15');
const cs = G.scheduleFor(byName['Lettuce'], custom);
(cs.sow === '2026-02-15')
  ? ok('flow6: custom frost 2026-03-15 -> lettuce sow 2026-02-15') : bad('flow6: ' + cs.sow);

// Flow 7: persistence round-trip of settings + plantings + harvests
G.storageSet('settings', { zone: '5', frost: '', plot: '2 beds' });
G.storageSet('plantings', plantings);
G.storageSet('harvests', harvests);
(G.storageGet('settings', {}).zone === '5' &&
 G.storageGet('plantings', []).length === 2 &&
 G.storageGet('harvests', []).length === 3)
  ? ok('flow7: settings/plantings/harvests survive storage round-trip') : bad('flow7');

// Flow 8: month labels render nicely
(G.monthLabel('2026-04-15') === 'Apr 15' && G.monthLabel('2026-12-01') === 'Dec 1')
  ? ok('flow8: month labels "Apr 15" / "Dec 1"') : bad('flow8: ' + G.monthLabel('2026-04-15'));

console.log('---');
console.log('e2e: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
NODEEOF
