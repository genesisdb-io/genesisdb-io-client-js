/** Connection settings. Both values fall back to GENESISDB_URL and GENESISDB_AUTH_TOKEN. */
export interface ClientConfig {
  /** Base URL of the GenesisDB server, for example http://localhost:8080 */
  url?: string;
  /** Bearer token: the administrator, writer or reader token of the server */
  token?: string;
  /** Request timeout in milliseconds for non-streaming calls. Default 30000, 0 disables. */
  timeoutMs?: number;
  /** Custom fetch implementation, for tests or environments without global fetch */
  fetch?: typeof fetch;
}

/** An event as stored and returned by GenesisDB. The field names are the CloudEvents attributes. */
export interface Event<T = unknown> {
  source: string;
  subject: string;
  type: string;
  specversion: string;
  id: string;
  /** RFC 3339 timestamp */
  time: string;
  datacontenttype: string;
  predecessorhash: string;
  data: T;
  hash: string;
}

/** Per-event options for a commit. */
export interface CommitOptions {
  /** Store the payload as reference data, so it can be erased later without breaking the hash chain */
  storeDataAsReference?: boolean;
}

/** An event to commit. ID, time, hashes and the remaining CloudEvents attributes are assigned by the server. */
export interface NewEvent<T = unknown> {
  source: string;
  /** Must start with "/". A single segment such as "/customer" gets a generated ID appended. */
  subject: string;
  type: string;
  /** A JSON object */
  data: T;
  options?: CommitOptions;
}

/** Holds when neither the subject nor a descendant has events. */
export interface IsSubjectNew {
  type: 'isSubjectNew';
  payload: { subject: string };
}

/** Holds when the subject or a descendant has events. */
export interface IsSubjectExisting {
  type: 'isSubjectExisting';
  payload: { subject: string };
}

/** Holds when the GDBQL query result is true, see the GDBQL reference. */
export interface IsQueryResultTrue {
  type: 'isQueryResultTrue';
  payload: { query: string };
}

/** A precondition that is checked atomically with the commit. A failed precondition answers 412. */
export type Precondition = IsSubjectNew | IsSubjectExisting | IsQueryResultTrue;

/** Narrow a fetch or subscription. Bounds are event IDs. */
export interface FetchOptions {
  /** Skip every event before this ID. An ID that does not occur below the subject yields an empty result. */
  lowerBound?: string;
  includeLowerBoundEvent?: boolean;
  /** Stop at this ID. */
  upperBound?: string;
  includeUpperBoundEvent?: boolean;
  /** Return only the newest event of this type below the subject. Ignored by subscriptions. */
  latestByEventType?: string;
}

export interface SubscribeOptions extends FetchOptions {
  /** Poll interval in seconds, default 1, between 0.1 and 86400 */
  interval?: number;
}

/** A JSON schema in the subset GenesisDB validates, see the HTTP API reference. */
export type Schema = Record<string, unknown>;

export interface RegisteredSchema {
  type: string;
  schema: Schema;
}

/** The body of GET /api/v1/status. */
export interface Status {
  engine: { version: string; channel: string };
  system: {
    os: string;
    arch: string;
    cpu: { availableCores: number; usedCores: number };
    memory: { total: number; used: number; available: number };
    storage: { max: number; used: number; available: number };
  };
  events: { count: number; subjects: number; types: number; storageSize: number };
  storage: { storageFormat: string; ready: boolean };
}

