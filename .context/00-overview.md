# Company Brain — Project Overview

Source: `PRODUCT REQUIREMENTS DOCUMENT (PRD) COMPANY BRAIN.pdf` (Version 1.0)

## What is Company Brain?

Company Brain is a **centralized, permission-aware AI knowledge infrastructure** that:
- Connects to a company's existing data sources (Google Drive, Slack, CRM)
- Makes **authorized** organizational knowledge searchable through an AI chat interface
- Provides grounded answers with citations

**Important:** This is an MVP *infrastructure*, NOT a fully autonomous AI agent. Its purpose is to establish the infrastructure required for future capabilities such as AI agents, organizational memory, analytics, decision intelligence, role-specific intelligence, automated workflows, recommendations, and controlled actions.

**MVP question to answer:** *"Can we build a trustworthy AI layer over the company's existing information?"*

## Product Type

- Internal Enterprise AI Infrastructure (MVP)
- Initial Users: Internal employees
- Initial Data Sources: Google Drive, Slack, CRM
- Initial Architecture: MERN-oriented application + AI services

## MVP Objective — Five Foundational Capabilities

1. **Ingest** company information
2. **Understand and preserve** permissions
3. **Retrieve** relevant information
4. **Generate grounded answers** with citations
5. Provide a **reliable foundation** for future AI capabilities

## Priority Order (most important first)

> **Security > Correctness > Trust > Simplicity > Scale**

## MVP End State

At the end of the MVP, an employee should be able to:
1. Log into Company Brain
2. Ask a question about the company
3. Have the system determine what information they are allowed to access
4. Search across connected company sources
5. Retrieve relevant information
6. Generate an answer grounded in that information
7. See citations and source timestamps
8. Receive an explicit "I don't know" when evidence is insufficient
9. Receive conflict warnings when sources disagree
10. Have all access and AI activity auditable
11. Experience the same security boundaries as the underlying company systems

## Foundational Contract

```
                    COMPANY BRAIN
                           |
           +---------------+---------------+
           |               |               |
      KNOWLEDGE       SECURITY        EVALUATION
           |               |               |
       Retrieval       Permissions       Quality
       RAG             RBAC/ACL          Metrics
       Sources         Tenant            Testing
       Citations                       Monitoring
           |               |               |
           +---------------+---------------+
                           |
                      INFRASTRUCTURE
                           |
              Future AI capabilities
```

The objective is NOT to build every intelligent feature immediately. The objective is to build a **secure, permission-aware, observable, evaluatable knowledge infrastructure** that future Company Brain capabilities can reliably depend upon.
