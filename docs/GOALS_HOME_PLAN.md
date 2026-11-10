# Role-based home dashboard, goals, and the organization graph

## Goal

Every signed-in person lands on a personal home dashboard. It shows their goals, their tasks, what their team is working on, and how far each goal is from its target. What they see follows the organization graph: an employee sees their own work and their team's goals, a manager sees everyone in their reporting subtree, and a company-scope role such as CEO sees everything.

Everything lives in the existing Java API (`apps/api-java`) and the existing PostgreSQL schema. The same schema runs on Neon in production. We are not adding a new service or a graph database. The graph is the set of typed edge tables (reporting lines, team memberships, role bindings, goal alignment, goal-task links), traversed with recursive CTEs inside each SQL query. Authorization is enforced inside the SQL, never by fetching rows and filtering them in Java.

## Graph model

| Edge | Table | Meaning |
| --- | --- | --- |
| `REPORTS_TO` | `org_reporting_lines` | employee → manager (cycles already rejected) |
| `MEMBER_OF` | `org_team_memberships` | person → team |
| `IN_DEPARTMENT` | `org_teams.department_id` | team → department |
| `HAS_ROLE` | `org_role_bindings` | person → role, scoped to company / department / team |
| `ALIGNS_TO` | `org_goals.parent_id` (new) | goal → parent goal (cycles rejected) |
| `TRACKS` | `org_goal_tasks` (new) | goal → task whose completion drives progress |

## Schema (Flyway `V25__org_goals.sql`)

- `org_goals`: `id`, `tenant_id`, `scope` (`COMPANY|DEPARTMENT|TEAM|PERSON`), `department_id`, `team_id`, `owner_id`, `parent_id`, `title` (≤200), `description` (≤2000), `measure` (`METRIC|TASKS|CHILDREN`), `unit` (≤40), `start_value`, `target_value`, `current_value`, `start_date`, `due_date` (≥ start), `status` (`ACTIVE|ACHIEVED|CANCELLED`), `version`, `created_at`, `updated_at`.
  - Scope columns follow the role-binding rule: COMPANY and PERSON have neither department nor team; DEPARTMENT has only `department_id`; TEAM has only `team_id`. For PERSON goals, `owner_id` is the person.
  - METRIC goals require start, target and current values, with target ≠ start.
  - All foreign keys are tenant-composite, like the rest of the schema.
- `org_goal_tasks(tenant_id, goal_id, task_id)`: primary key `(goal_id, task_id)`.
- `org_goal_checkins(id, tenant_id, goal_id, author_id, value, note, created_at)`: progress history.

## Visibility

### Projects and tasks

`OrganizationAccess.READ` gains one rule: an unrestricted project is readable when its owner, or the assignee of any of its tasks, is in the viewer's transitive reporting subtree. Restricted projects keep their explicit-grant-only rule.

### Goals

`GoalAccess.READ` is one SQL predicate on alias `g`. A viewer can read a goal when any of these holds:

- They own it.
- They hold a COMPANY-scope role binding.
- It is a COMPANY goal.
- It is a DEPARTMENT goal for a department where they are on a team, or hold a binding for that department.
- It is a TEAM goal for a team where they are a member, hold a binding for the team or its department, or transitively manage a member.
- It is a PERSON goal, and they transitively manage the owner or hold a binding covering a team the owner belongs to.

### Writing goals

The owner can always update a goal and add check-ins. Creating or editing other goals requires `PROJECT_WRITE` through a binding that covers the goal's scope: COMPANY for company goals (or `ORG_MANAGE`), and COMPANY or the matching department or team binding for the narrower scopes. A person may create their own PERSON goals, and a transitive manager may create them for reports. A parent goal must be readable by the editor, and alignment cycles are rejected. A linked task must be readable by the person linking it.

## Progress and health

Progress is computed on read, from 0 to 1, or null when there is no data.

| Measure | Progress |
| --- | --- |
| METRIC | `clamp((current − start) / (target − start), 0, 1)` |
| TASKS | DONE linked tasks ÷ linked tasks (all linked tasks are counted; only readable ones are listed) |
| CHILDREN | mean of non-cancelled children's progress, computed recursively |

Expected progress is `clamp((today − start_date) / (due_date − start_date), 0, 1)`. Health is assigned by the first matching rule:

1. `CANCELLED` when the goal is cancelled.
2. `ACHIEVED` when the goal is achieved or progress ≥ 1.
3. `NO_DATA` when progress is null.
4. `OFF_TRACK` when the due date has passed.
5. Otherwise, from the gap (expected − progress): `ON_TRACK` when ≤ 0.10, `AT_RISK` when ≤ 0.25, and `OFF_TRACK` beyond that.

`remaining` is `target − current` in the goal's unit for METRIC goals, or the open linked-task count for TASKS goals.

## API

All endpoints require authentication and return only authorized data.

- `GET /home`:
  - `me`: `id`, `name`, `primaryView` (highest of CEO > VP > DIRECTOR > MANAGER > EMPLOYEE), `views`, `teams`, `reportCount`.
  - `goals`: the visible goals as goal objects.
  - `myTasks`: open tasks assigned to the viewer, each with its `goalIds`.
  - `team`: `basis` is `REPORTS` when the viewer has reports, otherwise `TEAMMATES`. `people` holds each person's open, in-progress, blocked and overdue counts plus up to three current tasks. Only tasks from readable projects are included.
  - `scopeSummary`: the existing dashboard metrics for `primaryView`.
  - `generatedAt`, `method`.
- `GET /goals` returns the goal objects. `GET /goals/{id}` returns a goal with its check-ins, readable linked tasks, children and ancestor chain.
- `GET /goals/options` returns the scopes, departments, teams and people the viewer may create goals for.
- `POST /goals` creates a goal. `PUT /goals/{id}` updates it, using `expectedVersion` for optimistic locking.
- `POST /goals/{id}/checkins` takes `{value?, note}`. For METRIC goals it updates the current value.
- `POST /goals/{id}/tasks` takes `{taskId, unlink}`.

A goal object contains: `id`, `scope`, `scopeName`, `title`, `description`, `ownerId`, `ownerName`, `departmentId`, `teamId`, `parentId`, `measure`, `unit`, `startValue`, `targetValue`, `currentValue`, `startDate`, `dueDate`, `status`, `progress`, `expected`, `health`, `remaining`, `taskCount`, `doneTaskCount`, `childCount`, `canEdit`, `mine`, and `version`.

The organization graph also gains goal nodes, with `ALIGNS_TO` and `TRACKS` edges. Chat questions about goals ("how far are we from our goals?") route to a structured summary of the goals the person can see.

## Web

`Home` becomes the default view in `Workspace.tsx` (`HomeDashboard.tsx`). From top to bottom, it shows:

1. A greeting with the person's scope.
2. Goals, grouped by company, department, team and person. Each goal shows a progress bar against the expected marker, its health, the distance to target and its alignment.
3. My tasks.
4. What the team is working on.

Create, edit and check-in dialogs open only where `canEdit` or `/goals/options` allows. The dashboard follows `DESIGN.md` tokens and primitives, and it is verified in both themes and on mobile.

## Neon

`DATABASE_URL` accepts Neon's `postgresql://…?sslmode=require` URL. Query parameters are preserved when converting it to JDBC. Use the direct (non-pooler) endpoint for Flyway migrations. pgvector is supported on Neon. See `docs/NEON.md`.
