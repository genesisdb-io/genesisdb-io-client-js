import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert';
import {
  Client,
  ClientConfig,
  CommitEvent,
  CommitEventOptions,
  StreamOptions,
  Precondition,
  IsSubjectNewPrecondition,
  IsSubjectExistingPrecondition,
  IsQueryResultTruePrecondition,
  GenericPrecondition,
  TypedPrecondition,
} from './client';
import { CloudEvent } from 'cloudevents';

describe('Client', () => {
  let client: Client;
  let fetchMock: ReturnType<typeof mock.fn>;
  let originalFetch: typeof global.fetch;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    originalFetch = global.fetch;

    fetchMock = mock.fn();
    global.fetch = fetchMock as any;

    process.env.GENESISDB_API_URL = 'http://localhost:8080';
    process.env.GENESISDB_API_VERSION = 'v1';
    process.env.GENESISDB_AUTH_TOKEN = 'test-token';
  });

  afterEach(() => {
    process.env = originalEnv;
    global.fetch = originalFetch;
  });

  describe('constructor', () => {
    it('should create client with environment variables', () => {
      const client = new Client();
      assert.ok(client);
    });

    it('should create client with config object', () => {
      const client = new Client({
        apiUrl: 'http://custom.api.com',
        apiVersion: 'v2',
        authToken: 'custom-token'
      });
      assert.ok(client);
    });

    it('should throw error when missing required environment variables', () => {
      delete process.env.GENESISDB_API_URL;
      assert.throws(
        () => new Client(),
        /Missing required environment variables: GENESISDB_API_URL/
      );
    });

    it('should throw error when config is incomplete and env vars are missing', () => {
      delete process.env.GENESISDB_API_URL;
      assert.throws(
        () => new Client({ apiVersion: 'v1', authToken: 'token' }),
        /Missing required environment variables: GENESISDB_API_URL/
      );
    });
  });

  describe('streamEvents', () => {
    beforeEach(() => {
      client = new Client();
    });

    it('should stream events successfully', async () => {
      const mockEvent = {
        id: '1',
        source: 'test',
        subject: '/test',
        type: 'test.event',
        data: { message: 'test' }
      };

      fetchMock.mock.mockImplementation(() => Promise.resolve({
        ok: true,
        text: async () => JSON.stringify(mockEvent) + '\n',
        headers: new Headers()
      }));

      const events = await client.streamEvents('/test');
      assert.strictEqual(events.length, 1);
      assert.ok(events[0] instanceof CloudEvent);

      const calls = fetchMock.mock.calls;
      assert.strictEqual(calls.length, 1);
      assert.strictEqual(calls[0].arguments[0], 'http://localhost:8080/api/v1/stream');
      assert.strictEqual(calls[0].arguments[1].method, 'POST');
      assert.strictEqual(calls[0].arguments[1].headers.Authorization, 'Bearer test-token');
    });

    it('should stream events with options', async () => {
      fetchMock.mock.mockImplementation(() => Promise.resolve({
        ok: true,
        text: async () => '',
        headers: new Headers()
      }));

      await client.streamEvents('/test', {
        lowerBound: '123',
        includeLowerBoundEvent: true,
        latestByEventType: 'test.type'
      });

      const calls = fetchMock.mock.calls;
      const body = JSON.parse(calls[0].arguments[1].body);
      assert.strictEqual(body.subject, '/test');
      assert.deepStrictEqual(body.options, {
        lowerBound: '123',
        includeLowerBoundEvent: true,
        latestByEventType: 'test.type'
      });
    });

    it('should stream events with upper bound', async () => {
      fetchMock.mock.mockImplementation(() => Promise.resolve({
        ok: true,
        text: async () => '',
        headers: new Headers()
      }));

      await client.streamEvents('/test', {
        upperBound: '456',
        includeUpperBoundEvent: false
      });

      const calls = fetchMock.mock.calls;
      const body = JSON.parse(calls[0].arguments[1].body);
      assert.deepStrictEqual(body.options, {
        upperBound: '456',
        includeUpperBoundEvent: false
      });
    });

    it('should stream events with both lower and upper bounds', async () => {
      fetchMock.mock.mockImplementation(() => Promise.resolve({
        ok: true,
        text: async () => '',
        headers: new Headers()
      }));

      await client.streamEvents('/test', {
        lowerBound: '123',
        includeLowerBoundEvent: true,
        upperBound: '456',
        includeUpperBoundEvent: true
      });

      const calls = fetchMock.mock.calls;
      const body = JSON.parse(calls[0].arguments[1].body);
      assert.deepStrictEqual(body.options, {
        lowerBound: '123',
        includeLowerBoundEvent: true,
        upperBound: '456',
        includeUpperBoundEvent: true
      });
    });

    it('should handle empty response', async () => {
      fetchMock.mock.mockImplementation(() => Promise.resolve({
        ok: true,
        text: async () => '',
        headers: new Headers()
      }));

      const events = await client.streamEvents('/test');
      assert.deepStrictEqual(events, []);
    });

    it('should handle API errors', async () => {
      fetchMock.mock.mockImplementation(() => Promise.resolve({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        headers: new Headers()
      }));

      await assert.rejects(
        async () => await client.streamEvents('/test'),
        /API Error: 500 Internal Server Error/
      );
    });

    it('should parse multiple NDJSON events', async () => {
      const event1 = { id: '1', source: 'test', subject: '/test1', type: 'test.event', data: { n: 1 } };
      const event2 = { id: '2', source: 'test', subject: '/test2', type: 'test.event', data: { n: 2 } };

      fetchMock.mock.mockImplementation(() => Promise.resolve({
        ok: true,
        text: async () => `${JSON.stringify(event1)}\n${JSON.stringify(event2)}\n`,
        headers: new Headers()
      }));

      const events = await client.streamEvents('/test');
      assert.strictEqual(events.length, 2);
      assert.ok(events[0] instanceof CloudEvent);
      assert.ok(events[1] instanceof CloudEvent);
    });
  });

  describe('commitEvents', () => {
    beforeEach(() => {
      client = new Client();
    });

    it('should commit events successfully', async () => {
      fetchMock.mock.mockImplementation(() => Promise.resolve({
        ok: true,
        headers: new Headers()
      }));

      await client.commitEvents([
        {
          source: 'test.source',
          subject: '/test/subject',
          type: 'test.event.created',
          data: { name: 'Test Event' }
        }
      ]);

      const calls = fetchMock.mock.calls;
      assert.strictEqual(calls.length, 1);
      assert.strictEqual(calls[0].arguments[0], 'http://localhost:8080/api/v1/commit');
      assert.strictEqual(calls[0].arguments[1].method, 'POST');

      const body = JSON.parse(calls[0].arguments[1].body);
      assert.deepStrictEqual(body.events[0], {
        source: 'test.source',
        subject: '/test/subject',
        type: 'test.event.created',
        data: { name: 'Test Event' }
      });
    });

    it('should commit events with options', async () => {
      fetchMock.mock.mockImplementation(() => Promise.resolve({
        ok: true,
        headers: new Headers()
      }));

      await client.commitEvents([
        {
          source: 'test.source',
          subject: '/test/subject',
          type: 'test.event.created',
          data: { name: 'Test Event' },
          options: { storeDataAsReference: true }
        }
      ]);

      const calls = fetchMock.mock.calls;
      const body = JSON.parse(calls[0].arguments[1].body);
      assert.deepStrictEqual(body.events[0].options, { storeDataAsReference: true });
    });

    it('should commit events with preconditions', async () => {
      fetchMock.mock.mockImplementation(() => Promise.resolve({
        ok: true,
        headers: new Headers()
      }));

      const preconditions: Precondition[] = [
        {
          type: 'isSubjectNew',
          payload: { subject: '/test/subject' }
        }
      ];

      await client.commitEvents(
        [
          {
            source: 'test.source',
            subject: '/test/subject',
            type: 'test.event.created',
            data: { name: 'Test Event' }
          }
        ],
        preconditions
      );

      const calls = fetchMock.mock.calls;
      const body = JSON.parse(calls[0].arguments[1].body);
      assert.deepStrictEqual(body.preconditions, preconditions);
    });

    it('should commit events with isSubjectExisting precondition', async () => {
      fetchMock.mock.mockImplementation(() => Promise.resolve({
        ok: true,
        headers: new Headers()
      }));

      const preconditions: IsSubjectExistingPrecondition[] = [
        {
          type: 'isSubjectExisting',
          payload: { subject: '/test/subject' }
        }
      ];

      await client.commitEvents(
        [{ source: 'test', subject: '/test/subject', type: 'test.updated', data: { v: 2 } }],
        preconditions
      );

      const body = JSON.parse(fetchMock.mock.calls[0].arguments[1].body);
      assert.deepStrictEqual(body.preconditions, preconditions);
    });

    it('should commit events with isQueryResultTrue precondition', async () => {
      fetchMock.mock.mockImplementation(() => Promise.resolve({
        ok: true,
        headers: new Headers()
      }));

      const preconditions: IsQueryResultTruePrecondition[] = [
        {
          type: 'isQueryResultTrue',
          payload: { query: "STREAM e FROM events WHERE e.subject == '/test' MAP COUNT() < 100" }
        }
      ];

      await client.commitEvents(
        [{ source: 'test', subject: '/test', type: 'test.created', data: {} }],
        preconditions
      );

      const body = JSON.parse(fetchMock.mock.calls[0].arguments[1].body);
      assert.deepStrictEqual(body.preconditions, preconditions);
    });

    it('should commit events with multiple mixed preconditions', async () => {
      fetchMock.mock.mockImplementation(() => Promise.resolve({
        ok: true,
        headers: new Headers()
      }));

      const preconditions: Precondition[] = [
        {
          type: 'isSubjectExisting',
          payload: { subject: '/user/456' }
        },
        {
          type: 'isQueryResultTrue',
          payload: { query: "STREAM e FROM events WHERE e.data.email == 'john.doe@example.com' MAP COUNT() == 0" }
        }
      ];

      await client.commitEvents(
        [{ source: 'test', subject: '/user/456', type: 'test.user-updated', data: { name: 'Jane' } }],
        preconditions
      );

      const body = JSON.parse(fetchMock.mock.calls[0].arguments[1].body);
      assert.strictEqual(body.preconditions.length, 2);
      assert.strictEqual(body.preconditions[0].type, 'isSubjectExisting');
      assert.strictEqual(body.preconditions[1].type, 'isQueryResultTrue');
    });

    it('should commit events with generic precondition (backward compatibility)', async () => {
      fetchMock.mock.mockImplementation(() => Promise.resolve({
        ok: true,
        headers: new Headers()
      }));

      const preconditions: GenericPrecondition[] = [
        {
          type: 'someCustomFuturePrecondition',
          payload: { foo: 'bar', baz: 123 }
        }
      ];

      await client.commitEvents(
        [{ source: 'test', subject: '/test', type: 'test.created', data: {} }],
        preconditions
      );

      const body = JSON.parse(fetchMock.mock.calls[0].arguments[1].body);
      assert.deepStrictEqual(body.preconditions[0].type, 'someCustomFuturePrecondition');
      assert.deepStrictEqual(body.preconditions[0].payload, { foo: 'bar', baz: 123 });
    });

    it('should handle API errors', async () => {
      fetchMock.mock.mockImplementation(() => Promise.resolve({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        headers: new Headers()
      }));

      await assert.rejects(
        async () => await client.commitEvents([
          {
            source: 'test',
            subject: '/test',
            type: 'test.event',
            data: {}
          }
        ]),
        /API Error: 400 Bad Request/
      );
    });
  });

  describe('eraseData', () => {
    beforeEach(() => {
      client = new Client();
    });

    it('should erase data successfully', async () => {
      fetchMock.mock.mockImplementation(() => Promise.resolve({
        ok: true,
        headers: new Headers()
      }));

      await client.eraseData('/test/subject');

      const calls = fetchMock.mock.calls;
      assert.strictEqual(calls[0].arguments[0], 'http://localhost:8080/api/v1/erase');
      const body = JSON.parse(calls[0].arguments[1].body);
      assert.strictEqual(body.subject, '/test/subject');
    });

    it('should handle API errors', async () => {
      fetchMock.mock.mockImplementation(() => Promise.resolve({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        headers: new Headers()
      }));

      await assert.rejects(
        async () => await client.eraseData('/test/subject'),
        /API Error: 404 Not Found/
      );
    });
  });

  describe('audit', () => {
    beforeEach(() => {
      client = new Client();
    });

    it('should get audit information successfully', async () => {
      const auditResponse = 'Audit successful';
      fetchMock.mock.mockImplementation(() => Promise.resolve({
        ok: true,
        text: async () => auditResponse,
        headers: new Headers()
      }));

      const result = await client.audit();

      assert.strictEqual(result, auditResponse);
      const calls = fetchMock.mock.calls;
      assert.strictEqual(calls[0].arguments[0], 'http://localhost:8080/api/v1/status/audit');
      assert.strictEqual(calls[0].arguments[1].method, 'GET');
    });

    it('should handle API errors', async () => {
      fetchMock.mock.mockImplementation(() => Promise.resolve({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        headers: new Headers()
      }));

      await assert.rejects(
        async () => await client.audit(),
        /API Error: 500 Internal Server Error/
      );
    });
  });

  describe('ping', () => {
    beforeEach(() => {
      client = new Client();
    });

    it('should ping successfully', async () => {
      const pingResponse = 'pong';
      fetchMock.mock.mockImplementation(() => Promise.resolve({
        ok: true,
        text: async () => pingResponse,
        headers: new Headers()
      }));

      const result = await client.ping();

      assert.strictEqual(result, pingResponse);
      const calls = fetchMock.mock.calls;
      assert.strictEqual(calls[0].arguments[0], 'http://localhost:8080/api/v1/status/ping');
    });

    it('should handle API errors', async () => {
      fetchMock.mock.mockImplementation(() => Promise.resolve({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
        headers: new Headers()
      }));

      await assert.rejects(
        async () => await client.ping(),
        /API Error: 503 Service Unavailable/
      );
    });
  });

  describe('q', () => {
    beforeEach(() => {
      client = new Client();
    });

    it('should execute query successfully', async () => {
      const queryResults = [
        { id: '1', name: 'Result 1' },
        { id: '2', name: 'Result 2' }
      ];

      fetchMock.mock.mockImplementation(() => Promise.resolve({
        ok: true,
        text: async () => `${JSON.stringify(queryResults[0])}\n${JSON.stringify(queryResults[1])}\n`,
        headers: new Headers()
      }));

      const results = await client.q('STREAM e FROM events MAP e.data');

      assert.deepStrictEqual(results, queryResults);
      const calls = fetchMock.mock.calls;
      assert.strictEqual(calls[0].arguments[0], 'http://localhost:8080/api/v1/q');
      const body = JSON.parse(calls[0].arguments[1].body);
      assert.strictEqual(body.query, 'STREAM e FROM events MAP e.data');
    });

    it('should handle empty query results', async () => {
      fetchMock.mock.mockImplementation(() => Promise.resolve({
        ok: true,
        text: async () => '',
        headers: new Headers()
      }));

      const results = await client.q('STREAM e FROM events WHERE false');
      assert.deepStrictEqual(results, []);
    });

    it('should handle API errors', async () => {
      fetchMock.mock.mockImplementation(() => Promise.resolve({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        headers: new Headers()
      }));

      await assert.rejects(
        async () => await client.q('INVALID QUERY'),
        /API Error: 400 Bad Request/
      );
    });
  });

  describe('queryEvents', () => {
    beforeEach(() => {
      client = new Client();
    });

    it('should call q method', async () => {
      const queryResults = [{ id: '1', name: 'Result' }];

      fetchMock.mock.mockImplementation(() => Promise.resolve({
        ok: true,
        text: async () => `${JSON.stringify(queryResults[0])}\n`,
        headers: new Headers()
      }));

      const results = await client.queryEvents('STREAM e FROM events');

      assert.deepStrictEqual(results, queryResults);
      const calls = fetchMock.mock.calls;
      const body = JSON.parse(calls[0].arguments[1].body);
      assert.strictEqual(body.query, 'STREAM e FROM events');
    });
  });

  describe('observeEvents', () => {
    beforeEach(() => {
      client = new Client();
    });

    it('should observe events as async generator', async () => {
      const event1 = { id: '1', source: 'test', subject: '/test', type: 'test.event', data: { n: 1 } };
      const event2 = { id: '2', source: 'test', subject: '/test', type: 'test.event', data: { n: 2 } };

      const mockReadableStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(`${JSON.stringify(event1)}\n`));
          controller.enqueue(new TextEncoder().encode(`${JSON.stringify(event2)}\n`));
          controller.close();
        }
      });

      fetchMock.mock.mockImplementation(() => Promise.resolve({
        ok: true,
        body: mockReadableStream,
        headers: new Headers()
      }));

      const events: CloudEvent<unknown>[] = [];
      for await (const event of client.observeEvents('/test')) {
        events.push(event);
      }

      assert.strictEqual(events.length, 2);
      assert.ok(events[0] instanceof CloudEvent);
      assert.ok(events[1] instanceof CloudEvent);
    });

    it('should handle SSE format with data: prefix', async () => {
      const event = { id: '1', source: 'test', subject: '/test', type: 'test.event', data: { n: 1 } };

      const mockReadableStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(event)}\n`));
          controller.close();
        }
      });

      fetchMock.mock.mockImplementation(() => Promise.resolve({
        ok: true,
        body: mockReadableStream,
        headers: new Headers()
      }));

      const events: CloudEvent<unknown>[] = [];
      for await (const e of client.observeEvents('/test')) {
        events.push(e);
      }

      assert.strictEqual(events.length, 1);
      assert.ok(events[0] instanceof CloudEvent);
    });

    it('should handle observe with options', async () => {
      const mockReadableStream = new ReadableStream({
        start(controller) {
          controller.close();
        }
      });

      fetchMock.mock.mockImplementation(() => Promise.resolve({
        ok: true,
        body: mockReadableStream,
        headers: new Headers()
      }));

      const generator = client.observeEvents('/test', {
        lowerBound: '123',
        includeLowerBoundEvent: true
      });

      for await (const _ of generator) {
        break;
      }

      const calls = fetchMock.mock.calls;
      const body = JSON.parse(calls[0].arguments[1].body);
      assert.deepStrictEqual(body.options, {
        lowerBound: '123',
        includeLowerBoundEvent: true
      });
    });

    it('should handle observe with upper bound', async () => {
      const mockReadableStream = new ReadableStream({
        start(controller) {
          controller.close();
        }
      });

      fetchMock.mock.mockImplementation(() => Promise.resolve({
        ok: true,
        body: mockReadableStream,
        headers: new Headers()
      }));

      const generator = client.observeEvents('/test', {
        lowerBound: '123',
        includeLowerBoundEvent: true,
        upperBound: '456',
        includeUpperBoundEvent: false
      });

      for await (const _ of generator) {
        break;
      }

      const calls = fetchMock.mock.calls;
      const body = JSON.parse(calls[0].arguments[1].body);
      assert.deepStrictEqual(body.options, {
        lowerBound: '123',
        includeLowerBoundEvent: true,
        upperBound: '456',
        includeUpperBoundEvent: false
      });
    });

    it('should handle API errors', async () => {
      fetchMock.mock.mockImplementation(() => Promise.resolve({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        headers: new Headers()
      }));

      const generator = client.observeEvents('/test');

      try {
        for await (const _ of generator) {
          break;
        }
        assert.fail('Should have thrown an error');
      } catch (error: any) {
        assert.match(error.message, /API Error: 500 Internal Server Error/);
      }
    });

    it('should handle null response body', async () => {
      fetchMock.mock.mockImplementation(() => Promise.resolve({
        ok: true,
        body: null,
        headers: new Headers()
      }));

      const generator = client.observeEvents('/test');

      try {
        for await (const _ of generator) {
          break;
        }
        assert.fail('Should have thrown an error');
      } catch (error: any) {
        assert.match(error.message, /Response body is null/);
      }
    });
  });
});