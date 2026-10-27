/** A non-2xx answer from GenesisDB. */
export class GenesisDBError extends Error {
  readonly status: number;
  /** The response body as text, usually a one-line message */
  readonly body: string;

  constructor(status: number, body: string, operation: string) {
    super(`${operation}: ${status} ${body.trim() || 'no response body'}`);
    this.name = 'GenesisDBError';
    this.status = status;
    this.body = body;
  }
}

/** A commit was rejected because a precondition did not hold (412). */
export class PreconditionFailedError extends GenesisDBError {
  /** The precondition type that failed, for example "isSubjectNew" */
  readonly preconditionType: string;
  /** The server's explanation */
  readonly reason: string;

  constructor(body: string, operation: string) {
    super(412, body, operation);
    this.name = 'PreconditionFailedError';
    let type = '';
    let message = body;
    try {
      const parsed = JSON.parse(body);
      type = String(parsed.type ?? '');
      message = String(parsed.message ?? body);
    } catch {
      // plain text body, keep it as the reason
    }
    this.preconditionType = type;
    this.reason = message;
  }
}

/** The token was missing or wrong (401), or valid but not permitted for this operation (403). */
export class AuthenticationError extends GenesisDBError {
  constructor(status: number, body: string, operation: string) {
    super(status, body, operation);
    this.name = 'AuthenticationError';
  }
}

/** The store is not ready, for example during an index rebuild or after a storage failure (503). */
export class NotReadyError extends GenesisDBError {
  constructor(body: string, operation: string) {
    super(503, body, operation);
    this.name = 'NotReadyError';
  }
}

export function errorForResponse(status: number, body: string, operation: string): GenesisDBError {
  switch (status) {
    case 401:
    case 403:
      return new AuthenticationError(status, body, operation);
    case 412:
      return new PreconditionFailedError(body, operation);
    case 503:
      return new NotReadyError(body, operation);
    default:
      return new GenesisDBError(status, body, operation);
  }
}
