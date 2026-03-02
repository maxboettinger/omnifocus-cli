#!/usr/bin/env osascript -l JavaScript

// Weekly Review: Completed tasks + project progress for a given week
// Usage: osascript -l JavaScript weekly_review.js [weeks_ago]
//   weeks_ago: 0 = current week (Mon-Sun), 1 = last week, etc. Default: 0
//
// Returns JSON with:
//   - completed: tasks completed during the week
//   - summary: counts by purpose type, spoon cost, project
//   - projects: active projects with progress info
//   - period: { start, end } ISO dates
//
// Performance: Uses batch property access to avoid per-task Apple Events.

ObjC.import("Foundation");
var lib = (function() {
    var data = $.NSString.stringWithContentsOfFileEncodingError(
        '/Users/max/.openclaw/workspace/skills/omnifocus/scripts/_omnifocus_lib.js',
        $.NSUTF8StringEncoding, null);
    if (!data) throw new Error("Cannot load _omnifocus_lib.js");
    return eval('(' + ObjC.unwrap(data) + ')');
})();

function run(args) {
    const weeksAgo = args.length > 0 ? parseInt(args[0]) : 0;

    // Calculate week boundaries (Monday 00:00 → Sunday 23:59)
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon...
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() + mondayOffset - (weeksAgo * 7));
    weekStart.setHours(0, 0, 0, 0);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    const of = Application('OmniFocus');
    const doc = of.defaultDocument;

    // Batch-read ALL task properties in single Apple Event calls (FAST)
    const ft = doc.flattenedTasks;
    const allNames = ft.name();
    const allCompleted = ft.completed();
    const allCompletionDates = ft.completionDate();
    const allIds = ft.id();
    const allNotes = ft.note();
    const allFlagged = ft.flagged();

    // Tags and projects need special handling
    const taskRefs = ft();
    const totalTasks = allNames.length;

    // Taxonomy classification
    const purposeMap = { '🛠️': 'Upkeep', '🎨': 'Creation', '🚀': 'Ambition' };
    const spoonMap = {
        '🐸': { cost: 10, label: '🐸 Frog (10)' },
        '💥': { cost: 7, label: '💥 Hard (6-8)' },
        '🔋': { cost: 4, label: '🔋 Medium (3-5)' },
        '🪫': { cost: 1.5, label: '🪫 Low (1-2)' },
        '🔌': { cost: -5, label: '🔌 Recharge (+5)' }
    };

    const completed = [];
    const byPurpose = { '🛠️ Upkeep': 0, '🎨 Creation': 0, '🚀 Ambition': 0, 'Untagged': 0 };
    const bySpoon = { '🐸 Frog (10)': 0, '💥 Hard (6-8)': 0, '🔋 Medium (3-5)': 0, '🪫 Low (1-2)': 0, '🔌 Recharge (+5)': 0, 'Untagged': 0 };
    const byProject = {};
    const byDay = {}; // day-of-week breakdown
    let totalSpoons = 0;
    let spoonTaggedCount = 0;

    // First pass: find tasks completed this week (using batch arrays)
    const matchingIndices = [];
    for (let i = 0; i < totalTasks; i++) {
        if (!allCompleted[i]) continue;
        const cd = allCompletionDates[i];
        if (!cd || cd < weekStart || cd > weekEnd) continue;
        matchingIndices.push(i);
    }

    // Second pass: get tags + project only for matching tasks (much fewer Apple Events)
    for (let k = 0; k < matchingIndices.length; k++) {
        const i = matchingIndices[k];
        const task = taskRefs[i];
        const name = allNames[i];
        const completionDate = allCompletionDates[i];

        // Get tags + project (these are per-task calls, but only for completed-this-week tasks)
        let tagNames = [];
        let projectName = "No Project";
        try {
            tagNames = task.tags().map(function(t) { return t.name(); });
            const proj = task.containingProject();
            if (proj) projectName = proj.name();
        } catch(e) {}

        // Classify purpose (check tags first, then task name, then project name as fallback)
        let purpose = null;
        var purposeSources = [tagNames.join(' '), name, projectName];
        for (var si = 0; si < purposeSources.length && !purpose; si++) {
            for (var pe in purposeMap) {
                if (purposeSources[si].indexOf(pe) !== -1) {
                    purpose = pe + ' ' + purposeMap[pe];
                    break;
                }
            }
        }

        // Classify spoon cost via shared library
        var spoonInfo = lib.parseSpoonCost(name, tagNames);
        var spoonCost = spoonInfo.cost;
        var spoonEntry = spoonInfo.emoji ? spoonMap[spoonInfo.emoji] : null;
        var spoonLabel = spoonEntry ? spoonEntry.label : null;

        // Counts
        byPurpose[purpose || 'Untagged']++;
        bySpoon[spoonLabel || 'Untagged']++;

        if (spoonCost !== null) {
            totalSpoons += spoonCost;
            spoonTaggedCount++;
        }

        if (!byProject[projectName]) byProject[projectName] = 0;
        byProject[projectName]++;

        // Day of week
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const dayName = dayNames[completionDate.getDay()];
        if (!byDay[dayName]) byDay[dayName] = 0;
        byDay[dayName]++;

        completed.push({
            name: name,
            id: allIds[i],
            completedAt: completionDate.toISOString(),
            project: projectName,
            tags: tagNames.join(', '),
            purpose: purpose || null,
            spoonCost: spoonCost
        });
    }

    // Sort by completion date
    completed.sort(function(a, b) {
        return a.completedAt < b.completedAt ? -1 : 1;
    });

    // Get active project progress (batch approach)
    const fp = doc.flattenedProjects;
    const projNames = fp.name();
    const projStatuses = fp.status();
    const projRefs = fp();
    const activeProjects = [];

    for (let i = 0; i < projNames.length; i++) {
        if (projStatuses[i] === 'done status' || projStatuses[i] === 'dropped status') continue;

        const proj = projRefs[i];
        let total = 0;
        let done = 0;
        let completedThisWeek = 0;

        try {
            const projTasks = proj.flattenedTasks();
            for (let j = 0; j < projTasks.length; j++) {
                total++;
                if (projTasks[j].completed()) {
                    done++;
                    var cd = projTasks[j].completionDate();
                    if (cd && cd >= weekStart && cd <= weekEnd) {
                        completedThisWeek++;
                    }
                }
            }
        } catch(e) {}

        if (completedThisWeek > 0) {
            activeProjects.push({
                name: projNames[i],
                totalTasks: total,
                completedTotal: done,
                completedThisWeek: completedThisWeek,
                remaining: total - done,
                progress: total > 0 ? Math.round((done / total) * 100) : 0
            });
        }
    }

    activeProjects.sort(function(a, b) {
        return b.completedThisWeek - a.completedThisWeek;
    });

    return JSON.stringify({
        period: {
            start: weekStart.toISOString(),
            end: weekEnd.toISOString(),
            weeksAgo: weeksAgo
        },
        completed: completed,
        summary: {
            totalCompleted: completed.length,
            byPurpose: byPurpose,
            bySpoon: bySpoon,
            totalSpoonsSpent: totalSpoons,
            spoonTaggedTasks: spoonTaggedCount,
            byProject: byProject,
            byDay: byDay
        },
        projects: activeProjects
    }, null, 2);
}
