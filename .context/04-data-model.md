# Company Brain — Data Model

## Knowledge Object Model

Each document contains:

### Document

```
Document
---------------------
id
tenantId
sourceId
externalId
title
ownerId
classification
status
createdAt
updatedAt
```

### Version

```
DocumentVersion
---------------------
id
documentId
version
contentHash
createdAt
approvalStatus
```

### Chunk

```
DocumentChunk
---------------------
id
documentVersionId
content
embedding
metadata
```

### ACL

```
DocumentACL
---------------------
documentId
principalType
principalId
permission
```

---

## Query Data Model

### Request

```
AIRequest
---------------------
id
tenantId
userId
conversationId
query
createdAt
```

### Response

```
AIResponse
---------------------
id
requestId
answer
model
modelVersion
confidence
createdAt
```

### Evidence

```
ResponseEvidence
---------------------
responseId
documentId
versionId
chunkId
relevanceScore
```

---

## Source Provenance

Every answer should show where information came from:

```
Answer
  |
  +-- Source 1
  |     Document
  |     Version
  |     Timestamp
  +-- Source 2
        Document
        Version
        Timestamp
```

Users should be able to open the original source where supported.

---

## Document Versioning

The MVP should detect:
- new documents
- modified documents
- deleted documents

Example: Policy v1 → Policy v2 → Policy v3

The current version should be preferred. Old versions should remain available for audit/history where permitted.

---

## Basic Conflict Handling

If the Brain finds conflicting documents (e.g., Document A: Refund = 14 days; Document B: Refund = 30 days), it should NOT silently choose one. It should:

1. identify the conflict
2. check document version
3. check source authority if available
4. prefer current authoritative information
5. disclose uncertainty if unresolved

Example phrasing: *"I found conflicting information. The current approved policy states 30 days, while an older document states 14 days."*
