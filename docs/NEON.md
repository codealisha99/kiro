# Running kiro-api on Neon

Status: the URL conversion is covered by unit tests (`DataSourceConfigTest`). The Neon-specific
behaviour below comes from Neon's documentation and has not been tested against a live Neon project.

## DATABASE_URL

Use Neon's connection string as-is:

```
DATABASE_URL="postgresql://USER:PASSWORD@ep-example-123456.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
```

`DataSourceConfig` converts it to JDBC and keeps the query parameters:

- `sslmode=require` is passed through unchanged. TLS is required by Neon.
- `channel_binding=require` becomes pgjdbc's `channelBinding=require`.
- Prisma's `schema=` parameter is dropped.
- `stringtype=unspecified` is added (needed for the native PostgreSQL enum columns).

## Direct or pooled endpoint

Neon serves a direct endpoint (`ep-…neon.tech`) and a pooled one (`ep-…-pooler.neon.tech`, PgBouncer).

- **Default: use the direct endpoint for `DATABASE_URL`.** Flyway runs at startup on the same
  datasource. Its advisory lock does not work through PgBouncer in transaction mode.
- If you want the app to use the pooled endpoint, run migrations against the direct endpoint:
  set `SPRING_FLYWAY_URL` (a `jdbc:postgresql://…` URL on the direct host), `SPRING_FLYWAY_USER`
  and `SPRING_FLYWAY_PASSWORD`. Spring Boot 3.2.5 has a Flyway URL condition, so `spring.flyway.url`
  should override the primary datasource for Flyway. We have not exercised this in the repo's tests.
- Transaction-mode pooling limitations to keep in mind for the app pool:
  - No session `SET` or `search_path`.
  - No session-level advisory locks.
  - No `LISTEN` / `NOTIFY`.
  - Protocol-level prepared statements are supported. How pgjdbc's `prepareThreshold` interacts with
    the pooler is unverified.

## Extensions

- `pgvector` is supported. V1 runs `CREATE EXTENSION IF NOT EXISTS vector`, so the database role must be
  allowed to create it. Neon's extension list is the source of truth:
  https://neon.com/docs/extensions/pg-extensions
- `ltree` is also supported. We do not use it: reporting lines allow several managers per person, which a
  single-path model does not represent.
- Apache AGE is not supported. The organization graph is traversed with recursive CTEs over the edge tables.

## Compute and cold starts

Neon can suspend idle computes. Per Neon's docs, the default is about 5 minutes idle, and reactivation takes
a few hundred milliseconds. The first request after a suspend pays that cost. For a paid production
deployment, consider disabling scale-to-zero. This is from documentation, not measured here.

Sources: https://neon.com/docs/connect/connection-pooling ,
https://neon.com/docs/connect/connect-from-any-app , https://neon.com/docs/introduction/auto-suspend
