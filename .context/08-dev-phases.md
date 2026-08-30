# Company Brain — Development Phases

## Phase 1 — Foundation

**Build:**
- project structure
- authentication
- users
- roles
- tenants
- PostgreSQL
- Redis
- logging

**Testing:**
- authentication tests
- RBAC tests
- tenant isolation tests
- API unit tests

**Exit criteria:** Secure API foundation is operational.

## Phase 2 — Ingestion

**Build:**
- Google Drive connector
- Slack connector
- CRM connector
- parser
- normalizer
- chunker
- metadata
- ACL
- queue
- pgvector

**Testing:**
- ingestion correctness
- duplicate events
- update events
- delete events
- malformed documents
- ACL extraction

**Exit criteria:** Company data can reliably enter the knowledge layer.

## Phase 3 — Retrieval

**Build:**
- semantic retrieval
- keyword retrieval
- hybrid ranking
- permission filtering

**Testing:**
- Recall@5
- Precision@5
- MRR
- permission leakage

**Exit criteria:** Relevant and authorized information is retrieved.

## Phase 4 — RAG

**Build:**
- context construction
- LLM Gateway
- answer generation
- citation generation
- unknown handling

**Testing:**
- groundedness
- hallucination
- citation correctness
- unknown handling
- cross-source questions

**Exit criteria:** The Brain provides trustworthy answers based on retrieved evidence.

## Phase 5 — Security Hardening

**Build:**
- query-time authorization
- permission revocation
- tenant isolation
- audit logging
- prompt injection defenses
- security monitoring

**Testing:**
- RBAC
- ABAC where required
- IDOR
- cross-tenant access
- revoked permissions
- prompt injection
- data poisoning

**Exit criteria:** Zero unauthorized data disclosure in the defined security test suite.

## Phase 6 — MVP Pilot

**Deploy to:**
- 20–50 users
- one department
- three data sources

**Collect:**
- usage
- feedback
- failed queries
- missing sources
- retrieval failures
- permission issues

**Measure:**
- weekly active users
- query success
- retrieval quality
- latency
- cost
- time saved
