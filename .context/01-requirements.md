# Company Brain — MVP Requirements

## Included Data Sources

- Google Drive
- Slack
- CRM

## Supported Data

- documents
- PDFs
- text
- spreadsheets (where practical)
- Slack messages
- CRM records

## AI Capabilities

- semantic search
- keyword search
- hybrid retrieval
- RAG (Retrieval-Augmented Generation)
- citations
- source metadata
- basic conflict detection
- "I don't know" behavior

## Security

- authentication
- RBAC
- document/resource permissions
- query-time authorization
- tenant isolation
- audit logs

## Infrastructure

- ingestion pipeline
- background jobs
- vector search
- metadata store
- LLM gateway
- evaluation framework
- observability

---

## OUT OF SCOPE for MVP

The following must NOT be built initially (can be built on top of MVP infrastructure later):

- autonomous agents
- autonomous actions
- complex multi-agent systems
- forecasting
- simulation
- advanced decision intelligence
- external web intelligence
- full knowledge graph
- role-specific fine-tuning
- complex organizational memory
- dozens of connectors
- autonomous CRM modifications
- fully automated business decisions

---

## Query Types (MVP)

The MVP must support these query classes:

1. **Type 1 — Factual**: "What is our refund policy?"
2. **Type 2 — Search**: "Find documents related to supplier onboarding."
3. **Type 3 — Summarization**: "Summarize the latest supplier policy."
4. **Type 4 — Cross-source**: "What happened with Client X?"
5. **Type 5 — Unknown**: "What was our revenue in 2035?" → Expected: "I don't have sufficient information to answer that."

---

## Unknown / Ambiguity Handling

The system must distinguish:
- **Known** — Answer with evidence.
- **Unknown** — State that evidence is unavailable.
- **Partial** — Explain what is known and what is missing.
- **Ambiguous** — Ask for clarification.

---

## MVP Success Criteria

Successful when:

**Knowledge**
- Three initial sources are connected
- Data can be ingested reliably
- Updates are synchronized
- Deletes are processed
- Versions are represented

**Security**
- Authentication works
- RBAC works
- Tenant isolation works
- Query-time permissions work
- Revoked access is respected
- Unauthorized retrieval = 0
- Unauthorized LLM context = 0

**AI**
- Retrieval is measurable
- Answers are grounded
- Citations work
- Unknown questions are handled correctly
- Cross-source questions work

**Infrastructure**
- Background ingestion works
- Failed jobs retry
- Duplicate events are handled
- Observability exists
- Model usage is tracked
- Costs are measurable

**Product**
- Employees can ask questions
- Employees can inspect sources
- Employees trust answers enough to use the system
- At least one business workflow demonstrates measurable time savings

---

## MVP Quality Targets (initial engineering/product targets)

| Metric | Target |
|--------|--------|
| Retrieval Recall@5 | >= 85% |
| Retrieval Precision@5 | >= 75% |
| Citation Correctness | >= 95% |
| Unknown Detection | >= 95% |
| Permission Leakage | = 0 |
| Unauthorized LLM Context | = 0 |
| Unauthorized Action | = 0 |
| Freshness SLA Compliance | >= 95% |
| Standard Query P95 | < 5 sec |
| API Availability | >= 99.9% |

*These are initial targets and should be recalibrated using real production data.*
