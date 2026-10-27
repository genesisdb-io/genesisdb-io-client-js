// Runs against a live GenesisDB. Skipped unless GENESISDB_URL and GENESISDB_AUTH_TOKEN
// (an administrator token) are set. Writes under /sdk-test-js/<run id>.
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { Client, PreconditionFailedError, GenesisDBError } from '../src/index.js';

const url = process.env.GENESISDB_URL;
const token = process.env.GENESISDB_AUTH_TOKEN;
const skip = !url || !token;

describe('integration', { skip: skip ? 'GENESISDB_URL and GENESISDB_AUTH_TOKEN not set' : false }, () => {
  const db = new Client({ url, token });
  const run = Date.now().toString(36);
  const root = `/sdk-test-js/${run}`;

  before(async () => {
    assert.equal(await db.ping(), 'Pong');
  });

  it('commits, fetches, queries', async () => {
    const stored = await db.commit([
      { source: 'sdk-test', subject: `${root}/customer/1`, type: 'sdk.customer-added', data: { name: 'Bruce', age: 40 } },
      { source: 'sdk-test', subject: `${root}/customer/2`, type: 'sdk.customer-added', data: { name: 'Selina', age: 35 } },
    ]);
    assert.equal(stored.length, 2);
    assert.match(stored[0]!.id, /^[0-9a-f-]{36}$/);
    assert.equal(stored[0]!.hash.length, 64);
    assert.equal(stored[1]!.predecessorhash, stored[0]!.hash);

    const fetched = await db.fetch<{ name: string }>(root);
    assert.deepEqual(fetched.map((e) => e.data.name), ['Bruce', 'Selina']);

    const bounded = await db.fetch(root, { lowerBound: stored[0]!.id, includeLowerBoundEvent: false });
    assert.deepEqual(bounded.map((e) => e.id), [stored[1]!.id]);

    const rows = await db.query<{ name: string }>(`STREAM e FROM events WHERE e.subject DESCENDANTS '${root}' ORDER BY e.data.age MAP { name: e.data.name }`);
    assert.deepEqual(rows.map((r) => r.name), ['Selina', 'Bruce']);

    const count = await db.query<number>(`STREAM e FROM events WHERE e.subject DESCENDANTS '${root}' MAP COUNT()`);
    assert.deepEqual(count, [2]);
  });

  it('enforces preconditions', async () => {
    await assert.rejects(
      db.commit(
        [{ source: 'sdk-test', subject: `${root}/customer/1`, type: 'sdk.noop', data: {} }],
        [{ type: 'isSubjectNew', payload: { subject: `${root}/customer/1` } }],
      ),
      (e: unknown) => e instanceof PreconditionFailedError && e.preconditionType === 'isSubjectNew',
    );
  });

  it('lists subjects and types', async () => {
    assert.ok((await db.subjects()).includes('/sdk-test-js'));
    assert.ok((await db.types()).includes('sdk.customer-added'));
  });

  it('stores reference payloads and erases them', async () => {
    const subject = `${root}/user/1`;
    const [event] = await db.commit([{ source: 'sdk-test', subject, type: 'sdk.user-added', data: { email: 'bruce@example.com' }, options: { storeDataAsReference: true } }]);
    assert.deepEqual(event!.data, { email: 'bruce@example.com' });
    const before = await db.fetch<{ email?: string }>(subject);
    assert.equal(before[0]!.data.email, 'bruce@example.com');
    const confirmation = await db.erase(subject);
    assert.match(confirmation, /Erased 1 ref data/);
    const after = await db.fetch(subject);
    assert.deepEqual(after[0]!.data, {});
  });

  it('refuses to erase inline data', async () => {
    await assert.rejects(db.erase(`${root}/customer/1`), (e: unknown) => e instanceof GenesisDBError && e.status === 422);
  });

  it('registers and lists schemas', async () => {
    const type = `sdk.schema-test-${run}`;
    await db.registerSchema(type, { type: 'object', properties: { n: { type: 'number' } }, required: ['n'] });
    await assert.rejects(db.registerSchema(type, { type: 'object' }), (e: unknown) => e instanceof GenesisDBError && e.status === 409);
    assert.ok((await db.schemas()).some((s) => s.type === type));
    await assert.rejects(
      db.commit([{ source: 'sdk-test', subject: `${root}/s/1`, type, data: { n: 'not a number' } }]),
      (e: unknown) => e instanceof GenesisDBError && e.status === 400,
    );
  });

  it('subscribes and receives a live event', async () => {
    const subject = `${root}/live`;
    const controller = new AbortController();
    const received: string[] = [];
    const consumer = (async () => {
      for await (const event of db.subscribe<{ n: number }>(subject, { interval: 0.1, signal: controller.signal })) {
        received.push(event.id);
        if (received.length === 2) {
          controller.abort();
        }
      }
    })().catch((e) => {
      if (e?.name !== 'AbortError') throw e;
    });
    await new Promise((r) => setTimeout(r, 300));
    const stored = await db.commit([
      { source: 'sdk-test', subject: `${subject}/1`, type: 'sdk.live', data: { n: 1 } },
      { source: 'sdk-test', subject: `${subject}/2`, type: 'sdk.live', data: { n: 2 } },
    ]);
    await consumer;
    assert.deepEqual(received, stored.map((e) => e.id));
  });

  it('reports status and passes the audit', async () => {
    const status = await db.status();
    assert.equal(status.storage.ready, true);
    assert.ok(status.events.count >= 5);
    assert.match(await db.audit(), /^Audit passed/);
  });

});
