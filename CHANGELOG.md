# Changelog

## 2.0.0

Rewritten for GenesisDB 2.0. This release is not compatible with GenesisDB 1.x servers or with the 1.x client API.

- Configuration through `url` and `token`, falling back to `GENESISDB_URL` and `GENESISDB_AUTH_TOKEN`. The API version setting is gone.
- Canonical 2.0 routes: `/ping`, `/api/v1/status`, `/api/v1/status/audit`, `/api/v1/commit`, `/api/v1/fetch`, `/api/v1/subscribe`, `/api/v1/query`, `/api/v1/subjects`, `/api/v1/types`, `/api/v1/schemas`, `/api/v1/erase`.
- `commit` now returns the stored events the server answers with, including ID, time, hash and predecessor hash. Earlier clients discarded that response.
- `fetch` replaces the former stream call, `subscribe` consumes Server-Sent Events with heartbeat handling.
- Precondition factories for `isSubjectNew`, `isSubjectExisting` and `isQueryResultTrue`.
- Typed errors: precondition failure (412) with the parsed type and message, authentication (401, 403), not found (404), conflict (409, schema already registered), unprocessable (422), not ready (503).
- Schema registration and listing, status with engine and storage details.
- No CloudEvents SDK dependency, events are plain typed values.
