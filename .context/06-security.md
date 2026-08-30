# Company Brain — Security Model

Security is the **most important part of the MVP**.

## 7.1 Authentication

Users must authenticate before accessing Company Brain.

Recommended:
- SSO/OIDC where available
- JWT/session management

## 7.2 RBAC

Initial roles:
- Employee
- Manager
- Admin

The system should support expansion later.

## 7.3 Query-Time Authorization (MANDATORY)

The system must **NOT** simply ingest everything and trust the LLM to hide information. Correct architecture:

```
User
  | Identity
  | Permissions
  | Retriever
  | Permission Filter
  | Authorized Context
  | LLM
```

**The LLM must never receive unauthorized content.**

## 7.4 Tenant Isolation

- Every database object must be associated with a tenant (`tenant_id`).
- All queries must be tenant-scoped.

## 7.5 Audit Logging

Record:
- user
- query
- timestamp
- retrieved sources
- permission decision
- model
- response
- errors

## MVP Security Test Matrix

| Test | Expected Result |
|------|-----------------|
| Invalid token | Reject |
| Expired token | Reject |
| Junior asks for restricted document | Deny |
| Manager accesses authorized document | Allow |
| User access revoked | Deny |
| Tenant A accesses Tenant B | Deny |
| Prompt injection in PDF | Ignore instruction |
| Prompt injection in Slack | Ignore instruction |
| Unauthorized memory access | Deny |
| Unauthorized source retrieval | 0 |
| Unauthorized LLM context | 0 |

## Error Handling — Fail Closed

Security-sensitive failures should fail closed. Example: If authorization cannot be determined → do not return the protected data.
