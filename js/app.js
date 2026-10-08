/* GardenPlan UI — setup, plantings, calendar, harvest log. */
(function () {
  "use strict";
  var G = window.Garden, GD = window.GardenData;
  var byName = G.plantsByName(GD.PLANTS);

  var settings = G.storageGet("settings", null) || { zone: "7", frost: "", plot: "" };
  var plantings = G.storageGet("plantings", []);
  var harvests = G.storageGet("harvests", []);
  var finished = G.storageGet("finished", []);
  var tasksDone = G.storageGet("tasksDone", {});
  var remKindFilter = "all";

  function save() {
    G.storageSet("settings", settings);
    G.storageSet("plantings", plantings);
    G.storageSet("harvests", harvests);
    G.storageSet("finished", finished);
    G.storageSet("tasksDone", tasksDone);
  }

  function downloadCSV(csv, filename) {
    var blob = new Blob([csv], { type: "text/csv" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function frostDate() {
    if (settings.frost && G.parseISO(settings.frost)) return G.parseISO(settings.frost);
    var yr = new Date().getFullYear();
    return G.frostDate(settings.zone, yr, GD.ZONE_FROST);
  }

  /* ---------- setup ---------- */
  function renderSetup() {
    var zs = Object.keys(GD.ZONE_FROST).map(function (z) {
      return '<option value="' + z + '"' + (settings.zone === z ? " selected" : "") + ">Zone " + z + "</option>";
    }).join("");
    document.getElementById("setZone").innerHTML = zs;
    document.getElementById("setFrost").value = settings.frost || "";
    document.getElementById("setPlot").value = settings.plot || "";
    var f = frostDate();
    document.getElementById("frostNote").textContent = f
      ? "Last frost: ~" + f.toLocaleDateString("en-US", { month: "long", day: "numeric" }) +
        " (zone " + settings.zone + " average — override the date if you know yours)."
      : "Pick a zone to estimate your last frost date.";
  }

  /* ---------- reminders ---------- */
  var KIND_LABELS = { water: "Water", feed: "Feed", harvest: "Harvest" };
  function renderReminders() {
    var all = G.reminders(plantings, byName, G.todayISO(), 14, GD.WATER_INTERVAL, GD.FERTILIZE_DAYS);
    var kinds = {};
    all.forEach(function (r) { kinds[r.kind] = (kinds[r.kind] || 0) + 1; });
    var list = G.filterReminders(all, remKindFilter);
    var html = '<div class="kind-chips">' +
      ["all", "water", "feed", "harvest"].map(function (k) {
        var n = k === "all" ? all.length : (kinds[k] || 0);
        return '<button data-kind="' + k + '" class="kind-chip' + (remKindFilter === k ? " on" : "") + '">' +
          (k === "all" ? "All" : KIND_LABELS[k]) + " (" + n + ")</button>";
      }).join("") + "</div>";
    var host = document.getElementById("reminders");
    host.innerHTML = html + '<div class="tasks" id="reminderTasks"></div>';
    var tasks = document.getElementById("reminderTasks");
    tasks.innerHTML = list.length
      ? list.map(function (r) {
          var done = tasksDone[G.taskKey(r)];
          return '<div class="task ' + r.kind + (done ? " done" : "") + '">' +
            '<button class="task-check" data-taskkey="' + esc(G.taskKey(r)) + '" aria-label="Mark done"' +
            (done ? ' aria-pressed="true"' : "") + ">" + (done ? "✓" : "") + "</button>" +
            '<span class="tdate">' + esc(G.monthLabel(r.date)) + "</span><span>" + esc(r.text) + "</span></div>";
        }).join("")
      : '<p class="muted">No tasks in this view. Add a planting to get a care schedule.</p>';
    host.querySelectorAll("[data-kind]").forEach(function (b) {
      b.addEventListener("click", function () { remKindFilter = b.dataset.kind; renderReminders(); });
    });
    tasks.querySelectorAll("[data-taskkey]").forEach(function (b) {
      b.addEventListener("click", function () {
        var r = list.filter(function (x) { return G.taskKey(x) === b.dataset.taskkey; })[0];
        if (r) tasksDone = G.toggleTaskDone(tasksDone, r);
        save(); renderReminders();
      });
    });
  }

  /* ---------- plantings ---------- */
  function renderPlantings() {
    var today = G.todayISO();
    var rows = plantings.map(function (p) {
      var plant = byName[p.plantName] || {};
      var dh = G.daysToHarvest(p, byName, today);
      return "<tr><td><strong>" + esc(p.plantName) + "</strong>" +
        '<div class="muted small">' + esc(p.method) + " · " + p.qty + "×" +
        (plant.spacing ? " · " + plant.spacing + '" spacing' : "") +
        (dh ? ' · <span class="harv-when">' + esc(dh.label) + "</span>" : "") + "</div></td>" +
        "<td>" + esc(p.date) + "</td>" +
        '<td class="actions"><button data-harv="' + p.id + '">Log harvest</button> ' +
        '<button data-finishp="' + p.id + '" title="Archive as finished">Finish</button> ' +
        '<button data-delp="' + p.id + '" class="danger">Remove</button></td></tr>';
    }).join("");
    var head = '<div class="sec-toolbar"><span class="muted small">' + plantings.length +
      " active planting" + (plantings.length === 1 ? "" : "s") + '</span>' +
      (plantings.length ? '<button id="expPlantings" class="ghost small">Export CSV</button>' : "") + "</div>";
    document.getElementById("plantRows").innerHTML = head + (rows ||
      '<tr><td colspan="3" class="muted">Nothing planted yet — add your first planting below.</td></tr>');
    var exp = document.getElementById("expPlantings");
    if (exp) exp.addEventListener("click", function () { downloadCSV(G.plantingsToCSV(plantings), "garden-plantings.csv"); });
    var arch = finished.slice().reverse().map(function (p) {
      return "<tr><td><strong>" + esc(p.plantName) + "</strong>" +
        '<div class="muted small">' + esc(p.method) + " · " + p.qty + "× · finished " + esc(p.finishedDate || "") + "</div></td>" +
        "<td>" + esc(p.date) + "</td>" +
        '<td class="actions"><button data-restore="' + p.id + '">Restore</button></td></tr>';
    }).join("");
    var archHost = document.getElementById("finishedRows");
    if (archHost) archHost.innerHTML = arch ||
      '<tr><td colspan="3" class="muted">No finished plantings yet.</td></tr>';
    // planting form selects
    document.getElementById("pPlant").innerHTML = GD.PLANTS.map(function (p) {
      return '<option value="' + esc(p.name) + '">' + esc(p.name) + " (" + p.type + ")</option>";
    }).join("");
    document.getElementById("hPlanting").innerHTML = plantings.map(function (p) {
      return '<option value="' + p.id + '">' + esc(p.plantName) + " — " + esc(p.date) + "</option>";
    }).join("");
  }

  /* ---------- calendar ---------- */
  function renderCalendar() {
    var f = frostDate();
    var q = document.getElementById("calSearch").value.trim().toLowerCase();
    var typeF = document.getElementById("calType").value;
    var cards = GD.PLANTS.filter(function (p) {
      return (!q || p.name.toLowerCase().indexOf(q) !== -1) &&
             (typeF === "all" || p.type === typeF);
    }).map(function (p) {
      var s = f ? G.scheduleFor(p, f) : null;
      function line(label, iso) {
        return iso ? '<div><span class="muted">' + label + ":</span> <strong>" + esc(G.monthLabel(iso)) + "</strong></div>" : "";
      }
      return '<div class="card"><span class="ptype ' + esc(p.type) + '">' + esc(p.type) + '</span><h3>' + esc(p.name) + '</h3>' +
        '<div class="muted small">' + esc(p.type) + " · " + esc(p.sun) + " · water: " + esc(p.water.toLowerCase()) + "</div>" +
        (s ? line("Start indoors", s.indoorStart) + line("Transplant", s.transplant) +
             line("Direct sow", s.sow) + line("Harvest", s.harvestFrom) : '<div class="muted">Set a zone first.</div>') +
        '<div class="muted small">Spacing ' + p.spacing + '" · ' + esc(p.notes) + "</div>" +
        '<button data-addplant="' + esc(p.name) + '" class="secondary">+ Plant this</button></div>';
    }).join("");
    document.getElementById("calCards").innerHTML = cards || '<p class="muted">No plants match.</p>';
  }

  /* ---------- harvest ---------- */
  function renderHarvest() {
    var rows = harvests.slice().reverse().map(function (h) {
      return "<tr><td>" + esc(h.date) + "</td><td>" + esc(h.plantName) + "</td>" +
        "<td class='num'>" + h.qty + " " + esc(h.unit) + "</td></tr>";
    }).join("");
    document.getElementById("harvRows").innerHTML = rows ||
      '<tr><td colspan="3" class="muted">No harvests logged yet.</td></tr>';
    document.getElementById("harvCount").textContent = harvests.length
      ? harvests.length + " logged harvest" + (harvests.length === 1 ? "" : "s") : "";
    var t = G.harvestTotals(harvests);
    var cards = Object.keys(t).map(function (k) {
      return '<div class="card"><h3>' + esc(k) + '</h3><div class="big">' + t[k].qty + " " + esc(t[k].unit) +
        '</div><div class="muted">' + t[k].entries + " harvest" + (t[k].entries === 1 ? "" : "s") + "</div></div>";
    }).join("");
    document.getElementById("harvCards").innerHTML = cards;
  }

  function renderAll() { renderSetup(); renderReminders(); renderPlantings(); renderCalendar(); renderHarvest(); }

  document.addEventListener("DOMContentLoaded", function () {
    renderAll();

    document.getElementById("saveSettings").addEventListener("click", function () {
      settings.zone = document.getElementById("setZone").value;
      settings.frost = document.getElementById("setFrost").value;
      settings.plot = document.getElementById("setPlot").value;
      var err = "";
      if (settings.frost && !G.parseISO(settings.frost)) err = "Frost override must be YYYY-MM-DD.";
      document.getElementById("setError").textContent = err;
      if (err) return;
      save(); renderAll();
    });

    document.getElementById("addPlanting").addEventListener("click", function () {
      var fields = {
        plantName: document.getElementById("pPlant").value,
        date: document.getElementById("pDate").value,
        method: document.getElementById("pMethod").value,
        qty: document.getElementById("pQty").value,
        notes: document.getElementById("pNotes").value
      };
      var res = G.addPlanting(plantings, fields, byName);
      document.getElementById("pError").textContent = res.ok ? "" : res.errors.join(" ");
      if (!res.ok) return;
      save(); renderReminders(); renderPlantings();
      document.getElementById("pDate").value = ""; document.getElementById("pNotes").value = "";
    });

    document.getElementById("calSearch").addEventListener("input", renderCalendar);
    document.getElementById("calType").addEventListener("change", renderCalendar);

    document.getElementById("calCards").addEventListener("click", function (e) {
      var b = e.target.closest("[data-addplant]");
      if (!b) return;
      document.getElementById("pPlant").value = b.dataset.addplant;
      document.getElementById("pDate").value = G.todayISO();
      document.querySelector('[data-tab="garden"]').click();
      window.scrollTo(0, document.getElementById("plantForm").offsetTop);
    });

    document.getElementById("plantRows").addEventListener("click", function (e) {
      var d = e.target.closest("[data-delp]");
      var h = e.target.closest("[data-harv]");
      var f = e.target.closest("[data-finishp]");
      if (d && confirm("Remove this planting?")) {
        G.deletePlanting(plantings, d.dataset.delp);
        save(); renderReminders(); renderPlantings(); renderHarvest();
      } else if (f) {
        var fin = G.finishPlanting(plantings, f.dataset.finishp, G.todayISO());
        if (fin) finished.push(fin);
        save(); renderReminders(); renderPlantings(); renderHarvest();
      } else if (h) {
        document.getElementById("hPlanting").value = h.dataset.harv;
        document.getElementById("hDate").value = G.todayISO();
        document.querySelector('[data-tab="harvest"]').click();
      }
    });

    document.getElementById("finishedRows").addEventListener("click", function (e) {
      var r = e.target.closest("[data-restore]");
      if (!r) return;
      var ri = finished.findIndex(function (p) { return p.id === r.dataset.restore; });
      if (ri !== -1) { var back = finished.splice(ri, 1)[0]; delete back.finishedDate; plantings.push(back); }
      save(); renderReminders(); renderPlantings(); renderHarvest();
    });

    document.getElementById("expHarvests").addEventListener("click", function () {
      downloadCSV(G.harvestsToCSV(harvests), "garden-harvests.csv");
    });

    document.getElementById("addHarvest").addEventListener("click", function () {
      var fields = {
        plantingId: document.getElementById("hPlanting").value,
        date: document.getElementById("hDate").value,
        qty: document.getElementById("hQty").value,
        unit: document.getElementById("hUnit").value
      };
      var res = G.addHarvest(harvests, fields, plantings);
      document.getElementById("hError").textContent = res.ok ? "" : res.errors.join(" ");
      if (!res.ok) return;
      save(); renderHarvest();
      document.getElementById("hQty").value = "";
    });

    document.querySelectorAll("[data-tab]").forEach(function (b) {
      b.addEventListener("click", function () {
        document.querySelectorAll("[data-tab]").forEach(function (x) { x.classList.remove("active"); });
        document.querySelectorAll(".tabpage").forEach(function (x) { x.classList.remove("active"); });
        b.classList.add("active");
        document.getElementById("tab-" + b.dataset.tab).classList.add("active");
      });
    });
  });
})();
