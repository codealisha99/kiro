# Company Brain — Core Components

The MVP consists of the following components.

## 6.1 Frontend

**Responsibilities:**
- login
- chat interface
- search
- citations
- source viewing
- conversation history
- basic feedback

**Technology:**
- React
- Next.js
- TypeScript

## 6.2 Backend API

**Responsibilities:**
- authentication
- authorization
- user management
- query handling
- retrieval orchestration
- conversation management
- citation management
- audit logging

**Technology:**
- Node.js
- TypeScript
- NestJS

## 6.3 Connector Layer

Responsible for communicating with external systems. Initial connectors:
- Google Drive
- Slack
- CRM

**Responsibilities:**
- authenticate with source
- retrieve data
- retrieve metadata
- retrieve permissions
- detect updates
- detect deletions
- emit ingestion events

## 6.4 Ingestion Pipeline

```
Source
  | Connector
  | Raw Data
  | Parser
  | Normalizer
  | Metadata Extraction
  | ACL Extraction
  | Classification
  | Chunking
  | Embedding
  | Index
```

The pipeline must be **asynchronous**.

## 6.5 Knowledge Store

- **PostgreSQL** for: users, roles, permissions, documents, document versions, metadata, source information, audit logs, conversations
- **pgvector** for: embeddings, semantic retrieval
- **Object storage** (S3) for: original documents where required

## 6.6 Retrieval Engine

Support:
- semantic search
- keyword search
- metadata filtering
- permission filtering

Initial retrieval flow:
```
User Query
  | Query Embedding
  | Vector Search
  | Keyword Search
  | Merge Results
  | Permission Filter
  | Ranking
  | Top K
```

## 6.7 LLM Gateway

The backend must **never directly depend on a single LLM provider**. Create a small abstraction:

```
LLM Gateway
  |
  +-- Provider A
  +-- Provider B
```

**Responsibilities:**
- model selection
- token limits
- timeout
- retry
- fallback
- cost tracking
- model version tracking

## 6.8 RAG Pipeline

```
User Query
  | Authentication
  | Permission Resolution
  | Query Processing
  | Retrieval
  | Permission Filtering
  | Context Construction
  | LLM
  | Answer Validation
  | Citation Validation
  | Response
```
