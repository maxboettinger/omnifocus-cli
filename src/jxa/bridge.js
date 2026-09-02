#!/usr/bin/env osascript -l JavaScript
// bridge.js — Unified JXA bridge for OmniFocus CLI
//
// Single entry point for ALL OmniFocus operations.
// Receives a JSON command as the first argument, returns JSON result.
//
// Protocol:
//   Input:  { "op": "task.create", "params": { "name": "Buy groceries", ... } }
//   Output: { "ok": true, "data": { ... } } | { "ok": false, "error": "..." }

// ── Helpers ─────────────────────────────────────────────────────────────────

function ok(data) { return JSON.stringify({ ok: true, data: data }); }
function fail(message, extra) {
    var r = { ok: false, error: message };
    if (extra) { for (var k in extra) { if (extra.hasOwnProperty(k)) r[k] = extra[k]; } }
    return JSON.stringify(r);
}

function parseDate(str) {
    if (!str) throw new Error("Date string required");
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(str)) {
        var parts = str.split('T'), d = parts[0].split('-').map(Number), t = parts[1].split(':').map(Number);
        return new Date(d[0], d[1] - 1, d[2], t[0], t[1]);
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
        var d = str.split('-').map(Number);
        return new Date(d[0], d[1] - 1, d[2]);
    }
    var parsed = new Date(str);
    if (isNaN(parsed.getTime())) throw new Error("Invalid date: " + str);
    return parsed;
}

// ── Smart date resolution ───────────────────────────────────────────────────
//
// Exact ISO forms (YYYY-MM-DD, YYYY-MM-DDTHH:mm) are parsed locally by
// parseDate so scripts keep byte-identical behavior. Anything else is handed
// to OmniFocus's own date parser (the one behind the app's date fields) via
// Omni Automation, so "tomorrow", "fri 5pm", "2d", "10.9." all work. When
// that parser yields midnight and the input carried no explicit time, the
// app's default time for the field (Preferences → Dates & Times) is applied,
// matching what typing the same text into OmniFocus would do.

var ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/;
var EXPLICIT_TIME_RE = /\d{1,2}:\d{2}|\b\d{1,2}\s*(am|pm)\b|\bnoon\b|\bmidnight\b|\bmidday\b/i;
var DEFAULT_TIME_KEYS = { due: "DefaultDueTime", defer: "DefaultStartTime", planned: "DefaultPlannedTime" };

function pad2(n) { return (n < 10 ? "0" : "") + n; }

/** Local wall-clock ISO string (no zone) — what the user sees in OmniFocus. */
function formatLocalIso(date) {
    return date.getFullYear() + "-" + pad2(date.getMonth() + 1) + "-" + pad2(date.getDate()) +
        "T" + pad2(date.getHours()) + ":" + pad2(date.getMinutes());
}

/** Ask OmniFocus to parse `input`; returns { date: Date|null, defaults: {due, defer, planned} }. */
function omniParseDate(of, input) {
    var result = runOmniAutomation(of, { input: input }, [
        "var out = { date: null, defaults: {} };",
        "var f = Formatter.Date.withStyle(Formatter.Date.Style.Short, Formatter.Date.Style.Short);",
        "var d = f.dateFromString(payload.input);",
        "if (d) out.date = d.toISOString();",
        "try {",
        "  out.defaults.due = settings.objectForKey('DefaultDueTime');",
        "  out.defaults.defer = settings.objectForKey('DefaultStartTime');",
        "  out.defaults.planned = settings.objectForKey('DefaultPlannedTime');",
        "} catch(e) {}",
        "return { ok: true, data: out };"
    ].join("\n"));
    if (!result.ok) throw new Error("Could not parse date \"" + input + "\": " + result.error);
    var data = result.data || {};
    var date = null;
    if (data.date) {
        date = new Date(data.date);
        if (isNaN(date.getTime())) date = null;
    }
    return { date: date, defaults: data.defaults || {} };
}

/** Apply an "HH:mm[:ss]" preference value to a Date's local time-of-day. */
function applyDefaultTime(date, pref) {
    if (typeof pref !== "string") return date;
    var m = /^(\d{1,2}):(\d{2})/.exec(pref);
    if (!m) return date;
    var d = new Date(date.getTime());
    d.setHours(Number(m[1]), Number(m[2]), 0, 0);
    return d;
}

/**
 * Turn user input into a Date for the given field ("due" | "defer" | "planned").
 * Throws with a user-facing message when the input cannot be understood.
 */
function resolveDate(of, input, field) {
    if (!input) throw new Error("Date string required");
    var str = String(input).trim();
    if (ISO_DATE_RE.test(str)) return parseDate(str);
    var parsed = omniParseDate(of, str);
    if (!parsed.date) {
        throw new Error("Could not understand date \"" + str + "\". Try e.g. 2026-09-10, 2026-09-10T14:30, tomorrow, fri 5pm, 2d, next week.");
    }
    var date = parsed.date;
    var isMidnight = date.getHours() === 0 && date.getMinutes() === 0;
    if (isMidnight && !EXPLICIT_TIME_RE.test(str)) {
        date = applyDefaultTime(date, parsed.defaults[field]);
    }
    return date;
}

/**
 * Set a date property and verify OmniFocus actually stored it. A silent
 * refusal (e.g. an unsupported property, a read-only task) must surface as
 * an error rather than a success message.
 */
function setDateProp(task, prop, label, date) {
    task[prop] = date;
    var stored = null;
    try { stored = task[prop](); } catch(e) {}
    if (!stored || !(stored instanceof Date) || Math.abs(stored.getTime() - date.getTime()) > 59999) {
        throw new Error("OmniFocus did not store the " + label + " " + formatLocalIso(date) +
            " (task still reports " + (stored instanceof Date ? formatLocalIso(stored) : "none") + ")");
    }
}

function normalizeRepeatMethod(method) {
    if (!method) return "due date";
    var m = method.toLowerCase().replace(/[-_]/g, " ").trim();
    if (m === "due date" || m === "due" || m === "fixed") return "due date";
    if (m === "completion" || m === "completion date" || m === "due after completion") return "due after completion";
    return method;
}

function normalizeProjectStatus(status) {
    if (!status) throw new Error("Status required");
    var s = status.toLowerCase().replace(/[-_\s]/g, "");
    if (s === "active") return "active status";
    if (s === "done" || s === "completed") return "done status";
    if (s === "onhold" || s === "hold") return "on hold status";
    if (s === "dropped") return "dropped status";
    throw new Error("Invalid status: \"" + status + "\". Must be active, done, onhold, or dropped.");
}

// ── Entity lookup ───────────────────────────────────────────────────────────

function findTag(doc, name) {
    var tags = doc.flattenedTags();
    for (var i = 0; i < tags.length; i++) {
        if (tags[i].name() === name) return tags[i];
    }
    return null;
}

function findExistingTag(doc, name) {
    var exact = findTag(doc, name);
    if (exact) return { tag: exact };
    var lower = name.toLowerCase(), tags = doc.flattenedTags(), matches = [];
    for (var i = 0; i < tags.length; i++) {
        if (tags[i].name().toLowerCase().indexOf(lower) !== -1) matches.push(tags[i]);
    }
    if (matches.length === 1) return { tag: matches[0] };
    if (matches.length > 1) return { error: "Ambiguous: " + matches.length + " tags match \"" + name + "\"", candidates: matches.slice(0, 10).map(function(t) { return t.name(); }) };
    return { error: "Tag not found: \"" + name + "\"" };
}

function findExistingProject(doc, name, opts) {
    opts = opts || {};
    var projects = opts.folder ? opts.folder.flattenedProjects() : doc.flattenedProjects();
    for (var i = 0; i < projects.length; i++) {
        if (projects[i].name() === name) return { project: projects[i] };
    }
    var lower = name.toLowerCase(), matches = [];
    for (var j = 0; j < projects.length; j++) {
        if (projects[j].name().toLowerCase().indexOf(lower) !== -1) matches.push(projects[j]);
    }
    if (matches.length === 1) return { project: matches[0] };
    if (matches.length > 1) return { error: "Ambiguous: " + matches.length + " projects match \"" + name + "\"", candidates: matches.slice(0, 10).map(function(p) { return p.name(); }) };
    return { error: "Project not found: \"" + name + "\"" };
}

function findProjectExact(doc, name, opts) {
    opts = opts || {};
    if (!name) return null;
    var projects = opts.folder ? opts.folder.flattenedProjects() : doc.flattenedProjects();
    var target = name.toLowerCase();
    for (var i = 0; i < projects.length; i++) {
        if (projects[i].name().toLowerCase() === target) return projects[i];
    }
    return null;
}

function findTaskById(doc, id) {
    try { var t = doc.flattenedTasks.byId(id); if (t && t.name()) return t; } catch(e) {}
    return null;
}

function findTaskByQuery(doc, query, opts) {
    opts = opts || {};
    var searchCompleted = opts.searchCompleted || false;
    var byId = findTaskById(doc, query);
    if (byId) return { task: byId };
    try {
        var exact = doc.flattenedTasks.whose({ name: query })(), filtered = [];
        for (var i = 0; i < exact.length; i++) {
            var c = exact[i].completed();
            if (searchCompleted ? c : !c) filtered.push(exact[i]);
        }
        if (filtered.length === 1) return { task: filtered[0] };
        if (filtered.length > 1) return { error: "Ambiguous: " + filtered.length + " tasks match \"" + query + "\"", candidates: fmtCandidates(filtered) };
    } catch(e) {}
    try {
        var sub = doc.flattenedTasks.whose({ name: { _contains: query } })(), filteredSub = [];
        for (var j = 0; j < sub.length; j++) {
            var c2 = sub[j].completed();
            if (searchCompleted ? c2 : !c2) filteredSub.push(sub[j]);
        }
        if (filteredSub.length === 1) return { task: filteredSub[0] };
        if (filteredSub.length > 1) return { error: "Ambiguous: " + filteredSub.length + " tasks contain \"" + query + "\"", candidates: fmtCandidates(filteredSub) };
    } catch(e) {}
    return { error: "Task not found: \"" + query + "\"" };
}

function fmtCandidates(tasks) {
    return tasks.slice(0, 5).map(function(t) {
        var proj = null; try { var p = t.containingProject(); if (p) proj = p.name(); } catch(e) {}
        return { id: t.id(), name: t.name(), project: proj || "Inbox" };
    });
}

// ── Formatting ──────────────────────────────────────────────────────────────

function formatTask(task) {
    var project = null;
    try { var p = task.containingProject(); if (p) project = p.name(); } catch(e) {}
    var parent = null;
    try { var pt = task.parentTask(); if (pt) parent = { id: pt.id(), name: pt.name() }; } catch(e) {}
    var tagNames = [];
    try { tagNames = task.tags().map(function(t) { return t.name(); }); } catch(e) {}
    var repetition = null;
    try { var rr = task.repetitionRule(); if (rr) { var m = null; try { m = rr.method(); } catch(e2) {} repetition = { rule: rr.recurrenceString(), method: m }; } } catch(e) {}
    var childCount = 0;
    try { childCount = task.tasks().length; } catch(e) {}
    return {
        name: task.name(), id: task.id(), note: task.note() || "",
        dueDate: task.dueDate() ? task.dueDate().toISOString() : null,
        deferDate: task.deferDate() ? task.deferDate().toISOString() : null,
        plannedDate: (function() { try { var d = task.plannedDate(); return d ? d.toISOString() : null; } catch(e) { return null; } })(),
        effectiveDueDate: (function() { try { var d = task.effectiveDueDate(); return d ? d.toISOString() : null; } catch(e) { return null; } })(),
        effectiveDeferDate: (function() { try { var d = task.effectiveDeferDate(); return d ? d.toISOString() : null; } catch(e) { return null; } })(),
        effectivePlannedDate: (function() { try { var d = task.effectivePlannedDate(); return d ? d.toISOString() : null; } catch(e) { return null; } })(),
        flagged: task.flagged(),
        effectiveFlagged: (function() { try { return task.effectiveFlagged(); } catch(e) { return task.flagged(); } })(),
        estimatedMinutes: task.estimatedMinutes() || null,
        completed: task.completed(),
        completionDate: task.completionDate() ? task.completionDate().toISOString() : null,
        creationDate: (function() { try { var d = task.creationDate(); return d ? d.toISOString() : null; } catch(e) { return null; } })(),
        modificationDate: (function() { try { var d = task.modificationDate(); return d ? d.toISOString() : null; } catch(e) { return null; } })(),
        sequential: (function() { try { return task.sequential(); } catch(e) { return false; } })(),
        inInbox: (function() { try { return task.inInbox(); } catch(e) { return false; } })(),
        blocked: (function() { try { return task.blocked(); } catch(e) { return false; } })(),
        project: project || "Inbox", parentTask: parent, tags: tagNames,
        repetitionRule: repetition, childCount: childCount
    };
}

function formatProject(project) {
    var folder = null;
    try { var pf = project.parentFolder(); if (pf) folder = pf.name(); } catch(e) {}
    var tagNames = [];
    try { tagNames = project.tags().map(function(t) { return t.name(); }); } catch(e) {}
    var taskCount = 0, completedTaskCount = 0;
    try {
        // Batch property access — per-task Apple Events time out on large databases
        var pt = project.flattenedTasks;
        var ptCompleted = pt.completed();
        taskCount = ptCompleted.length;
        for (var i = 0; i < ptCompleted.length; i++) { if (ptCompleted[i]) completedTaskCount++; }
    } catch(e) {}
    var status = "active";
    try { var s = project.status(); if (s) status = s.toString().replace(" status", "").toLowerCase(); } catch(e) {}
    return {
        id: project.id(), name: project.name(), note: project.note() || "",
        status: status,
        dueDate: project.dueDate() ? project.dueDate().toISOString() : null,
        deferDate: project.deferDate() ? project.deferDate().toISOString() : null,
        effectiveDueDate: (function() { try { var d = project.effectiveDueDate(); return d ? d.toISOString() : null; } catch(e) { return null; } })(),
        effectiveDeferDate: (function() { try { var d = project.effectiveDeferDate(); return d ? d.toISOString() : null; } catch(e) { return null; } })(),
        flagged: project.flagged(),
        sequential: (function() { try { return project.sequential(); } catch(e) { return false; } })(),
        completed: project.completed(),
        completionDate: project.completionDate() ? project.completionDate().toISOString() : null,
        creationDate: (function() { try { var d = project.creationDate(); return d ? d.toISOString() : null; } catch(e) { return null; } })(),
        modificationDate: (function() { try { var d = project.modificationDate(); return d ? d.toISOString() : null; } catch(e) { return null; } })(),
        parentFolder: folder, tags: tagNames,
        taskCount: taskCount, completedTaskCount: completedTaskCount
    };
}

function formatProjectCompact(project) {
    var taskCount = 0;
    // Batch property access avoids materializing per-task refs just for .length
    try { taskCount = project.flattenedTasks.completed().length; } catch(e) {}
    var status = "active";
    try { var s = project.status(); if (s) status = s.toString().replace(" status", "").toLowerCase(); } catch(e) {}
    return { id: project.id(), name: project.name(), status: status, taskCount: taskCount };
}

// ── Property application ────────────────────────────────────────────────────

function applyTaskProps(of, doc, task, p) {
    var changes = [];
    if (p.due === "clear") { task.dueDate = null; changes.push("due date cleared"); }
    else if (p.due) { var dueAt = resolveDate(of, p.due, "due"); setDateProp(task, "dueDate", "due date", dueAt); changes.push("due: " + p.due + " → " + formatLocalIso(dueAt)); }
    if (p.defer === "clear") { task.deferDate = null; changes.push("defer date cleared"); }
    else if (p.defer) { var deferAt = resolveDate(of, p.defer, "defer"); setDateProp(task, "deferDate", "defer date", deferAt); changes.push("defer: " + p.defer + " → " + formatLocalIso(deferAt)); }
    if (p.planned === "clear") { try { task.plannedDate = null; changes.push("planned date cleared"); } catch(e) { changes.push("planned clear failed: " + e.message); } }
    else if (p.planned) { var plannedAt = resolveDate(of, p.planned, "planned"); setDateProp(task, "plannedDate", "planned date", plannedAt); changes.push("planned: " + p.planned + " → " + formatLocalIso(plannedAt)); }
    if (p.flag) { task.flagged = true; changes.push("flagged"); }
    if (p.unflag) { task.flagged = false; changes.push("unflagged"); }
    if (p.estimate === "clear") { task.estimatedMinutes = null; changes.push("estimate cleared"); }
    else if (p.estimate !== null && p.estimate !== undefined && p.estimate > 0) { task.estimatedMinutes = p.estimate; changes.push("estimate: " + p.estimate + "min"); }
    if (p.sequential) { task.sequential = true; changes.push("set sequential"); }
    if (p.parallel) { task.sequential = false; changes.push("set parallel"); }
    if (p.repeat === "clear") { task.repetitionRule = null; changes.push("repetition cleared"); }
    else if (p.repeat) {
        var method = normalizeRepeatMethod(p.repeatMethod);
        task.repetitionRule = of.RepetitionRule({ ruleString: p.repeat, method: method });
        changes.push("repetition: " + p.repeat + " (" + method + ")");
    }
    if (p.tags) {
        for (var i = 0; i < p.tags.length; i++) {
            try {
                var lookup = findExistingTag(doc, p.tags[i]);
                if (lookup.error) { changes.push("tag failed (" + p.tags[i] + "): " + lookup.error); continue; }
                of.add(lookup.tag, { to: task.tags }); changes.push("tagged: " + p.tags[i]);
            } catch(e) { changes.push("tag failed (" + p.tags[i] + "): " + e.message); }
        }
    }
    if (p.removeTags) {
        for (var ri = 0; ri < p.removeTags.length; ri++) {
            try {
                var rtag = findTag(doc, p.removeTags[ri]);
                if (rtag) { of.remove(rtag, { from: task.tags }); changes.push("untagged: " + p.removeTags[ri]); }
                else { changes.push("tag not found: " + p.removeTags[ri]); }
            } catch(e) { changes.push("untag failed (" + p.removeTags[ri] + "): " + e.message); }
        }
    }
    return changes;
}

function extractWarnings(changes) {
    var warnings = [];
    var rx = /(failed|not found|lookup failed|invalid)/i;
    for (var i = 0; i < changes.length; i++) {
        if (rx.test(changes[i])) warnings.push(changes[i]);
    }
    return warnings;
}

function findTaskFromParams(doc, p, opts) {
    opts = opts || {};
    if (p.id) {
        var found = findTaskById(doc, p.id);
        if (!found) return { error: "Task not found with ID: " + p.id };
        return { task: found };
    }
    if (!p.query) return { error: "Task query or id required" };
    return findTaskByQuery(doc, p.query, opts);
}

function runOmniAutomation(of, payload, scriptBody) {
    var payloadJson = JSON.stringify(payload || {});
    var script = [
        "(function(){",
        "var payload = " + payloadJson + ";",
        "var __result = (function(){",
        scriptBody,
        "})();",
        "return JSON.stringify(__result);",
        "})()"
    ].join("\n");
    try {
        var result = of.evaluateJavascript(script);
        if (typeof result === "string") {
            try { result = JSON.parse(result); } catch(parseError) { return { ok: false, error: "Omni Automation returned invalid JSON: " + parseError.message }; }
        }
        if (!result || typeof result !== "object" || typeof result.ok !== "boolean") {
            return { ok: false, error: "Omni Automation returned malformed response" };
        }
        return result;
    } catch(e) {
        return { ok: false, error: "Omni Automation failed: " + e.message };
    }
}

function ensureNotificationApiAvailable(of) {
    var check = runOmniAutomation(of, {}, [
        "var supported = (typeof Task !== \"undefined\") && Task.Notification && Task.Notification.Kind && typeof Task.byIdentifier === \"function\";",
        "return { ok: true, data: { supported: !!supported } };"
    ].join("\n"));
    if (!check.ok) return check;
    if (!check.data || !check.data.supported) {
        return { ok: false, error: "Task notifications are not supported by this OmniFocus version." };
    }
    return { ok: true, data: { supported: true } };
}

function runTaskNotificationOperation(of, payload) {
    return runOmniAutomation(of, payload, [
        "var supported = (typeof Task !== \"undefined\") && Task.Notification && Task.Notification.Kind && typeof Task.byIdentifier === \"function\";",
        "if (!supported) return { ok: false, error: \"Task notifications are not supported by this OmniFocus version.\" };",
        "function serializeNotification(n) {",
        "  var kind = \"unknown\";",
        "  if (n.kind === Task.Notification.Kind.Absolute) kind = \"absolute\";",
        "  else if (n.kind === Task.Notification.Kind.DueRelative) kind = \"due-relative\";",
        "  var absoluteFireDate = null;",
        "  var relativeFireOffsetSeconds = null;",
        "  var repeatIntervalSeconds = null;",
        "  var nextFireDate = null;",
        "  var initialFireDate = null;",
        "  var isSnoozed = null;",
        "  var usesFloatingTimeZone = null;",
        "  try { absoluteFireDate = n.absoluteFireDate ? n.absoluteFireDate.toISOString() : null; } catch(_) {}",
        "  try { relativeFireOffsetSeconds = n.relativeFireOffset; } catch(_) {}",
        "  try { repeatIntervalSeconds = n.repeatInterval; } catch(_) {}",
        "  try { nextFireDate = n.nextFireDate ? n.nextFireDate.toISOString() : null; } catch(_) {}",
        "  try { initialFireDate = n.initialFireDate ? n.initialFireDate.toISOString() : null; } catch(_) {}",
        "  try { isSnoozed = n.isSnoozed; } catch(_) {}",
        "  try { usesFloatingTimeZone = n.usesFloatingTimeZone; } catch(_) {}",
        "  return {",
        "    id: n.id.primaryKey,",
        "    kind: kind,",
        "    absoluteFireDate: absoluteFireDate,",
        "    relativeFireOffsetSeconds: relativeFireOffsetSeconds,",
        "    repeatIntervalSeconds: repeatIntervalSeconds,",
        "    nextFireDate: nextFireDate,",
        "    initialFireDate: initialFireDate,",
        "    isSnoozed: isSnoozed,",
        "    usesFloatingTimeZone: usesFloatingTimeZone",
        "  };",
        "}",
        "function serializeAll(task) {",
        "  var out = [];",
        "  for (var i = 0; i < task.notifications.length; i++) out.push(serializeNotification(task.notifications[i]));",
        "  return out;",
        "}",
        "function findNotificationById(task, notificationId) {",
        "  for (var i = 0; i < task.notifications.length; i++) {",
        "    var n = task.notifications[i];",
        "    if (n.id && n.id.primaryKey === notificationId) return n;",
        "  }",
        "  return null;",
        "}",
        "try {",
        "  var task = Task.byIdentifier(payload.taskId);",
        "  if (!task) return { ok: false, error: \"Task not found with ID: \" + payload.taskId };",
        "  if (payload.op === \"list\") {",
        "    return { ok: true, data: { taskId: task.id.primaryKey, taskName: task.name, notifications: serializeAll(task) } };",
        "  }",
        "  if (payload.op === \"add\") {",
        "    var info = { kind: null };",
        "    if (payload.kind === \"absolute\") {",
        "      var ad = new Date(payload.at);",
        "      if (isNaN(ad.getTime())) return { ok: false, error: \"Invalid absolute date: \" + payload.at };",
        "      info.kind = Task.Notification.Kind.Absolute;",
        "      info.absoluteFireDate = ad;",
        "    } else if (payload.kind === \"due-relative\") {",
        "      if (payload.offsetSeconds === null || payload.offsetSeconds === undefined) return { ok: false, error: \"offsetSeconds is required for due-relative notifications\" };",
        "      info.kind = Task.Notification.Kind.DueRelative;",
        "      info.relativeFireOffset = payload.offsetSeconds;",
        "    } else {",
        "      return { ok: false, error: \"Unsupported notification kind: \" + payload.kind };",
        "    }",
        "    if (payload.repeatSeconds !== null && payload.repeatSeconds !== undefined) {",
        "      if (payload.repeatSeconds < 0) return { ok: false, error: \"repeatSeconds must be non-negative\" };",
        "      info.repeatInterval = payload.repeatSeconds;",
        "    }",
        "    var created = task.addNotification(info);",
        "    return { ok: true, data: { taskId: task.id.primaryKey, taskName: task.name, notification: serializeNotification(created), notifications: serializeAll(task) } };",
        "  }",
        "  if (payload.op === \"update\") {",
        "    var target = findNotificationById(task, payload.notificationId);",
        "    if (!target) return { ok: false, error: \"Notification not found with ID: \" + payload.notificationId };",
        "    var isAbsolute = target.kind === Task.Notification.Kind.Absolute;",
        "    var isDueRelative = target.kind === Task.Notification.Kind.DueRelative;",
        "    if (!isAbsolute && !isDueRelative) return { ok: false, error: \"Unsupported notification kind for update\" };",
        "    if (payload.at !== null && payload.at !== undefined) {",
        "      if (!isAbsolute) return { ok: false, error: \"Cannot set absolute fire date on due-relative notification\" };",
        "      var ud = new Date(payload.at);",
        "      if (isNaN(ud.getTime())) return { ok: false, error: \"Invalid absolute date: \" + payload.at };",
        "      target.absoluteFireDate = ud;",
        "    }",
        "    if (payload.offsetSeconds !== null && payload.offsetSeconds !== undefined) {",
        "      if (!isDueRelative) return { ok: false, error: \"Cannot set relative offset on absolute notification\" };",
        "      target.relativeFireOffset = payload.offsetSeconds;",
        "    }",
        "    if (payload.repeatMode === \"clear\") {",
        "      target.repeatInterval = 0;",
        "    } else if (payload.repeatMode === \"set\") {",
        "      if (payload.repeatSeconds < 0) return { ok: false, error: \"repeatSeconds must be non-negative\" };",
        "      target.repeatInterval = payload.repeatSeconds;",
        "    }",
        "    return { ok: true, data: { taskId: task.id.primaryKey, taskName: task.name, notification: serializeNotification(target), notifications: serializeAll(task) } };",
        "  }",
        "  if (payload.op === \"delete\") {",
        "    var toDelete = findNotificationById(task, payload.notificationId);",
        "    if (!toDelete) return { ok: false, error: \"Notification not found with ID: \" + payload.notificationId };",
        "    task.removeNotification(toDelete);",
        "    return { ok: true, data: { taskId: task.id.primaryKey, taskName: task.name, deletedId: payload.notificationId, notifications: serializeAll(task) } };",
        "  }",
        "  if (payload.op === \"clear\") {",
        "    if (!payload.confirm) return { ok: false, error: \"Clear requires confirm: true for safety\" };",
        "    var existing = [];",
        "    for (var i = 0; i < task.notifications.length; i++) existing.push(task.notifications[i]);",
        "    for (var j = 0; j < existing.length; j++) task.removeNotification(existing[j]);",
        "    return { ok: true, data: { taskId: task.id.primaryKey, taskName: task.name, cleared: existing.length, notifications: serializeAll(task) } };",
        "  }",
        "  return { ok: false, error: \"Unsupported notification operation: \" + payload.op };",
        "} catch (e) {",
        "  return { ok: false, error: e.message || String(e) };",
        "}"
    ].join("\n"));
}

function fetchNotificationsByTaskIds(of, taskIds) {
    var check = ensureNotificationApiAvailable(of);
    if (!check.ok) return check;
    return runOmniAutomation(of, { taskIds: taskIds }, [
        "var supported = (typeof Task !== \"undefined\") && Task.Notification && Task.Notification.Kind && typeof Task.byIdentifier === \"function\";",
        "if (!supported) return { ok: false, error: \"Task notifications are not supported by this OmniFocus version.\" };",
        "function serializeNotification(n) {",
        "  var kind = \"unknown\";",
        "  if (n.kind === Task.Notification.Kind.Absolute) kind = \"absolute\";",
        "  else if (n.kind === Task.Notification.Kind.DueRelative) kind = \"due-relative\";",
        "  var absoluteFireDate = null;",
        "  var relativeFireOffsetSeconds = null;",
        "  var repeatIntervalSeconds = null;",
        "  var nextFireDate = null;",
        "  var initialFireDate = null;",
        "  var isSnoozed = null;",
        "  var usesFloatingTimeZone = null;",
        "  try { absoluteFireDate = n.absoluteFireDate ? n.absoluteFireDate.toISOString() : null; } catch(_) {}",
        "  try { relativeFireOffsetSeconds = n.relativeFireOffset; } catch(_) {}",
        "  try { repeatIntervalSeconds = n.repeatInterval; } catch(_) {}",
        "  try { nextFireDate = n.nextFireDate ? n.nextFireDate.toISOString() : null; } catch(_) {}",
        "  try { initialFireDate = n.initialFireDate ? n.initialFireDate.toISOString() : null; } catch(_) {}",
        "  try { isSnoozed = n.isSnoozed; } catch(_) {}",
        "  try { usesFloatingTimeZone = n.usesFloatingTimeZone; } catch(_) {}",
        "  return {",
        "    id: n.id.primaryKey,",
        "    kind: kind,",
        "    absoluteFireDate: absoluteFireDate,",
        "    relativeFireOffsetSeconds: relativeFireOffsetSeconds,",
        "    repeatIntervalSeconds: repeatIntervalSeconds,",
        "    nextFireDate: nextFireDate,",
        "    initialFireDate: initialFireDate,",
        "    isSnoozed: isSnoozed,",
        "    usesFloatingTimeZone: usesFloatingTimeZone",
        "  };",
        "}",
        "if (!Array.isArray(payload.taskIds)) return { ok: false, error: \"taskIds array required\" };",
        "var byTaskId = {};",
        "for (var i = 0; i < payload.taskIds.length; i++) {",
        "  var taskId = payload.taskIds[i];",
        "  var task = Task.byIdentifier(taskId);",
        "  if (!task) { byTaskId[taskId] = []; continue; }",
        "  var serialized = [];",
        "  for (var j = 0; j < task.notifications.length; j++) serialized.push(serializeNotification(task.notifications[j]));",
        "  byTaskId[taskId] = serialized;",
        "}",
        "return { ok: true, data: { byTaskId: byTaskId } };"
    ].join("\n"));
}

function attachNotificationsToTasks(of, tasks) {
    var taskIds = [];
    for (var i = 0; i < tasks.length; i++) {
        if (tasks[i] && tasks[i].id) taskIds.push(tasks[i].id);
    }
    if (taskIds.length === 0) return { ok: true };
    var result = fetchNotificationsByTaskIds(of, taskIds);
    if (!result.ok) return result;
    var byTaskId = (result.data && result.data.byTaskId) ? result.data.byTaskId : {};
    for (var j = 0; j < tasks.length; j++) {
        var t = tasks[j];
        if (!t || !t.id) continue;
        t.notifications = byTaskId[t.id] || [];
    }
    return { ok: true };
}

// ── Operations ──────────────────────────────────────────────────────────────

var ops = {};

// ── Task operations ─────────────────────────────────────────────────────

// Build one task from a parameter bag. Shared by task.create and bulk.create.
// Returns { data } on success or { error, candidates } on failure.
function createTaskRecord(of, doc, p) {
    if (!p.name) return { error: "Task name required" };
    if (p.project && (p.parent || p.parentId)) return { error: "Use either project or parent, not both" };
    var parentTask = null, project = null;
    if (p.parentId) {
        parentTask = findTaskById(doc, p.parentId);
        if (!parentTask) return { error: "Parent task not found by ID: " + p.parentId };
    } else if (p.parent) {
        var r = findTaskByQuery(doc, p.parent);
        if (r.error) return { error: r.error, candidates: r.candidates };
        parentTask = r.task;
    } else if (p.project) {
        var pl = findExistingProject(doc, p.project);
        if (pl.error) return { error: pl.error, candidates: pl.candidates };
        project = pl.project;
    }
    var tp = { name: p.name }; if (p.note) tp.note = p.note;
    var task;
    if (parentTask) { task = of.Task(tp); parentTask.tasks.push(task); }
    else if (project) { task = of.Task(tp); project.tasks.push(task); }
    else { task = of.InboxTask(tp); doc.inboxTasks.push(task); }
    var changes = applyTaskProps(of, doc, task, p);
    var data = { id: task.id(), name: task.name(), task: formatTask(task), changes: changes, warnings: extractWarnings(changes) };
    if (parentTask) {
        var pp = null; try { var ppp = parentTask.containingProject(); if (ppp) pp = ppp.name(); } catch(e) {}
        data.parent = { id: parentTask.id(), name: parentTask.name(), project: pp || "Inbox" };
    }
    return { data: data };
}

ops["task.create"] = function(of, doc, p) {
    var r = createTaskRecord(of, doc, p);
    if (r.error) return fail(r.error, r.candidates ? { candidates: r.candidates } : {});
    return ok(r.data);
};

ops["task.get"] = function(of, doc, p) {
    if (!p.query) return fail("Task query required");
    var r = findTaskByQuery(doc, p.query, { searchCompleted: p.searchCompleted });
    if (r.error) return fail(r.error, r.candidates ? { candidates: r.candidates } : {});
    var taskData = formatTask(r.task);
    if (p.includeNotifications) {
        var attachResult = attachNotificationsToTasks(of, [taskData]);
        if (!attachResult.ok) return fail(attachResult.error);
    }
    return ok(taskData);
};

ops["task.update"] = function(of, doc, p) {
    if (!p.query && !p.id) return fail("Task query or id required");
    var findResult;
    if (p.id) {
        var found = findTaskById(doc, p.id);
        if (!found) return fail("Task not found with ID: " + p.id);
        findResult = { task: found };
    } else {
        findResult = findTaskByQuery(doc, p.query);
    }
    if (findResult.error) return fail(findResult.error, findResult.candidates ? { candidates: findResult.candidates } : {});
    var task = findResult.task, changes = [];
    if (p.complete) { try { task.markComplete(); } catch(e) { task.completed = true; } changes.push("completed"); }
    if (p.incomplete) { try { task.markIncomplete(); } catch(e) { task.completed = false; } changes.push("marked incomplete"); }
    if (p.name) { task.name = p.name; changes.push("renamed → " + p.name); }
    if (p.note !== null && p.note !== undefined) { task.note = p.note; changes.push("note set"); }
    if (p.noteAppend) { var ex = task.note() || ""; task.note = ex + (ex ? "\n" : "") + p.noteAppend; changes.push("note appended"); }
    var pc = applyTaskProps(of, doc, task, p); changes = changes.concat(pc);
    if (p.project) {
        var pl = findExistingProject(doc, p.project);
        if (pl.project) { task.assignedContainer = pl.project; changes.push("moved to project: " + pl.project.name()); }
        else { changes.push("project lookup failed: " + pl.error); }
    }
    return ok({ id: task.id(), changes: changes, task: formatTask(task) });
};

ops["task.complete"] = function(of, doc, p) {
    if (!p.query && !p.id) return fail("Task query or id required");
    var findResult;
    if (p.id) {
        var found = findTaskById(doc, p.id);
        if (!found) return fail("Task not found with ID: " + p.id);
        findResult = { task: found };
    } else {
        findResult = findTaskByQuery(doc, p.query, { searchCompleted: p.incomplete });
        if (findResult.error && !findResult.candidates) {
            // A bare "not found" is misleading when the task exists in the opposite
            // completion state — search/list also hide completed tasks, so this is
            // the caller's only chance to learn the task is already done.
            var alt = findTaskByQuery(doc, p.query, { searchCompleted: !p.incomplete });
            if (alt.task) {
                if (p.incomplete) {
                    return fail("Task is already incomplete: \"" + alt.task.name() + "\" (id: " + alt.task.id() + ")");
                }
                var doneAt = null;
                try { var cdd = alt.task.completionDate(); if (cdd) doneAt = cdd.toISOString(); } catch(e) {}
                return fail("Task already completed: \"" + alt.task.name() + "\"" + (doneAt ? " (completed " + doneAt + ")" : "") + " (id: " + alt.task.id() + ")");
            }
            if (alt.candidates) {
                var altState = p.incomplete ? "incomplete" : "completed";
                return fail("No " + (p.incomplete ? "completed" : "incomplete") + " task matches \"" + p.query + "\", but " + altState + " tasks do", { candidates: alt.candidates });
            }
        }
    }
    if (findResult.error) return fail(findResult.error, findResult.candidates ? { candidates: findResult.candidates } : {});
    var task = findResult.task, action;
    if (p.incomplete) {
        try { task.markIncomplete(); } catch(e) { task.completed = false; }
        action = "uncompleted";
    } else {
        try { task.markComplete(); } catch(e) { task.completed = true; }
        action = "completed";
    }
    return ok({ id: task.id(), name: task.name(), action: action, task: formatTask(task) });
};

ops["task.delete"] = function(of, doc, p) {
    if (!p.query && !p.id) return fail("Task query or id required");
    if (!p.confirm) return fail("Delete requires confirm: true for safety");
    var findResult;
    if (p.id) {
        var found = findTaskById(doc, p.id);
        if (!found) return fail("Task not found with ID: " + p.id);
        findResult = { task: found };
    } else {
        findResult = findTaskByQuery(doc, p.query);
    }
    if (findResult.error) return fail(findResult.error, findResult.candidates ? { candidates: findResult.candidates } : {});
    var task = findResult.task;
    var name = task.name();
    of.delete(task);
    return ok({ id: p.id || task.id(), name: name, action: "deleted" });
};
ops["task.list"] = function(of, doc, p) {
    var filter = p.filter || "available";
    var limit = p.limit || (filter === "inbox" ? 50 : 20);

    if (filter === "inbox") {
        // Batch property access for performance
        var inbox = doc.inboxTasks;
        var names = inbox.name(), ids = inbox.id(), notes = inbox.note();
        var dueDates = inbox.dueDate(), deferDates = inbox.deferDate(), flagged = inbox.flagged();
        var estimates = inbox.estimatedMinutes(), completed = inbox.completed();
        var plannedDates; try { plannedDates = inbox.plannedDate(); } catch(e) { plannedDates = []; }
        var creationDates; try { creationDates = inbox.creationDate(); } catch(e) { creationDates = []; }
        // limit caps returned results, not the scan window — completed tasks
        // linger in inboxTasks and may fill the front of the collection
        var order = [];
        for (var oi = 0; oi < names.length; oi++) { if (!completed[oi]) order.push(oi); }
        if (p.newestFirst) {
            // sort before limiting, so --limit N returns the N newest items
            order.sort(function(a, b) {
                var ca = creationDates.length > a && creationDates[a] ? creationDates[a].getTime() : 0;
                var cb = creationDates.length > b && creationDates[b] ? creationDates[b].getTime() : 0;
                return cb - ca;
            });
        }
        var tasks = inbox(), results = [];
        for (var n = 0; n < order.length && results.length < limit; n++) {
            var i = order[n];
            var task = tasks[i], tagNames = [];
            try { tagNames = task.tags().map(function(t) { return t.name(); }); } catch(e) {}
            var rep = null;
            try { var rr = task.repetitionRule(); if (rr) { var m = null; try { m = rr.method(); } catch(e2) {} rep = { rule: rr.recurrenceString(), method: m }; } } catch(e) {}
            var seq = false; try { seq = task.sequential(); } catch(e) {}
            var cc = 0; try { cc = task.tasks().length; } catch(e) {}
            var cd = creationDates.length > i && creationDates[i] ? creationDates[i].toISOString() : null;
            var md = null; try { var mdt = task.modificationDate(); if (mdt) md = mdt.toISOString(); } catch(e) {}
            var pl = plannedDates.length > i ? plannedDates[i] : null;
            results.push({
                name: names[i], id: ids[i], note: notes[i] || "",
                dueDate: dueDates[i] ? dueDates[i].toISOString() : null,
                deferDate: deferDates[i] ? deferDates[i].toISOString() : null,
                plannedDate: pl ? pl.toISOString() : null,
                effectiveDueDate: dueDates[i] ? dueDates[i].toISOString() : null,
                effectiveDeferDate: deferDates[i] ? deferDates[i].toISOString() : null,
                effectivePlannedDate: pl ? pl.toISOString() : null,
                flagged: flagged[i], effectiveFlagged: flagged[i],
                estimatedMinutes: estimates[i] || null, completed: false,
                completionDate: null, creationDate: cd, modificationDate: md,
                sequential: seq, inInbox: true, blocked: false,
                project: "Inbox", parentTask: null, tags: tagNames,
                repetitionRule: rep, childCount: cc
            });
        }
        if (p.includeNotifications) {
            var inboxAttach = attachNotificationsToTasks(of, results);
            if (!inboxAttach.ok) return fail(inboxAttach.error);
        }
        return ok(results);
    }

    // Non-inbox filters
    if (filter !== "flagged" && filter !== "available" && filter !== "due-soon" && filter !== "overdue" && filter !== "all") {
        return fail("Unknown filter: " + filter);
    }
    var now = new Date(), threeDays = new Date();
    threeDays.setDate(threeDays.getDate() + 3);
    // Batch property access — per-task Apple Events time out on large databases
    var ft = doc.flattenedTasks;
    var allCompleted = ft.completed(), allFlagged = ft.flagged(), allDueDates = ft.dueDate();
    var allBlocked; try { allBlocked = ft.blocked(); } catch(e) { allBlocked = []; }
    var taskRefs = null, results = [];
    for (var i = 0; i < allCompleted.length && results.length < limit; i++) {
        if (allCompleted[i]) continue;
        var include = false;
        switch (filter) {
            case "flagged": include = allFlagged[i]; break;
            case "available": include = !(allBlocked.length > i && allBlocked[i]); break;
            case "due-soon": var dd = allDueDates[i]; include = dd && dd < threeDays && dd >= now; break;
            case "overdue": var dd2 = allDueDates[i]; include = dd2 && dd2 < now; break;
            case "all": include = true; break;
        }
        if (include) {
            if (!taskRefs) taskRefs = ft();
            results.push(formatTask(taskRefs[i]));
        }
    }
    if (p.includeNotifications) {
        var attach = attachNotificationsToTasks(of, results);
        if (!attach.ok) return fail(attach.error);
    }
    return ok(results);
};

ops["task.search"] = function(of, doc, p) {
    if (!p.query) return fail("Search query required");
    var limit = p.limit || 50, seenIds = {}, results = [];
    var q = p.query.toLowerCase();
    // Batch property access — whose()'s _contains predicate is itself slow to
    // evaluate against thousands of tasks (cost scales with match count, not
    // with the limit): a broad query can match nearly the whole database and
    // time out before a single result is read. Read name/note/completed/id
    // once and match in JS instead, consistent with task.list/stats.
    var ft = doc.flattenedTasks;
    var allNames = ft.name(), allIds = ft.id(), allCompleted = ft.completed();
    var allNotes; try { allNotes = ft.note(); } catch(e) { allNotes = []; }
    var nameIdx = [];
    for (var i = 0; i < allNames.length && results.length + nameIdx.length < limit; i++) {
        if (allCompleted[i]) continue;
        var nm = allNames[i]; if (!nm || nm.toLowerCase().indexOf(q) === -1) continue;
        var id = allIds[i]; if (seenIds[id]) continue; seenIds[id] = true;
        nameIdx.push(i);
    }
    var refs = null;
    if (nameIdx.length > 0) {
        refs = ft();
        for (var ni = 0; ni < nameIdx.length; ni++) results.push(formatTask(refs[nameIdx[ni]]));
    }
    if (results.length < limit) {
        var noteIdx = [];
        for (var j = 0; j < allNotes.length && results.length + noteIdx.length < limit; j++) {
            if (allCompleted[j]) continue;
            var nt = allNotes[j]; if (!nt || nt.toLowerCase().indexOf(q) === -1) continue;
            var nid = allIds[j]; if (seenIds[nid]) continue; seenIds[nid] = true;
            noteIdx.push(j);
        }
        if (noteIdx.length > 0) {
            if (!refs) refs = ft();
            for (var nj = 0; nj < noteIdx.length; nj++) results.push(formatTask(refs[noteIdx[nj]]));
        }
    }
    return ok(results);
};

ops["task.subtask"] = function(of, doc, p) {
    if (!p.name) return fail("Subtask name required");
    if (!p.parent && !p.parentId) return fail("Parent task required (parent or parentId)");
    var parentTask;
    if (p.parentId) {
        parentTask = findTaskById(doc, p.parentId);
        if (!parentTask) return fail("Parent task not found by ID: " + p.parentId);
    } else {
        var r = findTaskByQuery(doc, p.parent);
        if (r.error) return fail(r.error, r.candidates ? { candidates: r.candidates } : {});
        parentTask = r.task;
    }
    var tp = { name: p.name }; if (p.note) tp.note = p.note;
    var task = of.Task(tp); parentTask.tasks.push(task);
    var changes = applyTaskProps(of, doc, task, p);
    var warnings = extractWarnings(changes);
    var pp = null; try { var ppp = parentTask.containingProject(); if (ppp) pp = ppp.name(); } catch(e) {}
    return ok({
        id: task.id(),
        name: p.name,
        task: formatTask(task),
        parent: { id: parentTask.id(), name: parentTask.name(), project: pp || "Inbox" },
        changes: changes,
        warnings: warnings
    });
};

ops["task.applyTag"] = function(of, doc, p) {
    if (!p.query && !p.id) return fail("Task query or id required");
    if (!p.tags || p.tags.length === 0) return fail("At least one tag required");
    var findResult;
    if (p.id) {
        var found = findTaskById(doc, p.id);
        if (!found) return fail("Task not found with ID: " + p.id);
        findResult = { task: found };
    } else {
        findResult = findTaskByQuery(doc, p.query);
    }
    if (findResult.error) return fail(findResult.error, findResult.candidates ? { candidates: findResult.candidates } : {});
    var task = findResult.task;
    // Validate ALL tags first (atomic)
    var resolved = [];
    for (var i = 0; i < p.tags.length; i++) {
        var lookup = findExistingTag(doc, p.tags[i]);
        if (lookup.error) return fail(lookup.error, lookup.candidates ? { candidates: lookup.candidates } : {});
        resolved.push(lookup.tag);
    }
    var applied = [];
    for (var j = 0; j < resolved.length; j++) {
        of.add(resolved[j], { to: task.tags }); applied.push(resolved[j].name());
    }
    return ok({ id: task.id(), name: task.name(), applied: applied, task: formatTask(task) });
};

ops["task.notification.list"] = function(of, doc, p) {
    var findResult = findTaskFromParams(doc, p, { searchCompleted: true });
    if (findResult.error) return fail(findResult.error, findResult.candidates ? { candidates: findResult.candidates } : {});
    var task = findResult.task;
    var result = runTaskNotificationOperation(of, {
        op: "list",
        taskId: task.id()
    });
    if (!result.ok) return fail(result.error);
    return ok(result.data);
};

ops["task.notification.add"] = function(of, doc, p) {
    var findResult = findTaskFromParams(doc, p, { searchCompleted: true });
    if (findResult.error) return fail(findResult.error, findResult.candidates ? { candidates: findResult.candidates } : {});
    var task = findResult.task;
    var result = runTaskNotificationOperation(of, {
        op: "add",
        taskId: task.id(),
        kind: p.kind,
        at: p.at || null,
        offsetSeconds: (p.offsetSeconds !== undefined ? p.offsetSeconds : null),
        repeatSeconds: (p.repeatSeconds !== undefined ? p.repeatSeconds : null)
    });
    if (!result.ok) return fail(result.error);
    return ok(result.data);
};

ops["task.notification.update"] = function(of, doc, p) {
    var findResult = findTaskFromParams(doc, p, { searchCompleted: true });
    if (findResult.error) return fail(findResult.error, findResult.candidates ? { candidates: findResult.candidates } : {});
    if (!p.notificationId) return fail("notificationId required");
    var repeatMode = "none";
    var repeatSeconds = null;
    if (p.repeatSeconds === "clear") {
        repeatMode = "clear";
    } else if (p.repeatSeconds !== undefined && p.repeatSeconds !== null) {
        repeatMode = "set";
        repeatSeconds = p.repeatSeconds;
    }
    var result = runTaskNotificationOperation(of, {
        op: "update",
        taskId: findResult.task.id(),
        notificationId: p.notificationId,
        at: (p.at !== undefined ? p.at : null),
        offsetSeconds: (p.offsetSeconds !== undefined ? p.offsetSeconds : null),
        repeatMode: repeatMode,
        repeatSeconds: repeatSeconds
    });
    if (!result.ok) return fail(result.error);
    return ok(result.data);
};

ops["task.notification.delete"] = function(of, doc, p) {
    var findResult = findTaskFromParams(doc, p, { searchCompleted: true });
    if (findResult.error) return fail(findResult.error, findResult.candidates ? { candidates: findResult.candidates } : {});
    if (!p.notificationId) return fail("notificationId required");
    var result = runTaskNotificationOperation(of, {
        op: "delete",
        taskId: findResult.task.id(),
        notificationId: p.notificationId
    });
    if (!result.ok) return fail(result.error);
    return ok(result.data);
};

ops["task.notification.clear"] = function(of, doc, p) {
    var findResult = findTaskFromParams(doc, p, { searchCompleted: true });
    if (findResult.error) return fail(findResult.error, findResult.candidates ? { candidates: findResult.candidates } : {});
    var result = runTaskNotificationOperation(of, {
        op: "clear",
        taskId: findResult.task.id(),
        confirm: !!p.confirm
    });
    if (!result.ok) return fail(result.error);
    return ok(result.data);
};

// ── Project operations ──────────────────────────────────────────────────

ops["project.create"] = function(of, doc, p) {
    if (!p.name) return fail("Project name required");
    var existing = findProjectExact(doc, p.name);
    if (existing) return fail("Project already exists: \"" + existing.name() + "\"", { existingId: existing.id() });
    var normalizedStatus = null;
    if (p.status) {
        try { normalizedStatus = normalizeProjectStatus(p.status); }
        catch(e) { return fail(e.message); }
    }
    var targetFolder = null;
    if (p.folder) {
        var folders = doc.flattenedFolders(), lf = p.folder.toLowerCase();
        for (var i = 0; i < folders.length; i++) {
            if (folders[i].name().toLowerCase().indexOf(lf) !== -1) { targetFolder = folders[i]; break; }
        }
        if (!targetFolder) return fail("Folder not found: \"" + p.folder + "\"");
    }
    var project = of.Project({ name: p.name });
    if (targetFolder) targetFolder.projects.push(project); else doc.projects.push(project);
    if (p.note) project.note = p.note;
    if (p.sequential) project.sequential = true;
    if (p.flag) project.flagged = true;
    if (normalizedStatus) project.status = normalizedStatus;
    return ok({ id: project.id(), name: project.name(), project: formatProject(project) });
};

ops["project.get"] = function(of, doc, p) {
    if (!p.query && !p.id) return fail("Project query or id required");
    var project;
    if (p.id) {
        var projects = doc.flattenedProjects();
        for (var i = 0; i < projects.length; i++) { if (projects[i].id() === p.id) { project = projects[i]; break; } }
        if (!project) return fail("Project not found with ID: " + p.id);
    } else {
        var r = findExistingProject(doc, p.query);
        if (r.error) return fail(r.error, r.candidates ? { candidates: r.candidates } : {});
        project = r.project;
    }
    var result = formatProject(project);
    // Add computed fields
    var overdueCount = 0, now = new Date();
    try {
        // Batch property access — per-task Apple Events time out on large databases
        var opt = project.flattenedTasks;
        var optCompleted = opt.completed(), optDueDates = opt.dueDate();
        for (var j = 0; j < optCompleted.length; j++) {
            if (!optCompleted[j] && optDueDates[j] && optDueDates[j] < now) overdueCount++;
        }
    } catch(e) {}
    result.overdueCount = overdueCount;
    result.completionPercentage = result.taskCount > 0 ? Math.round((result.completedTaskCount / result.taskCount) * 100) : 0;
    return ok(result);
};

ops["project.list"] = function(of, doc, p) {
    var projects = doc.flattenedProjects();
    if (p.folder) {
        var folders = doc.flattenedFolders(), tf = null, lf = p.folder.toLowerCase();
        for (var i = 0; i < folders.length; i++) {
            if (folders[i].name().toLowerCase().indexOf(lf) !== -1) { tf = folders[i]; break; }
        }
        if (!tf) return fail("Folder not found: \"" + p.folder + "\"");
        projects = tf.flattenedProjects();
    }
    var results = [];
    for (var j = 0; j < projects.length; j++) {
        var proj = projects[j];
        if (p.search && proj.name().toLowerCase().indexOf(p.search.toLowerCase()) === -1) continue;
        if (p.status) {
            try {
                var ns = normalizeProjectStatus(p.status);
                if (proj.status().toString() !== ns) continue;
            } catch(e) { return fail("Invalid status: " + p.status); }
        }
        if (p.activeOnly) {
            var hasIncomplete = false;
            // Batch property access — per-task Apple Events time out on large databases
            try {
                var apt = proj.flattenedTasks;
                var aptCompleted = apt.completed();
                for (var k = 0; k < aptCompleted.length; k++) { if (!aptCompleted[k]) { hasIncomplete = true; break; } }
            } catch(e) {}
            if (!hasIncomplete) continue;
        }
        if (p.full) results.push(formatProject(proj));
        else if (p.count) results.push(formatProjectCompact(proj));
        else results.push(proj.name());
        if (p.limit && results.length >= p.limit) break;
    }
    return ok(results);
};

ops["project.update"] = function(of, doc, p) {
    if (!p.query && !p.id) return fail("Project query or id required");
    var project;
    if (p.id) {
        var projects = doc.flattenedProjects();
        for (var i = 0; i < projects.length; i++) { if (projects[i].id() === p.id) { project = projects[i]; break; } }
        if (!project) return fail("Project not found with ID: " + p.id);
    } else {
        var r = findExistingProject(doc, p.query);
        if (r.error) return fail(r.error, r.candidates ? { candidates: r.candidates } : {});
        project = r.project;
    }
    var changes = [];
    if (p.name) { project.name = p.name; changes.push("renamed → " + p.name); }
    if (p.note !== null && p.note !== undefined) { project.note = p.note; changes.push("note set"); }
    if (p.noteAppend) { var ex = project.note() || ""; project.note = ex + (ex ? "\n" : "") + p.noteAppend; changes.push("note appended"); }
    if (p.status) { try { project.status = normalizeProjectStatus(p.status); changes.push("status → " + p.status); } catch(e) { changes.push("status failed: " + e.message); } }
    if (p.sequential) { project.sequential = true; changes.push("set sequential"); }
    if (p.parallel) { project.sequential = false; changes.push("set parallel"); }
    if (p.flag) { project.flagged = true; changes.push("flagged"); }
    if (p.unflag) { project.flagged = false; changes.push("unflagged"); }
    if (p.folder) {
        var folders = doc.flattenedFolders(), tf = null, lf = p.folder.toLowerCase();
        for (var fi = 0; fi < folders.length; fi++) {
            if (folders[fi].name().toLowerCase().indexOf(lf) !== -1) { tf = folders[fi]; break; }
        }
        if (tf) { try { of.move(project, { to: tf }); changes.push("moved to folder: " + tf.name()); } catch(e) { changes.push("folder move failed: " + e.message); } }
        else { changes.push("folder not found: " + p.folder); }
    }
    return ok({ id: project.id(), changes: changes, project: formatProject(project) });
};

ops["project.rename"] = function(of, doc, p) {
    if (!p.query && !p.id) return fail("Project query or id required");
    if (!p.newName) return fail("New name required");
    var project;
    if (p.id) {
        var projects = doc.flattenedProjects();
        for (var i = 0; i < projects.length; i++) { if (projects[i].id() === p.id) { project = projects[i]; break; } }
        if (!project) return fail("Project not found with ID: " + p.id);
    } else {
        var r = findExistingProject(doc, p.query);
        if (r.error) return fail(r.error, r.candidates ? { candidates: r.candidates } : {});
        project = r.project;
    }
    var conflict = findProjectExact(doc, p.newName);
    if (conflict && conflict.id() !== project.id()) return fail("A project named \"" + p.newName + "\" already exists");
    var oldName = project.name();
    project.name = p.newName;
    return ok({ id: project.id(), oldName: oldName, newName: p.newName, project: formatProject(project) });
};

ops["project.delete"] = function(of, doc, p) {
    if (!p.query && !p.id) return fail("Project query or id required");
    if (!p.confirm) return fail("Delete requires confirm: true for safety");
    var project;
    if (p.id) {
        var projects = doc.flattenedProjects();
        for (var i = 0; i < projects.length; i++) { if (projects[i].id() === p.id) { project = projects[i]; break; } }
        if (!project) return fail("Project not found with ID: " + p.id);
    } else {
        var r = findExistingProject(doc, p.query);
        if (r.error) return fail(r.error, r.candidates ? { candidates: r.candidates } : {});
        project = r.project;
    }
    var name = project.name(), id = project.id();
    of.delete(project);
    return ok({ id: id, name: name, action: "deleted" });
};

// ── Tag operations ──────────────────────────────────────────────────────

ops["tag.create"] = function(of, doc, p) {
    if (!p.name) return fail("Tag name required");
    var existing = findTag(doc, p.name);
    if (existing) return fail("Tag already exists: \"" + p.name + "\"");
    var tag = of.Tag({ name: p.name }); doc.tags.push(tag);
    return ok({ id: tag.id(), name: tag.name() });
};

ops["tag.list"] = function(of, doc, p) {
    var tags = doc.flattenedTags(), results = [];
    for (var i = 0; i < tags.length; i++) {
        var tag = tags[i];
        if (p.search && tag.name().toLowerCase().indexOf(p.search.toLowerCase()) === -1) continue;
        // Batch property access — per-task Apple Events time out on large databases.
        // Read once per tag (not per task) via the tasks specifier, not tag.tasks().
        var completedFlags = null;
        if (p.activeOnly || p.count) {
            try { completedFlags = tag.tasks.completed(); } catch(e) { completedFlags = []; }
        }
        if (p.activeOnly) {
            var hasActive = false;
            for (var j = 0; j < completedFlags.length; j++) { if (!completedFlags[j]) { hasActive = true; break; } }
            if (!hasActive) continue;
        }
        if (p.count) {
            var tc = completedFlags.length, ac = 0;
            for (var k = 0; k < completedFlags.length; k++) { if (!completedFlags[k]) ac++; }
            results.push({ name: tag.name(), id: tag.id(), taskCount: tc, activeTaskCount: ac });
        } else {
            results.push(tag.name());
        }
        if (p.limit && results.length >= p.limit) break;
    }
    return ok(results);
};

ops["tag.rename"] = function(of, doc, p) {
    if (!p.oldName || !p.newName) return fail("Both oldName and newName required");
    var tag = findTag(doc, p.oldName);
    if (!tag) { var lookup = findExistingTag(doc, p.oldName); if (lookup.tag) tag = lookup.tag; else return fail(lookup.error, lookup.candidates ? { candidates: lookup.candidates } : {}); }
    var conflict = findTag(doc, p.newName);
    if (conflict) return fail("A tag named \"" + p.newName + "\" already exists");
    tag.name = p.newName;
    return ok({ oldName: p.oldName, newName: p.newName });
};

ops["tag.delete"] = function(of, doc, p) {
    if (!p.name) return fail("Tag name required");
    if (!p.confirm) return fail("Delete requires confirm: true for safety");
    var tag = findTag(doc, p.name);
    if (!tag) { var lookup = findExistingTag(doc, p.name); if (lookup.tag) tag = lookup.tag; else return fail(lookup.error, lookup.candidates ? { candidates: lookup.candidates } : {}); }
    var name = tag.name();
    of.delete(tag);
    return ok({ name: name, action: "deleted" });
};

ops["tag.tasks"] = function(of, doc, p) {
    if (!p.tagName) return fail("Tag name required");
    var lookup = findExistingTag(doc, p.tagName);
    if (lookup.error) return fail(lookup.error, lookup.candidates ? { candidates: lookup.candidates } : {});
    var limit = p.limit || 50, results = [];
    // Batch property access — per-task Apple Events time out on large databases.
    // Read completed() once via the tasks specifier (not per materialized ref),
    // then materialize refs once and formatTask() only surviving indices.
    var completedFlags; try { completedFlags = lookup.tag.tasks.completed(); } catch(e) { completedFlags = []; }
    var refs = null;
    for (var i = 0; i < completedFlags.length && results.length < limit; i++) {
        if (completedFlags[i]) continue;
        if (!refs) refs = lookup.tag.tasks();
        results.push(formatTask(refs[i]));
    }
    return ok(results);
};

// ── Folder operations ───────────────────────────────────────────────────

ops["folder.create"] = function(of, doc, p) {
    if (!p.name) return fail("Folder name required");
    var folders = doc.flattenedFolders();
    for (var i = 0; i < folders.length; i++) {
        if (folders[i].name() === p.name) return fail("Folder already exists: \"" + p.name + "\"");
    }
    var parentFolder = null;
    if (p.parent) {
        var lp = p.parent.toLowerCase();
        for (var j = 0; j < folders.length; j++) {
            if (folders[j].name().toLowerCase().indexOf(lp) !== -1) { parentFolder = folders[j]; break; }
        }
        if (!parentFolder) return fail("Parent folder not found: \"" + p.parent + "\"");
    }
    var folder = of.Folder({ name: p.name });
    if (parentFolder) parentFolder.folders.push(folder); else doc.folders.push(folder);
    return ok({ id: folder.id(), name: folder.name(), parentFolder: parentFolder ? parentFolder.name() : null });
};

ops["folder.list"] = function(of, doc, p) {
    var folders = doc.flattenedFolders(), results = [];
    for (var i = 0; i < folders.length; i++) {
        var f = folders[i];
        if (p.search && f.name().toLowerCase().indexOf(p.search.toLowerCase()) === -1) continue;
        if (p.count) {
            var pc = 0; try { pc = f.flattenedProjects().length; } catch(e) {}
            var pf = null; try { var pfr = f.parentFolder(); if (pfr) pf = pfr.name(); } catch(e) {}
            results.push({ id: f.id(), name: f.name(), parentFolder: pf, projectCount: pc });
        } else {
            results.push(f.name());
        }
        if (p.limit && results.length >= p.limit) break;
    }
    return ok(results);
};

// ── Inbox operations ────────────────────────────────────────────────────

ops["inbox.list"] = function(of, doc, p) {
    return ops["task.list"](of, doc, { filter: "inbox", limit: p.limit || 50, newestFirst: !!p.newestFirst });
};

ops["inbox.add"] = function(of, doc, p) {
    if (!p.name) return fail("Task name required");
    var targetProject = null;
    if (p.project) {
        var lookup = findExistingProject(doc, p.project);
        if (lookup.error) return fail(lookup.error, lookup.candidates ? { candidates: lookup.candidates } : {});
        targetProject = lookup.project;
    }
    var tp = { name: p.name }; if (p.note) tp.note = p.note;
    var task = of.InboxTask(tp); doc.inboxTasks.push(task);
    var changes = applyTaskProps(of, doc, task, p);
    var warnings = extractWarnings(changes);
    if (targetProject) task.assignedContainer = targetProject;
    return ok({ id: task.id(), name: task.name(), task: formatTask(task), changes: changes, warnings: warnings });
};

ops["inbox.process"] = function(of, doc, p) {
    if (!p.id) return fail("Task ID required");
    var task = null;
    try {
        var inboxTasks = doc.inboxTasks();
        for (var i = 0; i < inboxTasks.length; i++) {
            if (inboxTasks[i].id() === p.id) { task = inboxTasks[i]; break; }
        }
        if (!task) task = findTaskById(doc, p.id);
    } catch(e) { return fail("Error searching for task: " + e.message); }
    if (!task) return fail("Task not found with ID: " + p.id);

    if (p.dryRun) {
        var planned = [];
        if (p.name) planned.push("rename → " + p.name);
        if (p.project) planned.push("move → " + p.project);
        if (p.tags && p.tags.length) planned.push("add tags: " + p.tags.join(", "));
        if (p.due) planned.push(p.due === "clear" ? "clear due" : "due → " + p.due);
        if (p.defer) planned.push(p.defer === "clear" ? "clear defer" : "defer → " + p.defer);
        if (p.planned) planned.push(p.planned === "clear" ? "clear planned" : "planned → " + p.planned);
        if (p.complete) planned.push("complete");
        if (p["delete"]) planned.push("DELETE");
        return ok({ id: p.id, dryRun: true, name: task.name(), planned: planned });
    }

    if (p["delete"]) {
        if (!p.confirm) return fail("Delete requires confirm: true for safety");
        var name = task.name();
        of.delete(task);
        return ok({ id: p.id, changes: ["deleted"], name: name });
    }

    var changes = [];
    if (p.complete) { try { task.markComplete(); } catch(e) { task.completed = true; } changes.push("completed"); }
    if (p.name) { task.name = p.name; changes.push("renamed → " + p.name); }
    if (p.note !== null && p.note !== undefined) { task.note = p.note; changes.push("note set"); }
    if (p.noteAppend) { var ex = task.note() || ""; task.note = ex + (ex ? "\n" : "") + p.noteAppend; changes.push("note appended"); }
    if (p.project) {
        var pl = findExistingProject(doc, p.project);
        if (pl.project) { task.assignedContainer = pl.project; changes.push("moved to project: " + pl.project.name()); }
        else { changes.push("project lookup failed: " + pl.error); }
    }
    var pc = applyTaskProps(of, doc, task, p); changes = changes.concat(pc);
    return ok({ id: p.id, changes: changes, task: formatTask(task) });
};

// ── Forecast ────────────────────────────────────────────────────────────

ops["forecast"] = function(of, doc, p) {
    var upcomingDays = p.days || 3;
    var includeFlagged = p.includeFlagged || false;
    var includeAvailable = p.includeAvailable || false;

    var now = new Date();
    var todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    var todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    var yesterdayEnd = new Date(todayStart.getTime() - 1);
    var upcomingEnd = new Date(todayStart); upcomingEnd.setDate(upcomingEnd.getDate() + upcomingDays); upcomingEnd.setHours(23, 59, 59, 999);
    var todayStr = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0") + "-" + String(now.getDate()).padStart(2, "0");

    // Batch property access
    var tasks = doc.flattenedTasks;
    var allCompleted = tasks.completed(), allDueDates = tasks.dueDate(), allDeferDates = tasks.deferDate();
    var allFlagged = tasks.flagged(), allNames = tasks.name(), allIds = tasks.id(), allNotes = tasks.note();
    var allEstimates; try { allEstimates = tasks.estimatedMinutes(); } catch(e) { allEstimates = []; }
    var allPlannedDates; try { allPlannedDates = tasks.plannedDate(); } catch(e) { allPlannedDates = []; }
    // A task inside a completed/dropped project (or parent task) keeps its own
    // completed flag false — only the effective status reflects the container.
    var allEffCompleted; try { allEffCompleted = tasks.effectivelyCompleted(); } catch(e) { allEffCompleted = []; }
    var allEffDropped; try { allEffDropped = tasks.effectivelyDropped(); } catch(e) { allEffDropped = []; }
    var total = allCompleted.length;

    var overdueIdx = [], dueTodayIdx = [], plannedTodayIdx = [], deferredTodayIdx = [];
    var flaggedIdx = [], upcomingIdx = [], availableIdx = [], seenIdx = {};

    for (var i = 0; i < total; i++) {
        if (allCompleted[i]) continue;
        if (allEffCompleted.length > i && allEffCompleted[i]) continue;
        if (allEffDropped.length > i && allEffDropped[i]) continue;
        var due = allDueDates[i], defer = allDeferDates[i];
        var planned = allPlannedDates.length > i ? allPlannedDates[i] : null;
        if (defer && defer > todayEnd && (!due || due > todayEnd) && (!planned || planned > todayEnd)) continue;
        if (due && due < todayStart) { overdueIdx.push(i); seenIdx[i] = true; continue; }
        if (due && due >= todayStart && due <= todayEnd) { dueTodayIdx.push(i); seenIdx[i] = true; continue; }
        if (planned && planned >= todayStart && planned <= todayEnd && !seenIdx[i]) { plannedTodayIdx.push(i); seenIdx[i] = true; continue; }
        if (defer && defer > yesterdayEnd && defer <= todayEnd && (!due || due > todayEnd)) { deferredTodayIdx.push(i); seenIdx[i] = true; continue; }
        if (includeFlagged && allFlagged[i] && !seenIdx[i]) { flaggedIdx.push(i); seenIdx[i] = true; continue; }
        if (due && due > todayEnd && due <= upcomingEnd) { upcomingIdx.push(i); seenIdx[i] = true; continue; }
        if (includeAvailable && !seenIdx[i] && availableIdx.length < 20) {
            if (!defer || defer <= todayEnd) { availableIdx.push(i); seenIdx[i] = true; }
        }
    }

    var taskRefs = doc.flattenedTasks();
    function fmtIdx(idx) {
        var t = taskRefs[idx], name = allNames[idx], due = allDueDates[idx];
        var defer = allDeferDates[idx], planned = allPlannedDates.length > idx ? allPlannedDates[idx] : null;
        var est = allEstimates.length > idx ? allEstimates[idx] : null;
        var project = null; try { var pp = t.containingProject(); if (pp) project = pp.name(); } catch(e) {}
        var tagNames = []; try { var tgs = t.tags(); for (var j = 0; j < tgs.length; j++) tagNames.push(tgs[j].name()); } catch(e) {}
        var rep = null; try { var rr = t.repetitionRule(); if (rr) { var m = null; try { m = rr.method(); } catch(e2) {} rep = { rule: rr.recurrenceString(), method: m }; } } catch(e) {}
        var seq = false; try { seq = t.sequential(); } catch(e) {}
        var cd = null; try { var cdt = t.creationDate(); if (cdt) cd = cdt.toISOString(); } catch(e) {}
        var md = null; try { var mdt = t.modificationDate(); if (mdt) md = mdt.toISOString(); } catch(e) {}
        var edDue = null; try { var ed = t.effectiveDueDate(); if (ed) edDue = ed.toISOString(); } catch(e) {}
        var edDefer = null; try { var edf = t.effectiveDeferDate(); if (edf) edDefer = edf.toISOString(); } catch(e) {}
        var edPlanned = null; try { var ep = t.effectivePlannedDate(); if (ep) edPlanned = ep.toISOString(); } catch(e) {}
        var efFlag = allFlagged[idx]; try { efFlag = t.effectiveFlagged(); } catch(e) {}
        var blocked = false; try { blocked = t.blocked(); } catch(e) {}
        var cc = 0; try { cc = t.tasks().length; } catch(e) {}
        var parent = null; try { var pt = t.parentTask(); if (pt) parent = { id: pt.id(), name: pt.name() }; } catch(e) {}

        var daysOverdue = due ? Math.floor((now.getTime() - due.getTime()) / 86400000) : null;

        return {
            name: name, id: allIds[idx], note: allNotes[idx] || "",
            dueDate: due ? due.toISOString() : null, deferDate: defer ? defer.toISOString() : null,
            plannedDate: planned ? planned.toISOString() : null,
            effectiveDueDate: edDue, effectiveDeferDate: edDefer, effectivePlannedDate: edPlanned,
            flagged: allFlagged[idx], effectiveFlagged: efFlag,
            project: project || "Inbox", parentTask: parent, tags: tagNames,
            estimatedMinutes: est, sequential: seq, blocked: blocked,
            repetitionRule: rep, childCount: cc, creationDate: cd, modificationDate: md,
            completed: false, completionDate: null, inInbox: false,
            daysOverdue: daysOverdue
        };
    }

    function cmpDate(a, b) { if (!a && !b) return 0; if (!a) return 1; if (!b) return -1; return new Date(a).getTime() - new Date(b).getTime(); }
    var overdue = overdueIdx.map(fmtIdx).sort(function(a,b) { return cmpDate(a.dueDate, b.dueDate); });
    var dueToday = dueTodayIdx.map(fmtIdx).sort(function(a,b) { return cmpDate(a.dueDate, b.dueDate); });
    var plannedToday = plannedTodayIdx.map(fmtIdx).sort(function(a,b) { return cmpDate(a.plannedDate, b.plannedDate); });
    var deferredToday = deferredTodayIdx.map(fmtIdx);
    var flaggedTasks = flaggedIdx.map(fmtIdx);
    var upcoming = upcomingIdx.map(fmtIdx).sort(function(a,b) { return cmpDate(a.dueDate, b.dueDate); });
    var availableNext = availableIdx.slice(0, 10).map(fmtIdx);

    var todayTasks = overdue.concat(dueToday).concat(plannedToday).concat(deferredToday);
    if (includeFlagged) todayTasks = todayTasks.concat(flaggedTasks);
    var totalEst = 0;
    for (var k = 0; k < todayTasks.length; k++) {
        if (todayTasks[k].estimatedMinutes) totalEst += todayTasks[k].estimatedMinutes;
    }

    var dragAlerts = [];
    for (var m = 0; m < overdue.length; m++) {
        if (overdue[m].daysOverdue >= 3) {
            dragAlerts.push({
                name: overdue[m].name, id: overdue[m].id, daysOverdue: overdue[m].daysOverdue,
                suggestion: overdue[m].daysOverdue >= 7
                    ? "Overdue 7+ days — needs re-evaluation"
                    : "Overdue 3+ days — consider re-prioritizing"
            });
        }
    }

    return ok({
        meta: {
            generatedAt: now.toISOString(), today: todayStr, upcomingDays: upcomingDays,
            totalEstimatedMinutes: totalEst,
            counts: { overdue: overdue.length, dueToday: dueToday.length, plannedToday: plannedToday.length, deferredToday: deferredToday.length, flagged: flaggedTasks.length, upcoming: upcoming.length, availableNext: availableNext.length },
            dragAlerts: dragAlerts
        },
        overdue: overdue, due_today: dueToday, planned_today: plannedToday,
        deferred_today: deferredToday, flagged: flaggedTasks, upcoming: upcoming, available_next: availableNext
    });
};

// ── Review ──────────────────────────────────────────────────────────────

ops["review"] = function(of, doc, p) {
    var days = p.days || 7;
    var now = new Date();
    var cutoff = new Date(now); cutoff.setDate(cutoff.getDate() - days);
    cutoff.setHours(0, 0, 0, 0);

    var ft = doc.flattenedTasks;
    var allCompleted = ft.completed(), allCompDates = ft.completionDate();
    var allNames = ft.name(), allIds = ft.id(), allNotes = ft.note();
    var allEstimates; try { allEstimates = ft.estimatedMinutes(); } catch(e) { allEstimates = []; }
    var total = allCompleted.length;

    var taskRefs = ft();
    var completedTasks = [], byProject = {}, byDay = {};
    var totalEst = 0;

    for (var i = 0; i < total; i++) {
        if (!allCompleted[i]) continue;
        var cd = allCompDates[i];
        if (!cd || cd < cutoff) continue;
        var t = taskRefs[i], name = allNames[i];
        var tagNames = []; try { tagNames = t.tags().map(function(tg) { return tg.name(); }); } catch(e) {}
        var project = null; try { var pp = t.containingProject(); if (pp) project = pp.name(); } catch(e) {}

        var task = {
            name: name, id: allIds[i], note: allNotes[i] || "",
            project: project || "No Project", tags: tagNames,
            completionDate: cd.toISOString(),
            estimatedMinutes: allEstimates.length > i ? allEstimates[i] : null
        };
        completedTasks.push(task);

        if (task.estimatedMinutes) totalEst += task.estimatedMinutes;

        var dayKey = cd.getFullYear() + "-" + String(cd.getMonth() + 1).padStart(2, "0") + "-" + String(cd.getDate()).padStart(2, "0");
        byDay[dayKey] = (byDay[dayKey] || 0) + 1;
        byProject[task.project] = (byProject[task.project] || 0) + 1;
    }

    // Active project progress
    var projects = doc.flattenedProjects(), projectProgress = [];
    for (var j = 0; j < projects.length; j++) {
        var pj = projects[j];
        try { if (pj.status().toString() !== "active status") continue; } catch(e) {}
        // Batch property access — per-task Apple Events time out on large databases
        var pjCompleted; try { pjCompleted = pj.flattenedTasks.completed(); } catch(e) { pjCompleted = []; }
        var tc = pjCompleted.length, cc = 0;
        for (var k = 0; k < tc; k++) { if (pjCompleted[k]) cc++; }
        if (tc > 0) projectProgress.push({ name: pj.name(), taskCount: tc, completedCount: cc, percentage: Math.round((cc / tc) * 100) });
    }

    return ok({
        meta: { generatedAt: now.toISOString(), periodStart: cutoff.toISOString(), periodEnd: now.toISOString(), daysReviewed: days },
        completedTasks: completedTasks,
        summary: { totalCompleted: completedTasks.length, byProject: byProject, byDay: byDay, totalEstimatedMinutes: totalEst },
        projectProgress: projectProgress
    });
};

// ── Stats ───────────────────────────────────────────────────────────────

ops["stats"] = function(of, doc) {
    var now = new Date(), threeDays = new Date(); threeDays.setDate(threeDays.getDate() + 3);
    // Batch property access — per-task Apple Events time out on large databases
    var ft = doc.flattenedTasks;
    var allCompleted = ft.completed(), allFlagged = ft.flagged(), allDueDates = ft.dueDate();
    var allEstimates; try { allEstimates = ft.estimatedMinutes(); } catch(e) { allEstimates = []; }
    var allBlocked; try { allBlocked = ft.blocked(); } catch(e) { allBlocked = []; }
    var allRepetition; try { allRepetition = ft.repetitionRule(); } catch(e) { allRepetition = []; }
    var allSequential; try { allSequential = ft.sequential(); } catch(e) { allSequential = []; }
    var total = allCompleted.length, incomplete = 0, completed = 0, flagged = 0, overdue = 0, dueSoon = 0;
    var available = 0, blocked = 0, withEst = 0, totalEst = 0, repeating = 0, sequential = 0;

    for (var i = 0; i < total; i++) {
        if (allCompleted[i]) { completed++; continue; }
        incomplete++;
        if (allFlagged[i]) flagged++;
        var dd = allDueDates[i];
        if (dd) { if (dd < now) overdue++; else if (dd < threeDays) dueSoon++; }
        if (allBlocked.length > i && allBlocked[i]) blocked++; else available++;
        var est = allEstimates.length > i ? allEstimates[i] : null;
        if (est) { withEst++; totalEst += est; }
        if (allRepetition.length > i && allRepetition[i]) repeating++;
        if (allSequential.length > i && allSequential[i]) sequential++;
    }

    // Count only unprocessed (incomplete) inbox items — completed tasks
    // linger in inboxTasks until cleanup and would inflate the number
    var inboxCompleted = doc.inboxTasks.completed(), inboxCount = 0;
    for (var ii = 0; ii < inboxCompleted.length; ii++) { if (!inboxCompleted[ii]) inboxCount++; }

    var projects = doc.flattenedProjects();
    var pTotal = 0, pActive = 0, pOnHold = 0, pCompleted = 0, pDropped = 0;
    for (var j = 0; j < projects.length; j++) {
        pTotal++;
        try {
            var s = projects[j].status().toString();
            if (s === "active status") pActive++;
            else if (s === "on hold status") pOnHold++;
            else if (s === "done status") pCompleted++;
            else if (s === "dropped status") pDropped++;
        } catch(e) { pActive++; }
    }

    return ok({
        tasks: { total: total, incomplete: incomplete, completed: completed, inbox: inboxCount, flagged: flagged, overdue: overdue, dueSoon: dueSoon, available: available, blocked: blocked, withEstimates: withEst, totalEstimatedMinutes: totalEst, repeating: repeating, sequential: sequential },
        projects: { total: pTotal, active: pActive, onHold: pOnHold, completed: pCompleted, dropped: pDropped }
    });
};

// ── Bulk operations ─────────────────────────────────────────────────────

ops["bulk.create"] = function(of, doc, p) {
    if (!p.tasks || !Array.isArray(p.tasks)) return fail("tasks array required");
    if (p.tasks.length > 100) return fail("Bulk create limited to 100 per batch");
    var results = [];
    for (var i = 0; i < p.tasks.length; i++) {
        var input = p.tasks[i];
        try {
            var r = createTaskRecord(of, doc, input);
            if (r.error) { results.push({ ok: false, error: r.error, name: input.name }); continue; }
            var item = r.data; item.ok = true;
            results.push(item);
        } catch(e) { results.push({ ok: false, error: e.message, name: input.name }); }
    }
    return ok(results);
};

ops["bulk.update"] = function(of, doc, p) {
    if (!p.updates || !Array.isArray(p.updates)) return fail("updates array required");
    if (p.updates.length > 100) return fail("Bulk update limited to 100 per batch");
    var results = [];
    for (var i = 0; i < p.updates.length; i++) {
        var input = p.updates[i];
        try {
            if (!input.id) { results.push({ ok: false, error: "Task ID required" }); continue; }
            var task = findTaskById(doc, input.id);
            if (!task) { results.push({ ok: false, error: "Task not found", id: input.id }); continue; }
            var changes = [];
            if (input.complete) { try { task.markComplete(); } catch(e) { task.completed = true; } changes.push("completed"); }
            if (input.incomplete) { try { task.markIncomplete(); } catch(e) { task.completed = false; } changes.push("uncompleted"); }
            if (input.name) { task.name = input.name; changes.push("renamed → " + input.name); }
            if (input.note) { task.note = input.note; changes.push("note updated"); }
            if (input.noteAppend) { var ex = task.note() || ""; task.note = ex + (ex ? "\n" : "") + input.noteAppend; changes.push("note appended"); }
            var pc = applyTaskProps(of, doc, task, input); changes = changes.concat(pc);
            if (input.project) {
                var pl = findExistingProject(doc, input.project);
                if (pl.project) { task.assignedContainer = pl.project; changes.push("moved to " + input.project); }
                else { changes.push("project move failed: " + pl.error); }
            }
            results.push({ ok: true, id: task.id(), changes: changes, task: formatTask(task) });
        } catch(e) { results.push({ ok: false, error: e.message, id: input.id }); }
    }
    return ok(results);
};

ops["bulk.complete"] = function(of, doc, p) {
    if (!p.ids || !Array.isArray(p.ids)) return fail("ids array required");
    if (p.ids.length > 100) return fail("Bulk complete limited to 100 per batch");
    var results = [];
    for (var i = 0; i < p.ids.length; i++) {
        try {
            var task = findTaskById(doc, p.ids[i]);
            if (!task) { results.push({ ok: false, error: "Task not found", id: p.ids[i] }); continue; }
            if (p.incomplete) { try { task.markIncomplete(); } catch(e) { task.completed = false; } }
            else { try { task.markComplete(); } catch(e) { task.completed = true; } }
            results.push({ ok: true, id: task.id(), name: task.name(), task: formatTask(task) });
        } catch(e) { results.push({ ok: false, error: e.message, id: p.ids[i] }); }
    }
    return ok(results);
};

// ── Collect completed ───────────────────────────────────────────────────

ops["collect"] = function(of, doc, p) {
    var days = p.days || 7;
    var cutoff = new Date(); cutoff.setDate(cutoff.getDate() - days); cutoff.setHours(0, 0, 0, 0);
    var matches = doc.flattenedTasks.whose({ completed: true, completionDate: { '>': cutoff } })();
    var results = [];
    for (var i = 0; i < matches.length; i++) {
        var t = matches[i], name = t.name();
        var tagNames = []; try { tagNames = t.tags().map(function(tg) { return tg.name(); }); } catch(e) {}
        var project = null; try { var pp = t.containingProject(); if (pp) project = pp.name(); } catch(e) {}
        results.push({
            omnifocus_id: t.id(), name: name, project: project || "No Project",
            completion_date: t.completionDate().toISOString(),
            tags: tagNames, estimated_minutes: t.estimatedMinutes() || null,
            note: t.note() || ""
        });
    }
    return ok(results);
};

// ── Dispatcher ──────────────────────────────────────────────────────────────

// Large command payloads (bulk ops, long notes) are piped through stdin
// instead of argv, which has a hard size limit (ARG_MAX). The TS side sends
// the literal argument "@stdin" to signal this.
function readCommandFromStdin() {
    ObjC.import('Foundation');
    var data = $.NSFileHandle.fileHandleWithStandardInput.readDataToEndOfFile;
    var str = ObjC.unwrap($.NSString.alloc.initWithDataEncoding(data, $.NSUTF8StringEncoding));
    if (typeof str !== "string") throw new Error("stdin was not valid UTF-8");
    return str;
}

function run(args) {
    if (args.length === 0) return fail("Command JSON required as first argument");
    var commandJson = args[0];
    if (commandJson === "@stdin") {
        try { commandJson = readCommandFromStdin(); }
        catch(e) { return fail("Failed to read command JSON from stdin: " + e.message); }
    }
    var cmd;
    try { cmd = JSON.parse(commandJson); } catch(e) { return fail("Invalid command JSON: " + e.message); }
    if (!cmd.op) return fail("Missing 'op' in command");

    var handler = ops[cmd.op];
    if (!handler) return fail("Unknown operation: " + cmd.op);

    // Application() throws when OmniFocus is not installed; keep that inside
    // a try so the CLI gets a structured failure instead of raw osascript stderr.
    var of, doc;
    try {
        of = Application('OmniFocus');
        of.includeStandardAdditions = true;
        doc = of.defaultDocument;
    } catch(e) {
        return fail("OmniFocus could not be opened: " + e.message);
    }

    try {
        return handler(of, doc, cmd.params || {});
    } catch(e) {
        return fail("Operation '" + cmd.op + "' failed: " + e.message);
    }
}
