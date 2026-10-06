# Kiro API Contract (NestJS behavior — Spring Boot must preserve)

Conventions: base = `NEXT_PUBLIC_API_URL` (default `http://localhost:3001`).
Auth header: `Authorization: Bearer <accessToken>`. JSON everywhere except
`POST /documents/upload` (multipart, field `file`). Frontend (`apps/web/src/lib/api.ts`)
auto-clears token on 401. Lowercase enums on wire (`employee|manager|admin`,
`public|internal|confidential|restricted`, `google_drive|slack|crm|manual`).

## Auth

| Method & path | Auth | Request | Success | Errors |
|---|---|---|---|---|
| POST `/auth/register` | public | `{tenantName min2, email, password min8, name?}` | 201 `{user:{id,tenantId,email,name,role}, tokens:{accessToken,expiresIn}}` (role `admin`) | 400 validation, 409 email exists |
| POST `/auth/login` | public | `{email,password}` | 200 same shape as register | 401 `Invalid credentials` |
| POST `/auth/logout` | Bearer | — (token from header) | 200 `{ok:true}` | 401 |
| GET `/auth/me` | Bearer | — | 200 `{id,tenantId,email,name,role}` | 401 (+ `Session no longer valid`) |

## Brain / RAG

| Method & path | Auth | Request | Success | Errors |
|---|---|---|---|---|
| POST `/brain/query` | Bearer, throttle 30/min | `{query min1, conversationId?}` (auto-creates conversation) | 200 `{requestId,conversationId,question,answer,status:answered\|unknown\|ambiguous\|partial\|error,confidence,sources:[{documentId,chunkId?,title,sourceName,version,score,excerpt(240),updatedAt,classification}]}` | 401, 404 empty query (`query is required`), 429, 503 `AI service unavailable` (retrieval hard-fail; LLM-fail → `partial` extractive, not 503) |

## Documents

| Method & path | Auth | Request | Success | Errors |
|---|---|---|---|---|
| GET `/documents` | Bearer | — | 200 `[{id,sourceId,title,classification,status,updatedAt,versionCount}]` (visible-only, updated desc) | 401 |
| POST `/documents` | Bearer | `{title min1,content min1,classification?,acl?[{principalType:user\|role\|group,principalId,permission?}]}` | 201 `{id,title,sourceId,classification,version,created,contentChanged}` | 400/409 (`title is required`, `content is required`, `no searchable text`) |
| POST `/documents/upload` | Bearer + throttle | multipart `file` (10MB) + `title?` + `classification?` | 201 same as above (parsed title/filename) | 400 no file / unsupported type, 401, 429 |
| POST `/documents/demo` | Bearer (any role) | — | 201 `{seeded,documentCount:7,sourceName,viewer?{email,password,role}}` (idempotent) | 401 |
| GET `/documents/:id` | Bearer | — | 200 `{...,versionCount,content,filename,chunks:[{id,index,content}],versions:[...]}` | 401, 404 (also when invisible) |
| GET `/documents/:id/versions` | Bearer | — | 200 `[{id,documentId,version,contentHash,filename,createdAt}]` | 401, 404 |
| DELETE `/documents/:id` | Bearer (owner/admin/ACL-ADMIN) | — | 200 `{ok:true}` (soft delete) | 401, 404 |
| POST `/documents/:id/revoke` | Bearer (owner/admin) | `{principalType,principalId}` | 200 `{ok:true}` | 401, 404 |

## Sources

| Method & path | Auth | Request | Success | Errors |
|---|---|---|---|---|
| GET `/sources` | Bearer | — | 200 `[{id,tenantId,type,name,status,lastSyncAt,createdAt,documentCount}]` | 401 |
| POST `/sources` | Bearer + manager/admin | `{type:google_drive\|slack\|crm\|manual,name min1}` | 201 source row | 401, 403, 409 unknown type |
| DELETE `/sources/:id` | Bearer + admin | — | 200 `{ok:true}` (soft delete) | 401, 403, 404 |
| POST `/sources/:id/sync` | Bearer + manager/admin | — | 200 `{synced:0}` (stub) | 401, 403, 404/500 `Source not found` |

## Conversations / Feedback / Users

| Method & path | Auth | Request | Success | Errors |
|---|---|---|---|---|
| GET `/conversations` | Bearer | — | 200 `[{id,title,createdAt,updatedAt}]` (mine, 100) | 401 |
| POST `/conversations` | Bearer | `{title?}` | 201 conversation | 401 |
| GET `/conversations/:id` | Bearer | — | 200 `{...,messages:[{id,query,answer,status,createdAt,sources}]}` | 401, 404 |
| POST `/feedback` | Bearer | `{requestId,helpful:boolean,comment?}` | 200 `{ok:true}` | 401, 404 request not mine |
| GET `/users` | Bearer + admin | — | 200 `[{id,email,name,role,createdAt}]` | 401, 403 |
| POST `/users/invite` | Bearer + admin | `{email,password min8,name?,role?}` (default employee) | 201 user | 401, 403, 409 |

## Admin / Evals / Misc (all guarded in Spring Boot)

| Method & path | Auth (Spring) | Success |
|---|---|---|
| GET `/admin/audit?limit=` | Bearer + admin | 200 audit rows desc (cap 500, default 50) |
| GET `/admin/ingestion` | Bearer + admin | 200 `{queue:{waiting,active,completed,failed,delayed},sources,documents,failed:[...10]}` |
| GET `/admin/metrics` | Bearer + admin | 200 `{queries,feedback:[{helpful,_count}],recentErrors:[10]}` |
| GET `/evals/retrieval` | Bearer + manager/admin | 200 `{total,hits,hitRate,recallAt5,results}` |
| GET `/evals/rag` | Bearer + manager/admin | 200 `{total,ok,accuracy,results}` |
| GET `/metrics` | Bearer + admin | 200 `{counters,latencies,uptimeSeconds}` |
| GET `/metrics/prometheus` | Bearer + admin | 200 text exposition |
| GET `/health` | public | 200 `{status:ok\|degraded,service:kiro-api,checks:{db,redis,ai}}` |

Error shape (Spring `ApiError`): `{timestamp,status,error,message,path,requestId}`.
Validation → 400, bad credentials → 401, forbidden role → 403, invisible/missing → 404,
conflict → 409, throttle → 429, AI/retrieval down → 503.
