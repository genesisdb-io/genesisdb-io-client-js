import { errorForResponse, GenesisDBError } from './errors.js';
import type {
  ClientConfig,
  Event,
  FetchOptions,
  NewEvent,
  Precondition,
  RegisteredSchema,
  Schema,
  Status,
  SubscribeOptions,
} from './types.js';

const userAgent = 'genesisdb-js/2';

/**
 * Client for the GenesisDB HTTP API.
 *
 * ```ts
 * const db = new Client({ url: 'http://localhost:8080', token: process.env.GENESISDB_AUTH_TOKEN });
 * await db.commit([{ source: 'app', subject: '/customer/1', type: 'customer.created', data: { name: 'Bruce' } }]);
 * const events = await db.fetch('/customer');
 * ```
 *
 * Every method throws {@link GenesisDBError} (or a subclass) on a non-2xx answer.
 */
export class Client {
  private readonly url: string;
  private readonly token: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(config: ClientConfig = {}) {
    const env = typeof process !== 'undefined' ? process.env : ({} as Record<string, string | undefined>);
    const url = config.url ?? env.GENESISDB_URL;
    const token = config.token ?? env.GENESISDB_AUTH_TOKEN;
    if (!url) {
      throw new Error('GenesisDB URL missing: pass { url } or set GENESISDB_URL');
    }
    if (!token) {
      throw new Error('GenesisDB token missing: pass { token } or set GENESISDB_AUTH_TOKEN');
    }
    this.url = url.replace(/\/+$/, '');
    this.token = token;
    this.timeoutMs = config.timeoutMs ?? 30_000;
    this.fetchImpl = config.fetch ?? globalThis.fetch;
    if (!this.fetchImpl) {
      throw new Error('No fetch available: pass { fetch } or use Node 18 or newer');
    }
  }

  // Health and status

  /** Liveness check, no token required by the server. Resolves to "Pong". */
  async ping(): Promise<string> {
    return this.text('GET', '/api/v2/ping', undefined, 'ping');
  }

  /** Engine version, host, event counts, storage format and readiness. */
  async status(): Promise<Status> {
    return this.json<Status>('GET', '/api/v2/status', undefined, 'status');
  }

  /** Verify the hash chain of the whole store. Administrator token. Resolves to the audit text. */
  async audit(): Promise<string> {
    return this.text('GET', '/api/v2/admin/audit', undefined, 'audit');
  }

  // Events

  /**
   * Commit events atomically, with optional preconditions. Resolves to the stored events with
   * ID, time and hashes. Throws {@link PreconditionFailedError} when a precondition does not hold.
   */
  async commit<T = unknown>(events: NewEvent<T>[], preconditions: Precondition[] = []): Promise<Event<T>[]> {
    if (events.length === 0) {
      throw new Error('commit requires at least one event');
    }
    const body: Record<string, unknown> = { events };
    if (preconditions.length > 0) {
      body.preconditions = preconditions;
    }
    return this.ndjson<Event<T>>('POST', '/api/v2/commit', body, 'commit');
  }

  /** Fetch the events of a subject and all of its descendants, in commit order. */
  async fetch<T = unknown>(subject: string, options?: FetchOptions): Promise<Event<T>[]> {
    const body: Record<string, unknown> = { subject };
    if (options && Object.keys(options).length > 0) {
      body.options = options;
    }
    return this.ndjson<Event<T>>('POST', '/api/v2/fetch', body, 'fetch');
  }

  /**
   * Subscribe to a subject and its descendants. Yields the existing history first, then new
   * events as they are committed. Runs until the signal aborts or the server closes the stream.
   *
   * ```ts
   * const controller = new AbortController();
   * for await (const event of db.subscribe('/order', { signal: controller.signal })) { ... }
   * ```
   */
  async *subscribe<T = unknown>(
    subject: string,
    options: SubscribeOptions & { signal?: AbortSignal } = {},
  ): AsyncGenerator<Event<T>, void, undefined> {
    const { signal, interval, ...fetchOptions } = options;
    const body: Record<string, unknown> = { subject };
    if (interval !== undefined) {
      body.interval = interval;
    }
    if (Object.keys(fetchOptions).length > 0) {
      body.options = fetchOptions;
    }
    const response = await this.fetchImpl(this.url + '/api/v2/subscribe', {
      method: 'POST',
      headers: this.headers('application/json'),
      body: JSON.stringify(body),
      signal,
    });
    if (!response.ok) {
      throw errorForResponse(response.status, await response.text(), 'subscribe');
    }
    if (!response.body) {
      throw new GenesisDBError(response.status, 'response has no body', 'subscribe');
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let eventName = '';
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) {
          return;
        }
        buffer += decoder.decode(value, { stream: true });
        let newline: number;
        while ((newline = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, newline).replace(/\r$/, '');
          buffer = buffer.slice(newline + 1);
          if (line.startsWith('event: ')) {
            eventName = line.slice(7).trim();
            continue;
          }
          if (!line.startsWith('data: ')) {
            eventName = '';
            continue;
          }
          const payload = line.slice(6);
          if (eventName === 'error') {
            let message = payload;
            try {
              message = String(JSON.parse(payload).error ?? payload);
            } catch {
              // keep the raw payload
            }
            throw new GenesisDBError(200, message, 'subscribe ended');
          }
          eventName = '';
          const parsed = JSON.parse(payload);
          if (parsed && parsed.payload === '' && Object.keys(parsed).length === 1) {
            continue; // heartbeat
          }
          yield parsed as Event<T>;
        }
      }
    } finally {
      await reader.cancel().catch(() => undefined);
    }
  }

  /** Run a GDBQL query. Resolves to the result rows, or to a single value for a bare aggregate. */
  async query<R = unknown>(query: string): Promise<R[]> {
    return this.ndjson<R>('POST', '/api/v2/query', { query }, 'query');
  }

  /** Distinct top level subjects, sorted. */
  async subjects(): Promise<string[]> {
    const rows = await this.ndjson<{ subject: string }>('GET', '/api/v2/subjects', undefined, 'subjects');
    return rows.map((row) => row.subject);
  }

  /** Distinct event types, sorted. */
  async types(): Promise<string[]> {
    const rows = await this.ndjson<{ type: string }>('GET', '/api/v2/types', undefined, 'types');
    return rows.map((row) => row.type);
  }

  // Schemas

  /** Register a schema for an event type. Throws with status 409 when the type already has one. Administrator token. */
  async registerSchema(type: string, schema: Schema): Promise<void> {
    await this.json('POST', '/api/v2/schemas', { type, schema }, 'registerSchema');
  }

  /** Every registered schema. */
  async schemas(): Promise<RegisteredSchema[]> {
    return this.ndjson<RegisteredSchema>('GET', '/api/v2/schemas', undefined, 'schemas');
  }

  // Administration

  /**
   * Erase every reference payload below a subject. Inline event data is immutable and stays.
   * Throws with status 404 when the subject has no events, 422 when it has no reference payloads.
   * Administrator token. Resolves to the server's confirmation text.
   */
  async erase(subject: string): Promise<string> {
    return this.text('POST', '/api/v2/admin/erase', { subject }, 'erase');
  }


  // Transport

  private headers(contentType?: string): Record<string, string> {
    const headers: Record<string, string> = {
      Authorization: 'Bearer ' + this.token,
      'User-Agent': userAgent,
    };
    if (contentType) {
      headers['Content-Type'] = contentType;
    }
    return headers;
  }

  private async request(method: string, path: string, body: unknown, operation: string): Promise<Response> {
    const controller = this.timeoutMs > 0 ? new AbortController() : undefined;
    const timer = controller ? setTimeout(() => controller.abort(), this.timeoutMs) : undefined;
    try {
      const response = await this.fetchImpl(this.url + path, {
        method,
        headers: this.headers(body === undefined ? undefined : 'application/json'),
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller?.signal,
      });
      if (!response.ok) {
        throw errorForResponse(response.status, await response.text(), operation);
      }
      return response;
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
    }
  }

  private async text(method: string, path: string, body: unknown, operation: string): Promise<string> {
    return (await this.request(method, path, body, operation)).text();
  }

  private async json<R>(method: string, path: string, body: unknown, operation: string): Promise<R> {
    return (await this.request(method, path, body, operation)).json() as Promise<R>;
  }

  private async ndjson<R>(method: string, path: string, body: unknown, operation: string): Promise<R[]> {
    const text = await this.text(method, path, body, operation);
    const rows: R[] = [];
    for (const line of text.split('\n')) {
      const trimmed = line.trim();
      if (trimmed) {
        rows.push(JSON.parse(trimmed) as R);
      }
    }
    return rows;
  }
}
