"""Synthetic organization/role/provider setup checks; disposable Java API only."""
import datetime
import json
import os
import secrets
import urllib.request
import urllib.error

BASE = os.environ.get("ORG_E2E_URL", "http://localhost:3201")
if os.environ.get("ORG_E2E_ALLOW_MUTATION") != "1":
    raise SystemExit("Set ORG_E2E_ALLOW_MUTATION=1 only for a disposable local API.")


def call(path, token=None, method="GET", body=None, expected=200):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = "Bearer " + token
    request = urllib.request.Request(BASE + path, headers=headers, method=method,
                                    data=json.dumps(body).encode() if body is not None else None)
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            status, payload = response.status, json.load(response)
    except urllib.error.HTTPError as error:
        status, payload = error.code, json.load(error)
    assert status == expected, (path, status, expected, payload.get("message") if isinstance(payload, dict) else "")
    return payload


suffix = secrets.token_hex(5)
password = secrets.token_urlsafe(24)
email = "organization-" + suffix + "@example.test"
owner = call("/auth/register", method="POST", body={"email": email, "password": password,
             "tenantName": "Synthetic organization QA", "name": "QA Administrator"}, expected=201)
token = owner["tokens"]["accessToken"]
setup = call("/organization", token)
assert len(setup["roles"]) == 6
roles = {r["dashboard"]: r["id"] for r in setup["roles"]}
dept = call("/organization/departments", token, "POST", {"name": "Engineering"})["id"]
team = call("/organization/teams", token, "POST", {"name": "Delivery", "departmentId": dept})["id"]
other_dept = call("/organization/departments", token, "POST", {"name": "Sales"})["id"]
other_team = call("/organization/teams", token, "POST", {"name": "Revenue", "departmentId": other_dept})["id"]
people = {}
for view in ["EMPLOYEE", "MANAGER", "DIRECTOR", "VP", "CEO"]:
    user_email = view.lower() + "-" + suffix + "@example.test"
    user = call("/users/invite", token, "POST", {"name": "Synthetic " + view, "email": user_email, "password": password, "role": "employee"})
    people[view] = (user["id"], call("/auth/login", method="POST", body={"email": user_email, "password": password})["tokens"]["accessToken"])
    if view == "EMPLOYEE":
        call("/organization/memberships", token, "POST", {"teamId": team, "userId": user["id"], "revoke": False})
    else:
        scope = "TEAM" if view == "MANAGER" else "COMPANY" if view == "CEO" else "DEPARTMENT"
        call("/organization/bindings", token, "POST", {"roleId": roles[view], "userId": user["id"], "scope": scope,
             "teamId": team if scope == "TEAM" else None, "departmentId": dept if scope == "DEPARTMENT" else None})
call("/organization/reporting", token, "POST", {"employeeId": people["EMPLOYEE"][0], "managerId": people["MANAGER"][0]})
call("/organization/reporting", token, "POST", {"employeeId": people["MANAGER"][0], "managerId": people["EMPLOYEE"][0]}, expected=400)
projects = []
for name, team_id, restricted in [("Release", team, False), ("Revenue", other_team, False), ("Restricted plan", team, True)]:
    p = call("/work/projects", token, "POST", {"name": name})["id"]
    call("/work/projects/" + p + "/audience", token, "PUT", {"teamId": team_id, "restricted": restricted})
    projects.append(p)
    call("/work/projects/" + p + "/tasks", token, "POST", {"title": name + " task", "status": "BLOCKED", "remainingHours": 8,
         "dueDate": (datetime.date.today() - datetime.timedelta(days=1)).isoformat(),
         "assigneeId": people["EMPLOYEE"][0] if name == "Release" else None})
for view, (_, access) in people.items():
    dashboard = call("/organization/dashboard?view=" + view, access)
    assert dashboard["view"] == view
    assert dashboard["metrics"]["tasks"] == (2 if view == "CEO" else 1)
    call("/work/projects/" + projects[2], access, expected=404)
    call("/organization/departments", access, "POST", {"name": "Denied"}, expected=403)
    if view != "CEO":
        call("/work/projects/" + projects[1], access, expected=404)
call("/organization/dashboard?view=CEO", people["EMPLOYEE"][1], expected=403)
assert len(call("/organization/dashboard?view=MANAGER", people["MANAGER"][1])["reports"]) == 1
assert "resourceGaps" in call("/organization/dashboard?view=VP", people["VP"][1])
assert "dependencies" in call("/organization/dashboard?view=CEO", people["CEO"][1])
manager_binding = next(b for b in call("/organization", token)["bindings"] if b["user_id"] == people["MANAGER"][0])
call("/organization/bindings/" + manager_binding["id"], token, "DELETE")
call("/organization/dashboard?view=MANAGER", people["MANAGER"][1], expected=403)
assert call("/work/insights", people["MANAGER"][1]) == []
call("/organization/bindings", token, "POST", {"roleId": roles["MANAGER"], "userId": people["MANAGER"][0], "scope": "TEAM", "teamId": team})
for provider, resource, account in [("github", "example/repo", ""), ("slack", "C123456", "example"),
                                  ("linear", "12345678-1234-1234-1234-123456789012", ""), ("hubspot", "123", ""),
                                  ("xero", "12345678-1234-1234-1234-123456789012", ""), ("bamboohr", "example", "")]:
    c = call("/integrations", token, "POST", {"provider": provider, "name": "Synthetic " + provider, "resource": resource, "accountId": account})
    assert c["status"] == "UNCONFIGURED"
    assert "encrypted_token" not in c
    assert call("/integrations/" + c["id"] + "/sync", token, "POST")["status"] == "UNCONFIGURED"
    assert call("/integrations/" + c["id"] + "/records", token) == []
    call("/integrations/" + c["id"] + "/records", people["CEO"][1], expected=403)
assert len(call("/integrations", token)) == 6
assert any(e["kind"] == "ROLE_REVOKED" for e in call("/organization/audit", token))
# Optional ephemeral browser QA handoff, outside the repository. Never print tokens or passwords.
if os.environ.get("ORG_E2E_BROWSER_HANDOFF"):
    path = os.environ["ORG_E2E_BROWSER_HANDOFF"]
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, "w") as output:
        json.dump({"email": email, "password": password, "suffix": suffix}, output)
print("PASS: five role dashboards, scoped project access, restricted records, reporting cycles, role revocation, six unconfigured provider flows and audit history")
