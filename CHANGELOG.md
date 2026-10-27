# Changelog

## 2.0.0

Rewritten for GenesisDB 2.0. This release is not compatible with GenesisDB 1.x servers or with the 1.x client API.

- Configuration through `url` and `token`, falling back to `GENESISDB_URL` and `GENESISDB_AUTH_TOKEN`. The API version setting is gone.
- Uses API v2 of GenesisDB 2.0: `/api/v2/ping`, `/api/v2/status`, `/api/v2/commit`, `/api/v2/fetch`, `/api/v2/subscribe`, `/api/v2/query`, `/api/v2/subjects`, `/api/v2/types`, `/api/v2/schemas`, and `/api/v2/admin/audit`, `/api/v2/admin/erase` for administration.
- `commit` now returns the stored events the server answers with, including ID, time, hash and predecessor hash. Earlier clients discarded that response.
- `fetch` replaces the former stream call, `subscribe` consumes Server-Sent Events with heartbeat handling.
- Precondition factories for `isSubjectNew`, `isSubjectExisting` and `isQueryResultTrue`.
- Typed errors: precondition failure (412) with the parsed type and message, authentication (401, 403), not found (404), conflict (409, schema already registered), unprocessable (422), not ready (503).
- Schema registration and listing, status with engine and storage details.
- No CloudEvents SDK dependency, events are plain typed values.
