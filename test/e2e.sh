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

// Flow 9: done-state on reminders — check off a watering, it stays checked
const f9list = [];
G.addPlanting(f9list, { plantName: 'Zucchini', date: G.todayISO(), method: 'sow', qty: 2 }, byName);
const f9rem = G.reminders(f9list, byName, G.todayISO(), 14, GD.WATER_INTERVAL, GD.FERTILIZE_DAYS);
const f9water = f9rem.filter(r => r.kind === 'water')[0];
const f9key = G.taskKey(f9water);
const f9done = G.toggleTaskDone({}, f9water);
(f9done[f9key] === true && G.toggleTaskDone(f9done, f9water)[f9key] === undefined)
  ? ok('flow9: checking off a watering task persists by key, toggle off clears') : bad('flow9');

// Flow 10: finish a spent planting — it leaves the active list with a finishedDate
const f10 = [];
G.addPlanting(f10, { plantName: 'Lettuce', date: G.todayISO(), method: 'sow', qty: 6 }, byName);
const f10fin = G.finishPlanting(f10, f10[0].id, G.todayISO());
(f10fin && f10fin.finishedDate === G.todayISO() && f10.length === 0)
  ? ok('flow10: finished lettuce archived, active list empty') : bad('flow10');

// Flow 11: kind filter narrows a busy care list to feedings only
const f11 = [];
const f11ago = G.toISO(G.addDays(G.parseISO(G.todayISO()), -10)); // feeds start +21d, so backdate
G.addPlanting(f11, { plantName: 'Tomato', date: f11ago, method: 'transplant', qty: 2 }, byName);
G.addPlanting(f11, { plantName: 'Zucchini', date: f11ago, method: 'sow', qty: 4 }, byName);
const f11all = G.reminders(f11, byName, G.todayISO(), 14, GD.WATER_INTERVAL, GD.FERTILIZE_DAYS);
const f11feed = G.filterReminders(f11all, 'feed');
(f11all.length > f11feed.length && f11feed.length >= 1 && f11feed.every(r => r.kind === 'feed'))
  ? ok('flow11: feed-only filter narrows ' + f11all.length + ' -> ' + f11feed.length) : bad('flow11');

// Flow 12: harvest countdown on a new planting card
const f12 = [];
G.addPlanting(f12, { plantName: 'Carrot', date: G.todayISO(), method: 'sow', qty: 12 }, byName);
const f12dh = G.daysToHarvest(f12[0], byName, G.todayISO());
(f12dh && /harvest in ~\d+ days/.test(f12dh.label))
  ? ok('flow12: carrot card shows "' + f12dh.label + '"') : bad('flow12: ' + JSON.stringify(f12dh));

// Flow 13: full CSV round-trip of plantings + harvests
const f13 = [];
G.addPlanting(f13, { plantName: 'Mint', date: G.todayISO(), method: 'transplant', qty: 1 }, byName);
const f13h = [];
G.addHarvest(f13h, { plantingId: f13[0].id, date: G.todayISO(), qty: '1.5', unit: 'lbs' }, f13);
(G.plantingsToCSV(f13).split('\n').length === 2 && G.harvestsToCSV(f13h).split('\n').length === 2)
  ? ok('flow13: plantings + harvests export as 2-line CSVs') : bad('flow13');

console.log('---');
console.log('e2e: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
NODEEOF
