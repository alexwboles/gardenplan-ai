/* GardenPlan logic — frost dates, planting schedules, reminders, harvest totals. Browser + node. */
(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) {
    module.exports = factory();
  } else root.Garden = Object.assign(root.Garden || {}, factory());
})(typeof self !== "undefined" ? self : this, function () {

  var _mem = {};
  var NS = "garden:";

  function uid() {
    return "id-" + Date.now().toString(36) + "-" + Math.floor(Math.random() * 1e6).toString(36);
  }

  function storageGet(key, fallback) {
    try {
      if (typeof localStorage !== "undefined") {
        var raw = localStorage.getItem(NS + key);
        return raw == null ? fallback : JSON.parse(raw);
      }
    } catch (e) {}
    return (key in _mem) ? _mem[key] : fallback;
  }

  function storageSet(key, val) {
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(NS + key, JSON.stringify(val));
        return;
      }
    } catch (e) {}
    _mem[key] = val;
  }

  function parseISO(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ""));
    if (!m) return null;
    var d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    if (d.getFullYear() !== Number(m[1]) || d.getMonth() !== Number(m[2]) - 1 || d.getDate() !== Number(m[3]))
      return null;
    return d;
  }

  function toISO(d) {
    function p(n) { return (n < 10 ? "0" : "") + n; }
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
  }

  function addDays(d, n) {
    var c = new Date(d.getTime());
    c.setDate(c.getDate() + n);
    return c;
  }

  function diffDays(a, b) {
    return Math.round((b.getTime() - a.getTime()) / 86400000);
  }

  function todayISO() { return toISO(new Date()); }

  // zone "7" + year -> Date of average last frost (from data table)
  function frostDate(zone, year, zoneTable) {
    var md = zoneTable[String(zone)];
    if (!md) return null;
    return parseISO(year + "-" + md);
  }

  // Full schedule for one plant relative to a frost Date
  function scheduleFor(plant, frost) {
    function wk(n) { return n == null ? null : toISO(addDays(frost, n * 7)); }
    var startBase = null;
    if (plant.transplant != null) startBase = addDays(frost, plant.transplant * 7);
    else if (plant.sow != null) startBase = addDays(frost, plant.sow * 7);
    var harvestFrom = startBase ? toISO(addDays(startBase, plant.harvest - 7)) : null;
    var harvestTo = startBase ? toISO(addDays(startBase, plant.harvest + 14)) : null;
    return {
      indoorStart: wk(plant.indoor == null ? null : -plant.indoor),
      transplant: wk(plant.transplant),
      sow: wk(plant.sow),
      harvestFrom: harvestFrom,
      harvestTo: harvestTo
    };
  }

  function monthLabel(iso) {
    var d = parseISO(iso);
    if (!d) return "";
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  function validatePlanting(fields, plantsByName) {
    var errors = [];
    if (!plantsByName[fields.plantName]) errors.push("Choose a plant from the bank.");
    if (!parseISO(fields.date)) errors.push("Planting date must be a valid date.");
    if (["indoor", "transplant", "sow"].indexOf(fields.method) === -1) errors.push("Pick a planting method.");
    var q = Number(fields.qty);
    if (!isFinite(q) || q < 1 || Math.floor(q) !== q) errors.push("Quantity must be a whole number of 1+.");
    return errors;
  }

  function addPlanting(plantings, fields, plantsByName) {
    var errors = validatePlanting(fields, plantsByName);
    if (errors.length) return { ok: false, errors: errors };
    var p = {
      id: uid(),
      plantName: fields.plantName,
      date: fields.date,
      method: fields.method,
      qty: Number(fields.qty),
      notes: String(fields.notes || "").trim()
    };
    plantings.push(p);
    return { ok: true, planting: p };
  }

  function deletePlanting(plantings, id) {
    var i = plantings.findIndex(function (p) { return p.id === id; });
    if (i === -1) return false;
    plantings.splice(i, 1);
    return true;
  }

  // Archive a finished planting (pulled, done for the season). Returns the
  // finished record so the caller can move it into a finished array.
  function finishPlanting(plantings, id, todayStr) {
    var i = plantings.findIndex(function (p) { return p.id === id; });
    if (i === -1) return null;
    var p = plantings.splice(i, 1)[0];
    p.finishedDate = todayStr || todayISO();
    return p;
  }

  // Days until a planting's harvest window opens: { days, label }
  // days > 0 -> "in ~N days", days <= 0 && inside window -> "harvest window open"
  function daysToHarvest(planting, plantsByName, todayStr) {
    var plant = (plantsByName || {})[planting.plantName];
    var planted = parseISO(planting.date);
    var today = parseISO(todayStr);
    if (!plant || !planted || !today) return null;
    var from = addDays(planted, plant.harvest - 7);
    var to = addDays(planted, plant.harvest + 14);
    if (today > to) return { days: 0, label: "harvest window passed" };
    if (today >= from) return { days: 0, label: "harvest window open now" };
    var n = diffDays(today, from);
    return { days: n, label: "harvest in ~" + n + " day" + (n === 1 ? "" : "s") };
  }

  // Reminder done-state helpers: key is stable per task instance.
  function taskKey(reminder) {
    return reminder.date + "|" + reminder.kind + "|" + reminder.text;
  }

  function toggleTaskDone(doneMap, reminder) {
    var k = taskKey(reminder);
    var out = Object.assign({}, doneMap || {});
    if (out[k]) delete out[k]; else out[k] = true;
    return out;
  }

  function csvCell(v) {
    var s = String(v == null ? "" : v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  function plantingsToCSV(plantings) {
    var rows = [["plant", "date", "method", "qty", "notes"]];
    (plantings || []).forEach(function (p) {
      rows.push([csvCell(p.plantName), csvCell(p.date), csvCell(p.method), csvCell(p.qty), csvCell(p.notes || "")]);
    });
    return rows.map(function (r) { return r.join(","); }).join("\n");
  }

  function harvestsToCSV(harvests) {
    var rows = [["date", "plant", "qty", "unit"]];
    (harvests || []).forEach(function (h) {
      rows.push([csvCell(h.date), csvCell(h.plantName), csvCell(h.qty), csvCell(h.unit)]);
    });
    return rows.map(function (r) { return r.join(","); }).join("\n");
  }

  // Filter reminders by kind; "all" returns everything.
  function filterReminders(list, kind) {
    if (!kind || kind === "all") return list || [];
    return (list || []).filter(function (r) { return r.kind === kind; });
  }

  // Upcoming care tasks for the next `days` days from today.
  // Returns [{ date, text, kind }] sorted by date.
  function reminders(plantings, plantsByName, todayStr, days, waterInterval, fertilizeDays) {
    days = days == null ? 14 : days;
    var today = parseISO(todayStr);
    if (!today) return [];
    var end = addDays(today, days);
    var out = [];
    function push(iso, text, kind) {
      var d = parseISO(iso);
      if (d && d >= today && d <= end) out.push({ date: iso, text: text, kind: kind });
    }
    plantings.forEach(function (pl) {
      var plant = plantsByName[pl.plantName];
      if (!plant) return;
      var planted = parseISO(pl.date);
      if (!planted || planted > end) return;
      // watering cadence
      var every = (waterInterval || {})[plant.water] || 4;
      var horizon = addDays(planted, 90);
      for (var d = new Date(Math.max(planted.getTime(), today.getTime())); d <= Math.min(horizon.getTime(), end.getTime()); d = addDays(d, 1)) {
        if (diffDays(planted, d) % every === 0) {
          push(toISO(d), "Water " + pl.plantName + " (" + pl.qty + "×)", "water");
        }
      }
      // fertilizing
      if (plant.type === "Vegetable" || plant.water === "High") {
        for (var f = addDays(planted, fertilizeDays || 21); f <= Math.min(horizon.getTime(), end.getTime()); f = addDays(f, fertilizeDays || 21)) {
          if (f >= today) push(toISO(f), "Fertilize " + pl.plantName, "feed");
        }
      }
      // harvest window
      var hFrom = addDays(planted, plant.harvest - 7), hTo = addDays(planted, plant.harvest + 14);
      if (today <= hTo && end >= hFrom) {
        var when = today < hFrom ? toISO(hFrom) : todayStr;
        push(when, "Harvest window: " + pl.plantName + " (from ~" + monthLabel(toISO(hFrom)) + ")", "harvest");
      }
    });
    out.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
    return out;
  }

  function validateHarvest(fields, plantings) {
    var errors = [];
    var pl = plantings.filter(function (p) { return p.id === fields.plantingId; })[0];
    if (!pl) errors.push("Choose one of your plantings.");
    if (!parseISO(fields.date)) errors.push("Harvest date must be a valid date.");
    var q = Number(fields.qty);
    if (!isFinite(q) || q <= 0) errors.push("Yield must be a positive number.");
    if (!String(fields.unit || "").trim()) errors.push("Unit is required (e.g. lbs, count, bunches).");
    return { errors: errors, planting: pl };
  }

  function addHarvest(harvests, fields, plantings) {
    var v = validateHarvest(fields, plantings);
    if (v.errors.length) return { ok: false, errors: v.errors };
    var h = {
      id: uid(),
      plantingId: fields.plantingId,
      plantName: v.planting.plantName,
      date: fields.date,
      qty: Number(fields.qty),
      unit: String(fields.unit).trim()
    };
    harvests.push(h);
    return { ok: true, harvest: h };
  }

  // totals per plant: { plantName: { entries, qty, unit } } (unit = most common)
  function harvestTotals(harvests) {
    var t = {};
    harvests.forEach(function (h) {
      var e = t[h.plantName] || (t[h.plantName] = { entries: 0, qty: 0, units: {} });
      e.entries += 1; e.qty += h.qty;
      e.units[h.unit] = (e.units[h.unit] || 0) + 1;
    });
    Object.keys(t).forEach(function (k) {
      var e = t[k];
      e.qty = Math.round(e.qty * 100) / 100;
      e.unit = Object.keys(e.units).sort(function (a, b) { return e.units[b] - e.units[a]; })[0];
      delete e.units;
    });
    return t;
  }

  function plantsByName(plants) {
    var m = {};
    plants.forEach(function (p) { m[p.name] = p; });
    return m;
  }

  return {
    uid: uid, storageGet: storageGet, storageSet: storageSet,
    parseISO: parseISO, toISO: toISO, addDays: addDays, diffDays: diffDays, todayISO: todayISO,
    frostDate: frostDate, scheduleFor: scheduleFor, monthLabel: monthLabel,
    addPlanting: addPlanting, deletePlanting: deletePlanting, validatePlanting: validatePlanting,
    finishPlanting: finishPlanting, daysToHarvest: daysToHarvest,
    taskKey: taskKey, toggleTaskDone: toggleTaskDone,
    plantingsToCSV: plantingsToCSV, harvestsToCSV: harvestsToCSV,
    filterReminders: filterReminders,
    reminders: reminders, addHarvest: addHarvest, harvestTotals: harvestTotals,
    plantsByName: plantsByName
  };
});
