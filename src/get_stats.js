#!/usr/bin/env osascript -l JavaScript

// Get OmniFocus statistics with enhanced metrics
//
// Usage:
//   osascript -l JavaScript get_stats.js
//
// Returns: JSON with comprehensive counts including project count and total estimated time

function run(args) {
    var of = Application('OmniFocus');
    var doc = of.defaultDocument;

    var allTasks = doc.flattenedTasks();
    var inboxTasks = doc.inboxTasks();
    var allProjects = doc.flattenedProjects();

    var now = new Date();
    var threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

    var incomplete = 0;
    var flagged = 0;
    var overdue = 0;
    var dueSoon = 0;
    var available = 0;
    var blocked = 0;
    var totalEstimatedMinutes = 0;
    var tasksWithEstimates = 0;
    var repeatingTasks = 0;
    var sequentialGroups = 0;

    for (var i = 0; i < allTasks.length; i++) {
        var task = allTasks[i];
        var isComplete = task.completed();

        if (!isComplete) {
            incomplete++;

            if (task.flagged()) {
                flagged++;
            }

            var dueDate = task.dueDate();
            if (dueDate) {
                if (dueDate < now) {
                    overdue++;
                } else if (dueDate >= now && dueDate < threeDaysFromNow) {
                    dueSoon++;
                }
            }

            var isBlocked = false;
            try { isBlocked = task.blocked(); } catch(e) {}
            if (isBlocked) {
                blocked++;
            } else {
                available++;
            }

            var estimate = task.estimatedMinutes();
            if (estimate && estimate > 0) {
                totalEstimatedMinutes += estimate;
                tasksWithEstimates++;
            }

            // Check for repeating tasks
            try {
                var rr = task.repetitionRule();
                if (rr) repeatingTasks++;
            } catch(e) {}

            // Check for sequential groups (tasks with children set to sequential)
            try {
                if (task.sequential() && task.tasks().length > 0) {
                    sequentialGroups++;
                }
            } catch(e) {}
        }
    }

    // Project statistics
    var activeProjects = 0;
    var onHoldProjects = 0;
    var completedProjects = 0;
    var droppedProjects = 0;

    for (var j = 0; j < allProjects.length; j++) {
        var proj = allProjects[j];
        var status = proj.status();

        if (status === "done status") {
            completedProjects++;
        } else if (status === "dropped status") {
            droppedProjects++;
        } else if (status === "on hold status") {
            onHoldProjects++;
        } else {
            activeProjects++;
        }
    }

    var stats = {
        total: allTasks.length,
        incomplete: incomplete,
        inbox: inboxTasks.length,
        flagged: flagged,
        overdue: overdue,
        dueSoon: dueSoon,
        available: available,
        blocked: blocked,
        totalEstimatedMinutes: totalEstimatedMinutes,
        totalEstimatedHours: Math.round(totalEstimatedMinutes / 60 * 10) / 10,
        tasksWithEstimates: tasksWithEstimates,
        repeatingTasks: repeatingTasks,
        sequentialGroups: sequentialGroups,
        projects: {
            total: allProjects.length,
            active: activeProjects,
            onHold: onHoldProjects,
            completed: completedProjects,
            dropped: droppedProjects
        }
    };

    return JSON.stringify(stats, null, 2);
}
