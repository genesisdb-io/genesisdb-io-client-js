import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Client, GenesisDBError, PreconditionFailedError, AuthenticationError, NotReadyError } from '../src/index.js';

type Call = { url: string; init: RequestInit };

function fakeFetch(responses: Array<{ status?: number; body: string; headers?: Record<string, string> }>) {
  const calls: Call[] = [];
  let index = 0;
  const impl = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    const next = responses[index++] ?? { status: 500, body: 'no more fake responses' };
    return new Response(next.body, { status: next.status ?? 200, headers: next.headers });
  }) as typeof fetch;
  return { impl, calls };
}

const token = 'a'.repeat(64);

describe('Client construction', () => {
  it('requires a URL and a token', () => {
    const saved = { url: process.env.GENESISDB_URL, token: process.env.GENESISDB_AUTH_TOKEN };
    delete process.env.GENESISDB_URL;
    delete process.env.GENESISDB_AUTH_TOKEN;
    try {
      assert.throws(() => new Client({ token }), /URL missing/);
      assert.throws(() => new Client({ url: 'http://x' }), /token missing/);
    } finally {
      if (saved.url !== undefined) process.env.GENESISDB_URL = saved.url;
      if (saved.token !== undefined) process.env.GENESISDB_AUTH_TOKEN = saved.token;
    }
  });

  it('reads GENESISDB_URL and GENESISDB_AUTH_TOKEN', () => {
    process.env.GENESISDB_URL = 'http://env:8080/';
    process.env.GENESISDB_AUTH_TOKEN = token;
    const client = new Client({ fetch: fakeFetch([{ body: 'Pong' }]).impl });
    assert.ok(client);
    delete process.env.GENESISDB_URL;
    delete process.env.GENESISDB_AUTH_TOKEN;
  });

  it('strips trailing slashes from the URL', async () => {
    const { impl, calls } = fakeFetch([{ body: 'Pong' }]);
    await new Client({ url: 'http://x:8080///', token, fetch: impl }).ping();
    assert.equal(calls[0]?.url, 'http://x:8080/api/v2/ping');
  });
});

describe('Requests', () => {
  it('sends the bearer token and user agent', async () => {
    const { impl, calls } = fakeFetch([{ body: '' }]);
    await new Client({ url: 'http://x', token, fetch: impl }).fetch('/a');
    const headers = calls[0]?.init.headers as Record<string, string>;
    assert.equal(headers.Authorization, 'Bearer ' + token);
    assert.equal(headers['User-Agent'], 'genesisdb-js/2');
    assert.equal(headers['Content-Type'], 'application/json');
  });

  it('commit posts events and preconditions and parses the NDJSON answer', async () => {
    const stored = { source: 'app', subject: '/a/1', type: 't', id: 'id1', hash: 'h', data: { n: 1 } };
    const { impl, calls } = fakeFetch([{ body: JSON.stringify(stored) + '\n\n' }]);
    const client = new Client({ url: 'http://x', token, fetch: impl });
    const events = await client.commit(
      [{ source: 'app', subject: '/a/1', type: 't', data: { n: 1 } }],
      [{ type: 'isSubjectNew', payload: { subject: '/a/1' } }],
    );
    assert.equal(calls[0]?.url, 'http://x/api/v2/commit');
    const body = JSON.parse(calls[0]?.init.body as string);
    assert.equal(body.events.length, 1);
    assert.equal(body.preconditions[0].type, 'isSubjectNew');
    assert.deepEqual(events, [stored]);
  });

  it('commit without preconditions omits the field', async () => {
    const { impl, calls } = fakeFetch([{ body: '' }]);
    await new Client({ url: 'http://x', token, fetch: impl }).commit([{ source: 'a', subject: '/a', type: 't', data: {} }]);
    assert.equal('preconditions' in JSON.parse(calls[0]?.init.body as string), false);
  });

  it('commit refuses an empty batch locally', async () => {
    const { impl } = fakeFetch([]);
    await assert.rejects(new Client({ url: 'http://x', token, fetch: impl }).commit([]), /at least one event/);
  });

  it('fetch sends options only when given', async () => {
    const { impl, calls } = fakeFetch([{ body: '' }, { body: '' }]);
    const client = new Client({ url: 'http://x', token, fetch: impl });
    await client.fetch('/a');
    await client.fetch('/a', { lowerBound: 'x', includeLowerBoundEvent: true });
    assert.deepEqual(JSON.parse(calls[0]?.init.body as string), { subject: '/a' });
    assert.deepEqual(JSON.parse(calls[1]?.init.body as string), { subject: '/a', options: { lowerBound: 'x', includeLowerBoundEvent: true } });
  });

  it('query parses rows and single values', async () => {
    const { impl } = fakeFetch([{ body: '{"a":1}\n\n{"a":2}\n\n' }, { body: '42\n' }]);
    const client = new Client({ url: 'http://x', token, fetch: impl });
    assert.deepEqual(await client.query('x'), [{ a: 1 }, { a: 2 }]);
    assert.deepEqual(await client.query('y'), [42]);
  });

  it('subjects and types unwrap the rows', async () => {
    const { impl } = fakeFetch([{ body: '{"subject":"/a"}\n{"subject":"/b"}\n' }, { body: '{"type":"t"}\n' }]);
    const client = new Client({ url: 'http://x', token, fetch: impl });
    assert.deepEqual(await client.subjects(), ['/a', '/b']);
    assert.deepEqual(await client.types(), ['t']);
  });

  it('status returns the JSON object', async () => {
    const status = { engine: { version: '2.0.0', channel: 'stable' }, events: { count: 3 } };
    const { impl } = fakeFetch([{ body: JSON.stringify(status) }]);
    const result = await new Client({ url: 'http://x', token, fetch: impl }).status();
    assert.equal(result.engine.version, '2.0.0');
  });
});

describe('Errors', () => {
  it('412 becomes PreconditionFailedError with the parsed type and message', async () => {
    const { impl } = fakeFetch([{ status: 412, body: '{"type":"isSubjectNew","message":"subject /a already has events"}' }]);
    const client = new Client({ url: 'http://x', token, fetch: impl });
    await assert.rejects(
      client.commit([{ source: 'a', subject: '/a', type: 't', data: {} }]),
      (error: unknown) => {
        assert.ok(error instanceof PreconditionFailedError);
        assert.equal(error.status, 412);
        assert.equal(error.preconditionType, 'isSubjectNew');
        assert.match(error.reason, /already has events/);
        return true;
      },
    );
  });

  it('401 and 403 become AuthenticationError', async () => {
    const { impl } = fakeFetch([{ status: 401, body: 'No token provided' }, { status: 403, body: 'Token does not permit this operation' }]);
    const client = new Client({ url: 'http://x', token, fetch: impl });
    await assert.rejects(client.status(), (e: unknown) => e instanceof AuthenticationError && e.status === 401);
    await assert.rejects(client.status(), (e: unknown) => e instanceof AuthenticationError && e.status === 403);
  });

  it('503 becomes NotReadyError', async () => {
    const { impl } = fakeFetch([{ status: 503, body: 'store is unhealthy' }]);
    await assert.rejects(new Client({ url: 'http://x', token, fetch: impl }).fetch('/a'), (e: unknown) => e instanceof NotReadyError);
  });

  it('other statuses become GenesisDBError with status and body', async () => {
    const { impl } = fakeFetch([{ status: 409, body: 'Schema for this type already exists' }]);
    await assert.rejects(
      new Client({ url: 'http://x', token, fetch: impl }).registerSchema('t', { type: 'object' }),
      (e: unknown) => e instanceof GenesisDBError && e.status === 409 && /already exists/.test(e.body),
    );
  });
});

describe('Subscribe', () => {
  it('yields events, skips heartbeats, stops at stream end', async () => {
    const sse = [
      'data: {"id":"1","subject":"/a/1"}',
      '',
      'data: {"payload":""}',
      '',
      'data: {"id":"2","subject":"/a/2"}',
      '',
    ].join('\n') + '\n';
    const { impl } = fakeFetch([{ body: sse, headers: { 'Content-Type': 'text/event-stream' } }]);
    const client = new Client({ url: 'http://x', token, fetch: impl });
    const ids: string[] = [];
    for await (const event of client.subscribe<{ id: string }>('/a')) {
      ids.push(event.id);
    }
    assert.deepEqual(ids, ['1', '2']);
  });

  it('turns a server error event into a thrown error', async () => {
    const sse = 'data: {"id":"1"}\n\nevent: error\ndata: {"error":"subscription ended after repeated poll failures"}\n\n';
    const { impl } = fakeFetch([{ body: sse }]);
    const client = new Client({ url: 'http://x', token, fetch: impl });
    const seen: string[] = [];
    await assert.rejects(
      (async () => {
        for await (const event of client.subscribe<{ id: string }>('/a')) {
          seen.push(event.id);
        }
      })(),
      /repeated poll failures/,
    );
    assert.deepEqual(seen, ['1']);
  });

  it('sends interval and options in the body', async () => {
    const { impl, calls } = fakeFetch([{ body: '' }]);
    const client = new Client({ url: 'http://x', token, fetch: impl });
    for await (const _ of client.subscribe('/a', { interval: 0.5, lowerBound: 'x' })) {
      // empty stream
    }
    assert.deepEqual(JSON.parse(calls[0]?.init.body as string), { subject: '/a', interval: 0.5, options: { lowerBound: 'x' } });
  });
});
