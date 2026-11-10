import { Badge } from "@/components/ui";
import type { HomeResponse } from "@/lib/home-api";
import { TASK_STATUS_LABELS, TASK_STATUS_TONES } from "@/lib/goal-format";

type Team = HomeResponse["team"];

const PREVIEW_TASKS = 3;

function count(value: number, label: string) {
  return <span className="home-count"><strong>{value}</strong> {label}</span>;
}

export function HomeTeam({ team }: { team: Team }) {
  const heading = team.basis === "REPORTS" ? "Your reports" : "Your team";
  return (
    <section className="home-section" aria-labelledby="home-team-title">
      <h2 id="home-team-title">{heading}</h2>
      <p className="muted">What your team is working on.</p>
      {team.people.length === 0 ? (
        <p className="muted">No team activity to show yet.</p>
      ) : (
        <div className="home-team-grid">
          {team.people.map((person) => (
            <article key={person.id} className="home-person">
              <h3>{person.name}</h3>
              <p className="home-counts">
                {count(person.in_progress, "in progress")}
                {count(person.blocked, "blocked")}
                {count(person.overdue, "overdue")}
              </p>
              {person.currentTasks.length === 0 ? (
                <p className="muted">No current tasks.</p>
              ) : (
                <ul className="home-plain-list">
                  {person.currentTasks.slice(0, PREVIEW_TASKS).map((task) => (
                    <li key={task.id}>
                      <span>{task.title}</span>
                      <Badge tone={TASK_STATUS_TONES[task.status]}>{TASK_STATUS_LABELS[task.status]}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
