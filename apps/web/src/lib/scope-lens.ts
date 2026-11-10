// Illustrative company for the landing page's scope lens. People, goals and numbers are examples;
// what each role can see follows the product's real visibility rules (docs/GOALS_HOME_PLAN.md).

export type LensRole = "ceo" | "manager" | "employee";

export type LensPerson = { id: string; name: string; title: string; x: number; y: number; managerId: string | null };
export type LensGoal = {
  id: string;
  scope: "Company" | "Department" | "Team" | "Personal";
  owner: string;
  title: string;
  progress: number;
  expected: number;
  visibleTo: LensRole[];
};

export const LENS_PEOPLE: LensPerson[] = [
  { id: "avery", name: "Avery", title: "CEO", x: 300, y: 46, managerId: null },
  { id: "morgan", name: "Morgan", title: "VP Product", x: 170, y: 150, managerId: "avery" },
  { id: "dana", name: "Dana", title: "VP Revenue", x: 440, y: 150, managerId: "avery" },
  { id: "sam", name: "Sam", title: "Eng. manager", x: 170, y: 254, managerId: "morgan" },
  { id: "lee", name: "Lee", title: "Account exec", x: 440, y: 254, managerId: "dana" },
  { id: "riley", name: "Riley", title: "Platform", x: 96, y: 358, managerId: "sam" },
  { id: "jo", name: "Jo", title: "Checkout", x: 244, y: 358, managerId: "sam" },
];

export const LENS_ROLES: { id: LensRole; label: string; viewer: string; rule: string }[] = [
  { id: "ceo", label: "CEO", viewer: "avery", rule: "A company-wide role sees every team, person and goal." },
  { id: "manager", label: "Manager", viewer: "sam", rule: "Their reporting line, their teams' goals, and the department and company goals above them." },
  { id: "employee", label: "Employee", viewer: "riley", rule: "Their own work, their team's goals, and the department and company goals above them." },
];

// Each person a role can see: the viewer and everyone in their reporting subtree.
export function visiblePeople(role: LensRole): Set<string> {
  const viewer = LENS_ROLES.find((r) => r.id === role)!.viewer;
  const seen = new Set([viewer]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const p of LENS_PEOPLE) {
      if (p.managerId && seen.has(p.managerId) && !seen.has(p.id)) {
        seen.add(p.id);
        grew = true;
      }
    }
  }
  return seen;
}

export const LENS_GOALS: LensGoal[] = [
  { id: "g1", scope: "Company", owner: "Northwind", title: "Reach 1,200 active customers", progress: 0.68, expected: 0.7, visibleTo: ["ceo", "manager", "employee"] },
  { id: "g2", scope: "Department", owner: "Product", title: "Ship self-serve checkout", progress: 0.45, expected: 0.6, visibleTo: ["ceo", "manager", "employee"] },
  { id: "g3", scope: "Department", owner: "Revenue", title: "Close the Q4 pipeline", progress: 0.72, expected: 0.7, visibleTo: ["ceo"] },
  { id: "g4", scope: "Team", owner: "Platform", title: "Cut p95 API latency to 200 ms", progress: 0.8, expected: 0.65, visibleTo: ["ceo", "manager", "employee"] },
  { id: "g5", scope: "Team", owner: "Checkout", title: "Launch Checkout v2", progress: 0.25, expected: 0.55, visibleTo: ["ceo", "manager"] },
  { id: "g6", scope: "Personal", owner: "Riley", title: "Move billing jobs to the queue", progress: 0.5, expected: 0.5, visibleTo: ["ceo", "manager", "employee"] },
];

export type LensHealth = "On track" | "At risk" | "Off track";

// Same thresholds as the API: up to 10 points behind is on track, up to 25 is at risk.
export function lensHealth(goal: Pick<LensGoal, "progress" | "expected">): LensHealth {
  const gap = Math.round((goal.expected - goal.progress) * 100);
  if (gap <= 10) return "On track";
  if (gap <= 25) return "At risk";
  return "Off track";
}
