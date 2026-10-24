"""Run against a disposable local Java API only. Creates isolated test organizations."""
import concurrent.futures
import datetime
import json
import os
import secrets
import urllib.error
import urllib.request

BASE = os.environ.get("WORK_E2E_URL", "http://localhost:3101")
if os.environ.get("WORK_E2E_ALLOW_MUTATION") != "1":
    raise SystemExit("Set WORK_E2E_ALLOW_MUTATION=1 only for a disposable test API.")


def call(path, method="GET", body=None, token=None, expected=200):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = "Bearer " + token
    request = urllib.request.Request(BASE + path, method=method, headers=headers,
                                    data=json.dumps(body).encode() if body is not None else None)
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            status, payload = response.status, json.load(response)
    except urllib.error.HTTPError as error:
        status, payload = error.code, json.load(error)
    assert status == expected, (path, status, expected)
    return payload


suffix = secrets.token_hex(6)
password = secrets.token_urlsafe(24)


def register(label):
    return call("/auth/register", "POST", {
        "tenantName": "Disposable work QA " + label,
        "email": f"{label}-{suffix}@example.test",
        "password": password, "name": label,
    }, expected=201)


owner = register("owner")
outsider = register("outsider")
token = owner["tokens"]["accessToken"]
other_token = outsider["tokens"]["accessToken"]
reader_email = f"reader-{suffix}@example.test"
reader = call("/users/invite", "POST", {"email": reader_email, "password": password,
                                      "name": "Reader", "role": "admin"}, token)
reader_token = call("/auth/login", "POST", {"email": reader_email, "password": password})["tokens"]["accessToken"]
project = call("/work/projects", "POST", {"name": "Delivery QA"}, token)
project_path = "/work/projects/" + project["id"]
call(project_path, token=reader_token, expected=404)
call(project_path, token=other_token, expected=404)
call("/work/overview", expected=401)
call(project_path + "/grants", "POST", {"userId": reader["id"], "permission": "READ"}, token)
due = (datetime.date.today() - datetime.timedelta(days=1)).isoformat()
task_body = {"title": "Release checklist", "status": "BLOCKED", "remainingHours": 8,
             "dueDate": due, "assigneeId": None}
task = call(project_path + "/tasks", "POST", task_body, token)
call(project_path + "/tasks", "POST", task_body, reader_token, expected=403)
call(project_path + "/tasks", "POST", {**task_body, "status": "INVALID"}, token, expected=400)
assert call("/work/overview", token=reader_token)["metrics"]["overdue_tasks"] == 1
assert len(call("/work/insights", token=reader_token)) == 3
insight = call("/work/insights", token=token)[0]
triage_path = "/work/insights/" + insight["id"] + "/triage"
triage = {"status": "ACKNOWLEDGED", "expectedVersion": 1}
call(triage_path, "POST", triage, reader_token, expected=403)
call(triage_path, "POST", triage, other_token, expected=404)
call(triage_path, "POST", {"status": "DISMISSED", "reason": " ", "expectedVersion": 1}, token, expected=400)
assert call(triage_path, "POST", triage, token)["triage_status"] == "ACKNOWLEDGED"
call(triage_path, "POST", triage, token, expected=409)
assert call(triage_path, "POST", {"status": "DISMISSED", "reason": "Controlled QA exception", "expectedVersion": 2}, token)["triage_status"] == "DISMISSED"
assert any(e["kind"] == "INSIGHT_TRIAGED" for e in call(project_path + "/history", token=token))

assert call("/work/insights", token=other_token) == []
call(project_path + "/revoke", "POST", {"userId": reader["id"], "permission": "READ"}, token)
assert call("/work/insights", token=reader_token) == []
assert call("/work/overview", token=reader_token)["metrics"]["total_tasks"] == 0
call(project_path + "/history", token=reader_token, expected=404)
task_path = project_path + "/tasks/" + task["id"]


def competing_save(_):
    try:
        call(task_path, "PUT", {**task_body, "status": "DONE", "expectedVersion": 1}, token)
        return 200
    except AssertionError as error:
        assert error.args[0][1] == 409
        return 409


with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
    assert sorted(pool.map(competing_save, range(2))) == [200, 409]
assert all(i["resolved_at"] is not None for i in call("/work/insights", token=token))
call(triage_path, "POST", {"status": "OPEN", "expectedVersion": 3}, token, expected=409)
scenario = call(project_path + "/scenarios", "POST", {
    "name": "Proposed feature", "periodStart": due, "periodEnd": datetime.date.today().isoformat(),
    "availableHours": 4, "proposedHours": 8, "rationale": "Explicit test assumptions",
}, token)
assert scenario["assessment"] == "EXCEEDS_ASSUMED_CAPACITY"
call("/work/scenarios/" + scenario["id"], token=reader_token, expected=404)
call("/auth/logout", "POST", token=token)
call("/work/overview", token=token, expected=401)
print("PASS: live authentication, validation, tenant isolation, explicit grants, revocation, metrics, insight triage authorization/audit/conflicts and lifecycle, concurrent edits, scenarios, logout")
