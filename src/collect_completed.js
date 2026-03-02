#!/usr/bin/env osascript -l JavaScript
// collect_completed.js — Export tasks completed in the last N days as JSON
// Usage: osascript -l JavaScript collect_completed.js [days=1]
// Output: JSON array of completed task objects
//
// Designed for daily cron: collects yesterday's + today's completions.
// Consumer script handles dedup via UNIQUE(omnifocus_id) in SQLite.

function run(argv) {
    const days = parseInt(argv[0] || "1", 10);
    const of = Application("OmniFocus");
    const doc = of.defaultDocument;

    // Calculate cutoff: N days ago at midnight local time
    const now = new Date();
    const cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate() - days);

    // Query completed tasks since cutoff
    const tasks = doc.flattenedTasks.whose({
        completed: true,
        completionDate: { ">": cutoff }
    })();

    // Emoji parsers
    const SPOON_MAP = { "🐸": "frog", "💥": "high", "🔋": "medium", "🪫": "low", "🔌": "recharge" };
    const PRIORITY_MAP = { "‼️": "critical", "⚠️": "high", "📌": "normal" };
    const RIGIDITY_MAP = { "📅": "fixed", "🗓️": "anchored", "🔄": "flexible", "💡": "spontaneous" };

    function parseEmoji(name, map) {
        for (const [emoji, label] of Object.entries(map)) {
            if (name.includes(emoji)) return label;
        }
        return null;
    }

    const results = [];
    for (const t of tasks) {
        try {
            const name = t.name();
            const taskId = t.id();
            const completionDate = t.completionDate();

            // Get project name safely
            let projectName = null;
            try {
                const proj = t.containingProject();
                if (proj) projectName = proj.name();
            } catch (e) { /* no project */ }

            // Get tags
            let tagNames = [];
            try {
                const tags = t.tags();
                tagNames = tags.map(tag => tag.name());
            } catch (e) { /* no tags */ }

            // Get estimated minutes
            let estMin = null;
            try {
                const est = t.estimatedMinutes();
                if (est && est > 0) estMin = est;
            } catch (e) { /* no estimate */ }

            // Format completion date as local ISO string
            const cd = completionDate;
            const localISO = `${cd.getFullYear()}-${String(cd.getMonth()+1).padStart(2,'0')}-${String(cd.getDate()).padStart(2,'0')}T${String(cd.getHours()).padStart(2,'0')}:${String(cd.getMinutes()).padStart(2,'0')}:${String(cd.getSeconds()).padStart(2,'0')}`;

            results.push({
                omnifocus_id: taskId,
                name: name,
                completion_date: localISO,
                project: projectName,
                tags: tagNames.length > 0 ? tagNames.join(", ") : null,
                estimated_minutes: estMin,
                spoon_cost: parseEmoji(name, SPOON_MAP),
                priority: parseEmoji(name, PRIORITY_MAP),
                rigidity: parseEmoji(name, RIGIDITY_MAP)
            });
        } catch (e) {
            // Skip individual task errors — don't let one bad task kill the batch
            continue;
        }
    }

    return JSON.stringify(results);
}
