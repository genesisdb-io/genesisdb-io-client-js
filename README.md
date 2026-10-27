# GenesisDB client for JavaScript and TypeScript

The official client for [GenesisDB](https://www.genesisdb.io), the open source event sourcing database. Zero dependencies, works in Node 18+, Deno, Bun and browsers, ships ESM and CommonJS with type definitions.

> **Version 2.0.0 targets GenesisDB 2.0 and is not compatible with GenesisDB 1.x servers or with the 1.x client API.** Routes, configuration, type names and method signatures have changed. Keep a 1.x client for a 1.x server.
>
> Existing 1.x clients keep working against a GenesisDB 2.0 server, which still serves the unchanged 1.x API under `/api/v1`, so the server can be upgraded first and the clients at your own pace. New 2.0 features (stored events returned by commit, upper bounds, schemas, typed errors) need this 2.0.0 client.

```bash
npm install genesisdb
```

## Quick start

```ts
import { Client } from 'genesisdb';

const db = new Client({ url: 'http://localhost:8080', token: process.env.GENESISDB_AUTH_TOKEN });

await db.commit([
  { source: 'io.example.shop', subject: '/customer/42', type: 'io.example.shop.customer-registered', data: { name: 'Bruce Wayne' } },
]);

const events = await db.fetch('/customer/42');
```

`url` and `token` fall back to `GENESISDB_URL` and `GENESISDB_AUTH_TOKEN`, so `new Client()` works in an environment that sets both.

## Events

```ts
// Commit a batch atomically. The server assigns ID, time and hashes and returns the stored events.
const stored = await db.commit([
  { source: 'io.example.shop', subject: '/order/1', type: 'io.example.shop.order-placed', data: { total: 99.5 } },
  { source: 'io.example.shop', subject: '/order/1/item/1', type: 'io.example.shop.item-added', data: { sku: 'A1', qty: 2 } },
]);
stored[0].id;   // "3f2c..."
stored[0].hash; // "a9b1..."

// A subject with one segment gets a generated ID appended.
await db.commit([{ source: 'io.example.shop', subject: '/customer', type: 'io.example.shop.customer-registered', data: { name: 'Selina' } }]);

// Fetch a subject with all descendants, in commit order.
const all = await db.fetch('/order/1');

// Resume after a known event, or stop at one.
const since = await db.fetch('/order', { lowerBound: lastSeenId, includeLowerBoundEvent: false });
const until = await db.fetch('/order', { upperBound: someId, includeUpperBoundEvent: true });

// Only the newest event of a type below the subject.
const latest = await db.fetch('/order/1', { latestByEventType: 'io.example.shop.order-placed' });
```

Event payloads are typed through the generic parameter: `db.fetch<{ total: number }>('/order')` returns `Event<{ total: number }>[]`.

## Preconditions

Preconditions are checked atomically with the commit. A failed precondition throws `PreconditionFailedError` and writes nothing.

```ts
import { PreconditionFailedError } from 'genesisdb';

try {
  await db.commit(
    [{ source: 'io.example.shop', subject: '/customer/42', type: 'io.example.shop.customer-registered', data: { email: 'bruce@example.com' } }],
    [
      { type: 'isSubjectNew', payload: { subject: '/customer/42' } },
      { type: 'isQueryResultTrue', payload: { query: "STREAM e FROM events WHERE e.data.email == 'bruce@example.com' MAP COUNT() == 0" } },
    ],
  );
} catch (error) {
  if (error instanceof PreconditionFailedError) {
    console.log(error.preconditionType, error.reason); // "isSubjectNew" "subject /customer/42 already has events"
  }
}
```

Types: `isSubjectNew`, `isSubjectExisting`, `isQueryResultTrue`.

## Subscriptions

`subscribe` is an async generator over Server-Sent Events. It yields the existing history first, then new events as they are committed, and runs until you abort it.

```ts
const controller = new AbortController();

for await (const event of db.subscribe('/order', { interval: 0.5, signal: controller.signal })) {
  console.log(event.type, event.data);
  if (shouldStop) controller.abort();
}
```

`interval` is the poll interval in seconds (default 1). The bound options of `fetch` work here as well, so a consumer that persists the last processed event ID resumes with `lowerBound`.

## Queries

[GDBQL](https://github.com/genesisdb-io/genesisdb/blob/main/docs/gdbql.md) runs on the server. Results come back as rows, a bare aggregate as a single value.

```ts
const rows = await db.query<{ name: string; total: number }>(
  "STREAM e FROM events WHERE e.subject UNDER '/customer' MAP { name: e.data.name, total: e.data.total }",
);

const [count] = await db.query<number>("STREAM e FROM events WHERE e.type == 'io.example.shop.order-placed' MAP COUNT()");

const byCategory = await db.query(
  "STREAM e FROM events WHERE e.type == 'io.example.shop.item-added' GROUP BY e.data.category MAP { category: e.data.category, items: COUNT(), revenue: SUM(e.data.total) }",
);
```

## GDPR: reference payloads and erasure

Store a payload as reference data and it can be erased later. The event, its hash and the chain stay intact, the payload becomes `{}`.

```ts
await db.commit([
  { source: 'io.example.shop', subject: '/customer/42', type: 'io.example.shop.customer-registered', data: { name: 'Bruce', email: 'bruce@example.com' }, options: { storeDataAsReference: true } },
]);

await db.erase('/customer/42'); // administrator token
```

Inline payloads are immutable. `erase` on a subject without reference payloads throws with status 422.

## Schemas

```ts
await db.registerSchema('io.example.shop.order-placed', {
  type: 'object',
  properties: { total: { type: 'number' }, currency: { type: 'string' } },
  required: ['total'],
});

const schemas = await db.schemas();
```

Commits of that type are validated. A violation throws with status 400.

## Catalog, status, administration

```ts
await db.subjects();        // ["/customer", "/order"]
await db.types();           // ["io.example.shop.customer-registered", ...]
await db.status();          // engine version, event counts, storage, readiness
await db.ping();            // "Pong", no token required

await db.audit();           // "Audit passed. All 1234 events integrity checks succeeded."
```

Audit, erase and schema registration need the administrator token. Everything else works with a reader token (`GENESISDB_READ_TOKEN`), commit additionally with a writer token.

## Errors

Every non-2xx answer throws `GenesisDBError` with `status` and `body`. Subclasses: `PreconditionFailedError` (412, with `preconditionType` and `reason`), `AuthenticationError` (401, 403), `NotReadyError` (503). A subscription that the server ends with an error throws `GenesisDBError` from the generator.

## Configuration

```ts
new Client({
  url: 'http://localhost:8080',   // or GENESISDB_URL
  token: '...',                   // or GENESISDB_AUTH_TOKEN
  timeoutMs: 30000,               // for non-streaming calls, 0 disables
  fetch: customFetch,             // optional, defaults to globalThis.fetch
});
```

## Development

```bash
npm install
npm run build
npm test                                                           # unit tests with a fake fetch
GENESISDB_URL=http://localhost:8080 GENESISDB_AUTH_TOKEN=... npm run test:integration   # against a running GenesisDB
```

## License

MIT
