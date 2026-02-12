# API Conventions

## Versioning

- Versioned API routes under `/v1`.
- Operational routes outside versioning (`/healthz`, `/docs`).

## Auth

- Header: `Authorization: Bearer <access-token>`.
- Access token: short TTL.
- Refresh token: long TTL with rotation.

## Errors

- Consistent error body:

```json
{
  "code": "string_code",
  "message": "Human readable message",
  "details": {}
}
```

## Pagination

- Cursor-based pagination for list endpoints.
- Query shape: `?cursor=<opaque>&limit=<n>`.

## IDs

- UUID primary keys for v1 entities.
