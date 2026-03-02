// _omnifocus_lib.js — Shared OmniFocus JXA helper library
// Loaded by all OmniFocus scripts via eval() + NSString bridge
//
// Usage in scripts:
//   ObjC.import("Foundation");
//   var lib = (function() {
//       var data = $.NSString.stringWithContentsOfFileEncodingError(
//           '/Users/max/.openclaw/workspace/skills/omnifocus/scripts/_omnifocus_lib.js',
//           $.NSUTF8StringEncoding, null);
//       if (!data) throw new Error("Cannot load _omnifocus_lib.js");
//       return eval('(' + ObjC.unwrap(data) + ')');
//   })();

(function() {

    // ── Date helpers ─────────────────────────────────────────────

    /**
     * Parse a date string into a local Date object.
     * Supports: YYYY-MM-DD, YYYY-MM-DDTHH:MM, generic fallback.
     * All dates are local timezone (not UTC).
     */
    function parseDate(str) {
        if (!str) throw new Error("Date string required");
        // YYYY-MM-DDTHH:MM
        if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(str)) {
            var parts = str.split('T');
            var d = parts[0].split('-').map(Number);
            var t = parts[1].split(':').map(Number);
            return new Date(d[0], d[1] - 1, d[2], t[0], t[1]);
        }
        // YYYY-MM-DD
        if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
            var d = str.split('-').map(Number);
            return new Date(d[0], d[1] - 1, d[2]);
        }
        // Fallback (local interpretation)
        var parsed = new Date(str);
        if (isNaN(parsed.getTime())) throw new Error("Invalid date: " + str);
        return parsed;
    }

    /**
     * Normalize repeat method string to OmniFocus expected values.
     * Returns "due date" or "due after completion".
     */
    function normalizeRepeatMethod(method) {
        if (!method) return "due date";
        var m = method.toLowerCase().replace(/[-_]/g, " ").trim();
        if (m === "due date" || m === "due" || m === "fixed") return "due date";
        if (m === "completion" || m === "completion date" || m === "due after completion") return "due after completion";
        return method;
    }

    // ── Tag helpers ──────────────────────────────────────────────

    /**
     * Find a tag by exact name match.
     * @returns tag reference or null
     */
    function findTag(doc, name) {
        var tags = doc.flattenedTags();
        for (var i = 0; i < tags.length; i++) {
            if (tags[i].name() === name) return tags[i];
        }
        return null;
    }

    /**
     * Find existing tag by exact name, then substring. Never creates.
     * Returns { tag } on success, { error, candidates? } on failure.
     * @param doc - default document
     * @param name - tag name to search for
     * @returns { tag } | { error, candidates? }
     */
    function findExistingTag(doc, name) {
        // 1. Exact match
        var exact = findTag(doc, name);
        if (exact) return { tag: exact };

        // 2. Case-insensitive substring match
        var lower = name.toLowerCase();
        var tags = doc.flattenedTags();
        var matches = [];
        for (var i = 0; i < tags.length; i++) {
            if (tags[i].name().toLowerCase().indexOf(lower) !== -1) {
                matches.push(tags[i]);
            }
        }

        if (matches.length === 1) return { tag: matches[0] };
        if (matches.length > 1) {
            return {
                error: "Ambiguous: " + matches.length + " tags match \"" + name + "\"",
                candidates: matches.slice(0, 10).map(function(t) { return t.name(); })
            };
        }

        return { error: "Tag not found: \"" + name + "\"" };
    }

    // ── Project helpers ──────────────────────────────────────────

    /**
     * Find a project by name. Tries exact match first, then substring.
     * @returns project reference or null
     */
    function findProject(doc, name) {
        var projects = doc.flattenedProjects();
        // Exact match first
        for (var i = 0; i < projects.length; i++) {
            if (projects[i].name() === name) return projects[i];
        }
        // Substring match
        var lower = name.toLowerCase();
        for (var j = 0; j < projects.length; j++) {
            if (projects[j].name().toLowerCase().indexOf(lower) !== -1) return projects[j];
        }
        return null;
    }

    /**
     * Find existing project by exact name, then substring. Never creates.
     * Returns { project } on success, { error, candidates? } on failure.
     * @param doc - default document
     * @param name - project name to search for
     * @param opts - optional: { folder } to search within specific folder
     * @returns { project } | { error, candidates? }
     */
    function findExistingProject(doc, name, opts) {
        opts = opts || {};
        var searchProjects = opts.folder ? opts.folder.flattenedProjects() : doc.flattenedProjects();

        // 1. Exact match
        for (var i = 0; i < searchProjects.length; i++) {
            if (searchProjects[i].name() === name) return { project: searchProjects[i] };
        }

        // 2. Case-insensitive substring match
        var lower = name.toLowerCase();
        var matches = [];
        for (var j = 0; j < searchProjects.length; j++) {
            if (searchProjects[j].name().toLowerCase().indexOf(lower) !== -1) {
                matches.push(searchProjects[j]);
            }
        }

        if (matches.length === 1) return { project: matches[0] };
        if (matches.length > 1) {
            return {
                error: "Ambiguous: " + matches.length + " projects match \"" + name + "\"",
                candidates: matches.slice(0, 10).map(function(p) { return p.name(); })
            };
        }

        return { error: "Project not found: \"" + name + "\"" };
    }

    // ── Task lookup helpers ──────────────────────────────────────

    /**
     * Find a task by its OmniFocus ID.
     * @returns task reference or null
     */
    function findTaskById(doc, id) {
        try {
            var task = doc.flattenedTasks.byId(id);
            if (task && task.name()) return task;
        } catch(e) {}
        return null;
    }

    /**
     * Find a task by query: tries ID → exact name → substring.
     * Only considers incomplete tasks. Returns disambiguation info on ambiguity.
     * @param doc - default document
     * @param query - name or ID string
     * @param opts - optional: { searchCompleted: false, idFlag: "--id" }
     * @returns { task } on success, { error, candidates? } on failure
     */
    function findTaskByQuery(doc, query, opts) {
        opts = opts || {};
        var searchCompleted = opts.searchCompleted || false;
        var idFlag = opts.idFlag || "--id";

        // 1. Try as ID first (fast path)
        var byId = findTaskById(doc, query);
        if (byId) return { task: byId };

        // 2. Exact name match
        try {
            var exactMatches = doc.flattenedTasks.whose({ name: query })();
            var filtered = [];
            for (var i = 0; i < exactMatches.length; i++) {
                var isCompleted = exactMatches[i].completed();
                if (searchCompleted ? isCompleted : !isCompleted) {
                    filtered.push(exactMatches[i]);
                }
            }
            if (filtered.length === 1) return { task: filtered[0] };
            if (filtered.length > 1) {
                return {
                    error: "Ambiguous: " + filtered.length + " tasks match \"" + query + "\". Use " + idFlag + " to specify.",
                    candidates: formatCandidates(filtered)
                };
            }
        } catch(e) {}

        // 3. Substring match
        try {
            var subMatches = doc.flattenedTasks.whose({ name: { _contains: query } })();
            var filteredSub = [];
            for (var j = 0; j < subMatches.length; j++) {
                var isComp = subMatches[j].completed();
                if (searchCompleted ? isComp : !isComp) {
                    filteredSub.push(subMatches[j]);
                }
            }
            if (filteredSub.length === 1) return { task: filteredSub[0] };
            if (filteredSub.length > 1) {
                return {
                    error: "Ambiguous: " + filteredSub.length + " tasks contain \"" + query + "\". Use " + idFlag + " to specify.",
                    candidates: formatCandidates(filteredSub)
                };
            }
        } catch(e) {}

        return { error: "Task not found: \"" + query + "\"" };
    }

    /**
     * Format task candidates for disambiguation error messages.
     * Returns up to 5 candidates with id, name, project.
     */
    function formatCandidates(tasks) {
        return tasks.slice(0, 5).map(function(t) {
            var proj = null;
            try { var p = t.containingProject(); if (p) proj = p.name(); } catch(e) {}
            return { id: t.id(), name: t.name(), project: proj || "Inbox" };
        });
    }

    // ── Task output ──────────────────────────────────────────────

    /**
     * Format a task as a full JSON-serializable object.
     * Includes ALL standard fields + plannedDate (OmniFocus 4.7+).
     */
    function formatTaskFull(task) {
        var project = null;
        try { var p = task.containingProject(); if (p) project = p.name(); } catch(e) {}

        var parent = null;
        try { var pt = task.parentTask(); if (pt) parent = { id: pt.id(), name: pt.name() }; } catch(e) {}

        var tagNames = [];
        try { tagNames = task.tags().map(function(t) { return t.name(); }); } catch(e) {}

        var repetition = null;
        try {
            var rr = task.repetitionRule();
            if (rr) {
                var method = null;
                try { method = rr.method(); } catch(e2) {}
                repetition = { rule: rr.recurrenceString(), method: method };
            }
        } catch(e) {}

        var childCount = 0;
        try { childCount = task.tasks().length; } catch(e) {}

        return {
            name: task.name(),
            id: task.id(),
            note: task.note() || "",
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
            project: project || "Inbox",
            parentTask: parent,
            tags: tagNames,
            repetitionRule: repetition,
            childCount: childCount
        };
    }

    // ── Project output ───────────────────────────────────────────

    /**
     * Format a project as a full JSON-serializable object.
     * Includes all standard fields for comprehensive project data.
     */
    function formatProjectFull(project) {
        var folder = null;
        try {
            var pf = project.parentFolder();
            if (pf) folder = pf.name();
        } catch(e) {}

        var tagNames = [];
        try { tagNames = project.tags().map(function(t) { return t.name(); }); } catch(e) {}

        var taskCount = 0;
        var completedTaskCount = 0;
        try {
            var tasks = project.flattenedTasks();
            taskCount = tasks.length;
            for (var i = 0; i < tasks.length; i++) {
                if (tasks[i].completed()) completedTaskCount++;
            }
        } catch(e) {}

        var status = "active";
        try {
            var s = project.status();
            if (s) status = s.toString().replace(" status", "").toLowerCase();
        } catch(e) {}

        return {
            id: project.id(),
            name: project.name(),
            note: project.note() || "",
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
            parentFolder: folder,
            tags: tagNames,
            taskCount: taskCount,
            completedTaskCount: completedTaskCount
        };
    }

    /**
     * Format a project in compact JSON format (token-efficient for lists).
     * Returns only essential fields: id, name, status, taskCount.
     */
    function formatProjectCompact(project) {
        var taskCount = 0;
        try { taskCount = project.flattenedTasks().length; } catch(e) {}

        var status = "active";
        try {
            var s = project.status();
            if (s) status = s.toString().replace(" status", "").toLowerCase();
        } catch(e) {}

        return {
            id: project.id(),
            name: project.name(),
            status: status,
            taskCount: taskCount
        };
    }

    /**
     * Normalize project status string to OmniFocus expected values.
     * @param status - status string (active|done|onhold|dropped)
     * @returns normalized status or throws error for invalid input
     */
    function normalizeProjectStatus(status) {
        if (!status) throw new Error("Status required");
        var s = status.toLowerCase().replace(/[-_\s]/g, "");

        if (s === "active") return "active status";
        if (s === "done" || s === "completed") return "done status";
        if (s === "onhold" || s === "hold") return "on hold status";
        if (s === "dropped") return "dropped status";

        throw new Error("Invalid status: \"" + status + "\". Must be active, done, onhold, or dropped.");
    }

    // ── Taxonomy parsing ─────────────────────────────────────────

    /**
     * Parse spoon cost from task name emoji and tag names.
     * Checks name first (emoji prefix), then tags as fallback.
     * @returns { cost: number|null, emoji: string|null }
     */
    function parseSpoonCost(name, tags) {
        // Check name emoji first (Unicode escape for JXA compatibility)
        if (name.indexOf("\uD83D\uDC38") !== -1) return { cost: 10, emoji: "🐸" };
        if (name.indexOf("\uD83D\uDCA5") !== -1) return { cost: 7, emoji: "💥" };
        if (name.indexOf("\uD83D\uDD0B") !== -1) return { cost: 4, emoji: "🔋" };
        if (name.indexOf("\uD83E\uDEAB") !== -1) return { cost: 1.5, emoji: "🪫" };
        if (name.indexOf("\uD83D\uDD0C") !== -1) return { cost: -5, emoji: "🔌" };

        // Fallback to tag names
        for (var i = 0; i < tags.length; i++) {
            var t = tags[i];
            if (t.indexOf("🐸") !== -1) return { cost: 10, emoji: "🐸" };
            if (t.indexOf("💥") !== -1) return { cost: 7, emoji: "💥" };
            if (t.indexOf("🔋") !== -1) return { cost: 4, emoji: "🔋" };
            if (t.indexOf("🪫") !== -1) return { cost: 1.5, emoji: "🪫" };
            if (t.indexOf("🔌") !== -1) return { cost: -5, emoji: "🔌" };
        }
        return { cost: null, emoji: null };
    }

    /**
     * Parse priority from task name emoji and tag names.
     * @returns "P1"|"P2"|"P3"|"P4"|null
     */
    function parsePriority(name, tags) {
        if (name.indexOf("🔴") !== -1) return "P1";
        if (name.indexOf("🟠") !== -1) return "P2";
        if (name.indexOf("🟡") !== -1) return "P3";
        if (name.indexOf("🔵") !== -1) return "P4";
        // Tags only carry P1/P2
        for (var i = 0; i < tags.length; i++) {
            if (tags[i].indexOf("🔴") !== -1) return "P1";
            if (tags[i].indexOf("🟠") !== -1) return "P2";
        }
        return null;
    }

    /**
     * Parse deadline rigidity from task name emoji.
     * @returns "fixed"|"firm"|"target"|null
     */
    function parseRigidity(name) {
        if (name.indexOf("‼️") !== -1) return "fixed";
        if (name.indexOf("⚠️") !== -1) return "firm";
        if (name.indexOf("📌") !== -1) return "target";
        return null;
    }

    /**
     * Compare two ISO date strings for sorting.
     * Nulls sort to the end.
     */
    function cmpDate(a, b) {
        if (!a && !b) return 0;
        if (!a) return 1;
        if (!b) return -1;
        return new Date(a).getTime() - new Date(b).getTime();
    }

    // ── Error helper ─────────────────────────────────────────────

    /**
     * Build a standardized error JSON string.
     * @param message - error description
     * @param extra - optional object with additional fields (candidates, usage, etc.)
     * @returns JSON string
     */
    function err(message, extra) {
        var result = { ok: false, error: message };
        if (extra) {
            for (var key in extra) {
                if (extra.hasOwnProperty(key)) {
                    result[key] = extra[key];
                }
            }
        }
        return JSON.stringify(result);
    }

    // ── Argument parsing ─────────────────────────────────────────

    /**
     * Generic argument parser driven by a schema.
     *
     * Schema keys define what flags to accept. Values define types:
     *   true       — first positional arg (only ONE key should be true)
     *   'string'   — --flag "value" (stores string, null if absent)
     *   'boolean'  — --flag (stores true/false)
     *   'array'    — --flag "value" (repeatable, stores array)
     *   'int'      — --flag N (stores parseInt result, null if absent)
     *   'intOrClear' — --flag N|clear (stores int or "clear")
     *
     * Flag names are derived from camelCase keys:
     *   taskName → positional (true), note → --note, repeatMethod → --repeat-method
     *   parentId → --parent-id, noteAppend → --note-append
     *
     * @param args - argument array from run()
     * @param schema - { key: type, ... }
     * @returns parsed options object
     */
    function parseArgs(args, schema) {
        var opts = {};
        var flagMap = {};  // --flag-name → { key, type }
        var positionalKey = null;

        // Initialize defaults and build flag map
        for (var key in schema) {
            if (!schema.hasOwnProperty(key)) continue;
            var type = schema[key];

            if (type === true) {
                positionalKey = key;
                opts[key] = null;
            } else if (type === 'string' || type === 'int' || type === 'intOrClear') {
                opts[key] = null;
            } else if (type === 'boolean') {
                opts[key] = false;
            } else if (type === 'array') {
                opts[key] = [];
            }

            // Build flag name: camelCase → --kebab-case
            if (type !== true) {
                var flag = "--" + key.replace(/([A-Z])/g, function(m) { return "-" + m.toLowerCase(); });
                flagMap[flag] = { key: key, type: type };
            }
        }

        // Parse arguments
        for (var i = 0; i < args.length; i++) {
            var arg = args[i];
            var mapping = flagMap[arg];

            if (mapping) {
                switch (mapping.type) {
                    case 'boolean':
                        opts[mapping.key] = true;
                        break;
                    case 'string':
                        opts[mapping.key] = args[++i];
                        break;
                    case 'int':
                        opts[mapping.key] = parseInt(args[++i], 10);
                        break;
                    case 'intOrClear':
                        var val = args[++i];
                        opts[mapping.key] = (val === "clear") ? "clear" : parseInt(val, 10);
                        break;
                    case 'array':
                        opts[mapping.key].push(args[++i]);
                        break;
                }
            } else if (positionalKey && opts[positionalKey] === null && arg.substring(0, 2) !== "--") {
                opts[positionalKey] = arg;
            }
            // Unknown flags are silently ignored
        }

        return opts;
    }

    // ── Task property application ────────────────────────────────

    /**
     * Apply common task properties from parsed options.
     * Handles: due, defer, planned, flag, estimate, sequential, repeat, tags.
     *
     * @param of - OmniFocus Application reference
     * @param doc - default document
     * @param task - task to modify
     * @param opts - parsed options (from parseArgs)
     * @returns array of change descriptions (for update_task logging)
     */
    function applyTaskProps(of, doc, task, opts) {
        var changes = [];

        // Due date
        if (opts.due === "clear") {
            task.dueDate = null;
            changes.push("due date cleared");
        } else if (opts.due) {
            task.dueDate = parseDate(opts.due);
            changes.push("due: " + opts.due);
        }

        // Defer date
        if (opts.defer === "clear") {
            task.deferDate = null;
            changes.push("defer date cleared");
        } else if (opts.defer) {
            task.deferDate = parseDate(opts.defer);
            changes.push("defer: " + opts.defer);
        }

        // Planned date (OmniFocus 4.7+)
        if (opts.planned === "clear") {
            try { task.plannedDate = null; changes.push("planned date cleared"); } catch(e) { changes.push("planned date clear failed: " + e.message); }
        } else if (opts.planned) {
            try { task.plannedDate = parseDate(opts.planned); changes.push("planned: " + opts.planned); } catch(e) { changes.push("planned date set failed: " + e.message); }
        }

        // Flag
        if (opts.flag) {
            task.flagged = true;
            changes.push("flagged");
        }
        if (opts.unflag) {
            task.flagged = false;
            changes.push("unflagged");
        }

        // Estimate
        if (opts.estimate === "clear") {
            task.estimatedMinutes = null;
            changes.push("estimate cleared");
        } else if (opts.estimate !== null && opts.estimate !== undefined && opts.estimate > 0) {
            task.estimatedMinutes = opts.estimate;
            changes.push("estimate: " + opts.estimate + "min");
        }

        // Sequential / Parallel
        if (opts.sequential) {
            task.sequential = true;
            changes.push("set sequential");
        }
        if (opts.parallel) {
            task.sequential = false;
            changes.push("set parallel");
        }

        // Repetition rule
        if (opts.repeat === "clear") {
            task.repetitionRule = null;
            changes.push("repetition cleared");
        } else if (opts.repeat) {
            var method = normalizeRepeatMethod(opts.repeatMethod);
            task.repetitionRule = of.RepetitionRule({ ruleString: opts.repeat, method: method });
            changes.push("repetition: " + opts.repeat + " (" + method + ")");
        }

        // Add tags (strict: uses findExistingTag, never creates)
        if (opts.tags) {
            for (var i = 0; i < opts.tags.length; i++) {
                try {
                    var lookup = findExistingTag(doc, opts.tags[i]);
                    if (lookup.error) {
                        var msg = "tag failed (" + opts.tags[i] + "): " + lookup.error;
                        if (lookup.candidates) msg += " — candidates: " + lookup.candidates.join(", ");
                        changes.push(msg);
                        continue;
                    }
                    of.add(lookup.tag, { to: task.tags });
                    changes.push("tagged: " + opts.tags[i]);
                } catch(e) {
                    changes.push("tag failed (" + opts.tags[i] + "): " + e.message);
                }
            }
        }

        // Remove tags
        if (opts.removeTags) {
            for (var ri = 0; ri < opts.removeTags.length; ri++) {
                try {
                    var rtag = findTag(doc, opts.removeTags[ri]);
                    if (rtag) {
                        of.remove(rtag, { from: task.tags });
                        changes.push("untagged: " + opts.removeTags[ri]);
                    } else {
                        changes.push("tag not found: " + opts.removeTags[ri]);
                    }
                } catch(e) {
                    changes.push("untag failed (" + opts.removeTags[ri] + "): " + e.message);
                }
            }
        }

        return changes;
    }

    // ── Public API ───────────────────────────────────────────────

    return {
        // Date/repeat
        parseDate: parseDate,
        normalizeRepeatMethod: normalizeRepeatMethod,

        // Tags/projects
        findTag: findTag,
        findExistingTag: findExistingTag,
        findProject: findProject,
        findExistingProject: findExistingProject,

        // Task lookup
        findTaskById: findTaskById,
        findTaskByQuery: findTaskByQuery,
        formatCandidates: formatCandidates,

        // Task output
        formatTaskFull: formatTaskFull,

        // Project output
        formatProjectFull: formatProjectFull,
        formatProjectCompact: formatProjectCompact,
        normalizeProjectStatus: normalizeProjectStatus,

        // Taxonomy parsing
        parseSpoonCost: parseSpoonCost,
        parsePriority: parsePriority,
        parseRigidity: parseRigidity,
        cmpDate: cmpDate,

        // Arguments
        parseArgs: parseArgs,

        // Task property application
        applyTaskProps: applyTaskProps,

        // Error
        err: err
    };

})()
