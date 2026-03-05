/** Options for storing an event */
export interface CommitEventOptions {
  /** When true, event data is stored as a separate reference that can be erased for GDPR compliance */
  storeDataAsReference?: boolean;
}

/** An event to commit to GenesisDB */
export interface CommitEvent {
  /** CloudEvents source identifier */
  source: string;
  /** Hierarchical subject path */
  subject: string;
  /** Event type identifier */
  type: string;
  /** Event payload data */
  data: any;
  /** Optional commit options */
  options?: CommitEventOptions;
}
