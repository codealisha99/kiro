# Company Brain — MVP Tech Stack

## Frontend

- React
- Next.js
- TypeScript

## Backend

- Node.js
- NestJS
- TypeScript

## Database

- PostgreSQL
- Vector Search: pgvector

## Cache

- Redis

## Background Jobs

- BullMQ

## AI Service

- Python
- FastAPI
- LLM provider-independent LLM Gateway

## Storage

- S3 or equivalent

---

## DevOps & Infrastructure

- Containerization: Docker
- CI/CD: GitHub Actions
- Monitoring: OpenTelemetry
- Metrics: Prometheus
- Dashboards: Grafana

---

## MVP Deployment

Deployable **without Kubernetes**. See `02-architecture.md` for the deployment diagram.

---

## Query & Ingestion Workflows

### Ingestion Workflow

```
Connector
  | Fetch Data
  | Create Event
  | Queue
  | Worker
  | Parse
  | Normalize
  | Extract Metadata
  | Extract ACL
  | Generate Chunks
  | Generate Embeddings
  | Store PostgreSQL
  | Store pgvector
```

The workflow must be **retryable** and **idempotent**.

### Query Workflow

```
User
  | Authenticate
  | Resolve Tenant
  | Resolve Permissions
  | Classify Query
  | Generate Search Query
  | Hybrid Retrieval
  | Permission Filter
  | Rank
  | Context Builder
  | LLM Gateway
  | Validate
  | Citations
  | Response
  | Audit
```

---

## Error Handling

The system should handle:
- connector failure
- malformed document
- embedding failure
- vector search failure
- database failure
- LLM timeout
- LLM failure
- invalid response
- permission service failure

Security-sensitive failures should **fail closed**.

---

## Reliability Requirements

The system should include:
- request timeout
- retry with backoff
- dead-letter queue
- health checks
- idempotency
- structured logs
- graceful degradation

**The system must never retry an action in a way that creates duplicate side effects.**

---

## Admin Features

Admin dashboard should show:

**Sources:** connected sources, connection status, last sync, sync failures

**Knowledge:** total documents, indexed documents, stale documents, failed documents

**Security:** permission failures, suspicious requests, audit logs

**AI:** queries, latency, token usage, cost, errors

---

## Observability

The MVP must track:

**API:** request count, latency, errors, availability

**AI:** model, tokens, latency, cost, failures

**Retrieval:** number of results, retrieval latency, top scores, sources

**Ingestion:** documents processed, documents failed, documents updated, documents deleted, queue depth

---

## MVP User Experience (Reference)

```
+--------------------------------------+
|              COMPANY BRAIN           |
+--------------------------------------+
|                                      |
| Ask anything about the company...    |
|                                      |
| [ What's our refund policy?       ]  |
|                                      |
+--------------------------------------+

Answer:
Our current refund policy allows...

Sources:
[Refund Policy v3] [Operations Handbook]

Updated: 2 hours ago    Confidence: High
```
