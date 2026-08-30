# Company Brain — MVP Architecture

## High-Level Architecture

```
                    USER
                     |
                     v
            React / Next.js (Frontend)
                     |
                     v
              NestJS API (Backend)
                     |
        +-----------+-----------+
        |                       |
        v                       v
   Auth / RBAC             Brain API
                                   |
                             Query Pipeline
                                   |
                    +--------------+--------------+
                    |              |              |
                    v              v              v
                Retriever      PostgreSQL      Redis
                    |                             
                    v                             
                 pgvector                         
                    |                             
                    v                             
              Context Builder                     
                    |                             
                    v                             
               LLM Gateway                        
                    |                             
                    v                             
              Answer Validator                    
                    |                             
                    v                             
               Citations                          
                    |                             
                    v                             
                   USER
```

### Data Ingestion (separate path)

```
   Google Drive ----+
   Slack -----------+--> Connectors --> Job Queue --> Ingestion
   CRM --------------+                                        |
                                                              v
                                                      Normalization
                                                              |
                                                              v
                                                       ACL Extraction
                                                              |
                                                              v
                                                          Chunking
                                                              |
                                                              v
                                                         Embeddings
                                                              |
                                             +-----+-----+     |
                                             |           |     |
                                             v           v     v
                                          PostgreSQL  pgvector
```

The **ingestion pipeline must be asynchronous**.

---

## Deployment Architecture

```
                       CLOUD
                          |
           +--------------+--------------+
           |              |              |
       Frontend          Backend
                          |
           +--------------+--------------+
           |              |              |
        PostgreSQL       Redis        AI Service
           |              |              |
         pgvector        BullMQ       LLM Gateway
           |              |
                       Storage
```

The MVP should be **deployable without Kubernetes**.

---

## Retrieval Engine (initial)

```
User Query
     |
     +-> Query Embedding
     +-> Vector Search
     +-> Keyword Search
     +-> Merge Results
     +-> Permission Filter
     +-> Ranking
     +-> Top K
```

Support: semantic search, keyword search, metadata filtering, permission filtering.

---

## RAG Pipeline

```
User Query
     |
     +-> Authentication
     +-> Permission Resolution
     +-> Query Processing
     +-> Retrieval
     +-> Permission Filtering
     +-> Context Construction
     +-> LLM
     +-> Answer Validation
     +-> Citation Validation
     +-> Response
```
