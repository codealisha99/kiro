# Company Brain — API Design

## Authentication

- `POST /auth/login`
- `POST /auth/logout`
- `GET /auth/me`

## Query

- `POST /brain/query`

Request example:
```json
{
  "query": "What is our refund policy?"
}
```

## Documents

- `GET /documents`
- `GET /documents/:id`
- `GET /documents/:id/versions`

## Sources

- `GET /sources`
- `POST /sources`
- `DELETE /sources/:id`

## Conversations

- `GET /conversations`
- `POST /conversations`
- `GET /conversations/:id`

## Feedback

- `POST /feedback`

## Admin

- `GET /admin/ingestion`
- `GET /admin/health`
- `GET /admin/audit`
