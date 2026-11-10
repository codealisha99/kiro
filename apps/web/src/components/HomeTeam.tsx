import type { HomeResponse } from "@/lib/home-api";
import { TASK_STATUS_LABELS } from "@/lib/goal-format";

type Team = HomeResponse["team"];
type Person = Team["people"][number];

const PREVIEW_TASKS = 2;

/** Share of open work by state. Text beside the bar carries the counts, so the bar is decorative. */
function MiniStatus({ person }: { person: Person }) {
  const open = Math.max(person.open_tasks, 1);
  const blocked = Math.min(person.blocked, open) / open * 100;
  const inProgress = Math.min(person.in_progress, open - Math.min(person.blocked, open)) / open * 100;
  return (
    <span className="home-mini-status" aria-hidden="true">
      <span className="home-mini-blocked" style={{ width: `${blocked}%` }} />
      <span className="home-mini-progress" style={{ width: `${inProgress}%` }} />
    </span>
  );
}

export function HomeTeam({ team }: { team: Team }) {
  const heading = team.basis === "REPORTS" ? "Your reports" : "Your team";
  return (
    <section className="home-section" aria-labelledby="home-team-title">
      <h2 id="home-team-title">{heading}</h2>
      <p className="muted">What each person is working on, from the work you can see.</p>
      {team.people.length === 0 ? (
        <p className="muted">No team activity to show yet.</p>
      ) : (
        <ul className="home-team-list">
          {team.people.map((person) => (
            <li key={person.id} className="home-person">
              <span className="home-person-name">{person.name}</span>
              <span className="home-counts">
                <span><strong>{person.open_tasks}</strong> open</span>
                <span><strong>{person.in_progress}</strong> in progress</span>
                <span className={person.blocked > 0 ? "is-danger" : undefined}><strong>{person.blocked}</strong> blocked</span>
                <span className={person.overdue > 0 ? "is-danger" : undefined}><strong>{person.overdue}</strong> overdue</span>
              </span>
              <MiniStatus person={person} />
              <span className="home-person-current">
                {person.currentTasks.length === 0
                  ? "No current tasks"
                  : person.currentTasks.slice(0, PREVIEW_TASKS).map((task) => `${task.title} (${TASK_STATUS_LABELS[task.status]})`).join(" · ")}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
