# OmniFocus JXA (JavaScript for Automation) API Reference

## Overview

OmniFocus supports automation via JavaScript for Automation (JXA), which allows direct access to the OmniFocus data model. This reference covers all task properties and methods.

## Key Objects

### Application & Document

```javascript
const of = Application('OmniFocus');
of.includeStandardAdditions = true;  // for file dialogs, etc.
const doc = of.defaultDocument;
```

### Database Object

The Database is the top-level container for all OmniFocus data.

**Properties:**
- `inbox` / `inboxTasks` - Inbox tasks
- `library` - All projects and folders
- `tags` / `flattenedTags` - All tags
- `flattenedTasks` - Flat array of all tasks
- `flattenedProjects` - Flat array of all projects

## Task Object

### Read/Write Properties

| Property | Type | Description |
|----------|------|-------------|
| `name` | text | Task name |
| `note` | text | Task note |
| `dueDate` | date | Due date (hard deadline) |
| `deferDate` | date | Defer/start date (when task becomes available) |
| `plannedDate` | date | **OmniFocus 4.7+**: When you PLAN to work on the task (remains available) |
| `flagged` | boolean | Flagged status |
| `estimatedMinutes` | integer | Time estimate in minutes |
| `completed` | boolean | Completion status |
| `completionDate` | date | Date completed |
| `assignedContainer` | project/folder | Container (project or folder) |
| `sequential` | boolean | Whether children run sequentially |
| `repetitionRule` | RepetitionRule | Recurring task rules |
| `shouldUseFloatingTimeZone` | boolean | Floating timezone setting |

### Read-Only Properties

| Property | Type | Description |
|----------|------|-------------|
| `id` | text | Unique task identifier |
| `blocked` | boolean | Whether task is blocked |
| `containingProject` | project | Parent project |
| `parentTask` | task | Direct parent task (null if top-level) |
| `tasks` | task array | Child tasks |
| `flattenedTasks` | task array | All descendant tasks |
| `tags` | tag array | Assigned tags |
| `inInbox` | boolean | Whether task is in inbox |
| `next` | boolean | Is the "next" action |
| `effectiveDueDate` | date | Inherited due date |
| `effectiveDeferDate` | date | Inherited defer date |
| `effectivePlannedDate` | date | **OmniFocus 4.7+**: Inherited planned date |
| `effectiveFlagged` | boolean | Inherited flag status |
| `creationDate` | date | When task was created |
| `modificationDate` | date | When task was last modified |
| `numberOfTasks` | integer | Child task count |
| `numberOfAvailableTasks` | integer | Available child count |
| `numberOfCompletedTasks` | integer | Completed child count |

### Methods

```javascript
task.markComplete();    // Mark task as complete
task.markIncomplete();  // Mark task as incomplete
```

### Tag Methods (via Application object)

**Important:** Direct tag methods on tasks are unreliable in JXA. Always use the Application object:

```javascript
// Add tag to task (RELIABLE)
of.add(tagRef, { to: task.tags });

// Remove tag from task
of.remove(tagRef, { from: task.tags });
```

## RepetitionRule Object

### Creating a Repetition Rule

```javascript
task.repetitionRule = of.RepetitionRule({
    ruleString: "FREQ=DAILY;INTERVAL=1",  // RRULE format
    method: "due date"                     // or "due after completion"
});
```

### Reading a Repetition Rule

```javascript
var rr = task.repetitionRule();
if (rr) {
    var rrule = rr.recurrenceString();  // e.g., "FREQ=WEEKLY;BYDAY=MO"
    var method = rr.method();            // "due date" or "due after completion"
}
```

### Clearing a Repetition Rule

```javascript
task.repetitionRule = null;
```

### Repetition Methods

| Method | Description |
|--------|-------------|
| `"due date"` | Fixed schedule (repeat from original due date) |
| `"due after completion"` | Repeat X days/weeks/etc after task is completed |

### Common RRULE Examples

| RRULE | Description |
|-------|-------------|
| `FREQ=DAILY;INTERVAL=1` | Every day |
| `FREQ=DAILY;INTERVAL=2` | Every 2 days |
| `FREQ=WEEKLY;INTERVAL=1` | Every week |
| `FREQ=WEEKLY;BYDAY=MO,WE,FR` | Every Mon, Wed, Fri |
| `FREQ=WEEKLY;BYDAY=SU` | Every Sunday |
| `FREQ=MONTHLY;INTERVAL=1` | Every month |
| `FREQ=MONTHLY;BYMONTHDAY=1` | First of every month |
| `FREQ=YEARLY;INTERVAL=1` | Every year |

## Project Object

**Properties:**
- `name()` / `name =` - Project name
- `note()` / `note =` - Project note
- `status()` - Project status (`active status`, `on hold status`, `done status`, `dropped status`)
- `completed()` / `completed =` - Completion status
- `dueDate()` / `dueDate =` - Project due date
- `containsSingletonActions()` - Whether it's a single actions list
- `sequential()` / `sequential =` - Sequential vs parallel
- `tasks()` - Array of project tasks
- `flattenedTasks()` - All tasks including nested ones

## Tag Object

**Properties:**
- `name()` / `name =` - Tag name
- `tasks()` - Tasks with this tag

## Common Patterns

### Query Tasks with `whose()`

```javascript
// Get incomplete tasks
const incompleteTasks = doc.flattenedTasks.whose({completed: false})();

// Get flagged tasks
const flaggedTasks = doc.flattenedTasks.whose({flagged: true})();

// Get tasks by exact name
const tasks = doc.flattenedTasks.whose({name: "Task name"})();

// Get tasks containing text
const tasks = doc.flattenedTasks.whose({name: {_contains: "keyword"}})();
```

### Batch Property Access (Performance)

For large datasets, use batch property access instead of per-task iteration:

```javascript
// SLOW: per-task access (one Apple Event per task)
for (var i = 0; i < tasks.length; i++) {
    names.push(tasks[i].name());  // Apple Event for each task
}

// FAST: batch access (one Apple Event total)
var names = doc.inboxTasks.name();  // Single Apple Event returns all names
```

### Create Tasks

```javascript
// Create inbox task
const task = of.InboxTask({
    name: "Task name",
    note: "Task note"
});
doc.inboxTasks.push(task);

// Create task in project
const projectTask = of.Task({
    name: "Task name"
});
project.tasks.push(projectTask);

// Create sub-task (child of existing task)
const childTask = of.Task({ name: "Sub-task name" });
parentTask.tasks.push(childTask);
```

### Find Existing Tag (Strict)

```javascript
function findExistingTag(doc, name) {
    // 1. Exact match
    var tags = doc.flattenedTags();
    for (var i = 0; i < tags.length; i++) {
        if (tags[i].name() === name) return { tag: tags[i] };
    }
    // 2. Case-insensitive substring fallback
    var lower = name.toLowerCase();
    var matches = [];
    for (var j = 0; j < tags.length; j++) {
        if (tags[j].name().toLowerCase().indexOf(lower) !== -1) matches.push(tags[j]);
    }
    if (matches.length === 1) return { tag: matches[0] };
    if (matches.length > 1) return { error: "Ambiguous", candidates: matches.slice(0,10).map(function(t){return t.name()}) };
    return { error: "Tag not found: \"" + name + "\"" };
}
```

**Note:** Never create tags implicitly. Use `create_tag.js` for explicit tag creation.

### Date Handling (Local Time)

**Important:** Never use `new Date(str)` for date strings — it interprets as UTC.

```javascript
// CORRECT: Local date parsing
function parseDate(str) {
    // YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
        var d = str.split('-').map(Number);
        return new Date(d[0], d[1] - 1, d[2]);
    }
    // YYYY-MM-DDTHH:MM
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(str)) {
        var parts = str.split('T');
        var d = parts[0].split('-').map(Number);
        var t = parts[1].split(':').map(Number);
        return new Date(d[0], d[1] - 1, d[2], t[0], t[1]);
    }
    throw new Error("Invalid date: " + str);
}

// WRONG: UTC interpretation
var date = new Date("2026-03-01");  // May be off by a day!
```

### Task Lookup with Disambiguation

```javascript
function findTaskByQuery(doc, query) {
    // 1. Try as ID first (fast path)
    try {
        var byId = doc.flattenedTasks.byId(query);
        if (byId && byId.name()) return { task: byId };
    } catch(e) {}

    // 2. Exact name match
    var exact = doc.flattenedTasks.whose({ name: query })();
    var incomplete = exact.filter(function(t) { return !t.completed(); });
    if (incomplete.length === 1) return { task: incomplete[0] };
    if (incomplete.length > 1) return { error: "Ambiguous", candidates: incomplete };

    // 3. Substring match
    var sub = doc.flattenedTasks.whose({ name: { _contains: query } })();
    incomplete = sub.filter(function(t) { return !t.completed(); });
    if (incomplete.length === 1) return { task: incomplete[0] };
    if (incomplete.length > 1) return { error: "Ambiguous", candidates: incomplete };

    return { error: "Not found" };
}
```

## Error Handling

Always wrap OmniFocus operations in try/catch:

```javascript
try {
    var task = doc.flattenedTasks.byId(taskId);
    task.completed = true;
} catch (e) {
    return { ok: false, error: e.message };
}
```

## Best Practices

1. **Return JSON** from scripts for structured output
2. **Use batch property access** for performance with large datasets
3. **Handle missing values** gracefully (properties may return null)
4. **Try/catch everything** — some properties throw on older OmniFocus versions
5. **Use `of.add(tag, { to: task.tags })`** for reliable tag assignment
6. **Parse dates locally** — never use `new Date(str)` for date strings
7. **Disambiguate task lookups** — provide candidates when multiple matches found

## Key Date Distinction (OmniFocus 4.7+)

OmniFocus 4.7 introduced **Planned Dates** as a new concept distinct from Defer Dates:

| Property | Meaning | Behavior |
|----------|---------|----------|
| `deferDate` | When task becomes **AVAILABLE** | Task is hidden until this date |
| `plannedDate` | When you **PLAN** to work on it | Task remains available, just scheduled |
| `dueDate` | Hard deadline | Task should be completed by this date |

**Why this matters:**
- Historically, people used `deferDate` to schedule when they wanted to work on tasks
- Problem: If task is deferred to Saturday but you happen to be free Thursday, you can't see it!
- Solution: `plannedDate` lets you schedule tasks while keeping them available

**For automation:** Use `plannedDate` for "Planned Today" views. Use `deferDate` only when tasks should genuinely be hidden until a certain date.

**Batch access:**
```javascript
var allPlannedDates = doc.flattenedTasks.plannedDate();  // OmniFocus 4.7+
```
