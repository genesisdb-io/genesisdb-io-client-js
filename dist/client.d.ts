import { CloudEvent } from 'cloudevents';
export declare class Client {
    private apiUrl;
    private apiVersion;
    private authToken;
    private checkRequiredEnv;
    constructor(config?: {
        apiUrl?: string;
        apiVersion?: string;
        authToken?: string;
    });
    streamEvents(subject: string): Promise<CloudEvent<unknown>[]>;
    /**
     * Commits events to the EventStore
     * @param events Array of events to commit
     * @example
     * ```typescript
     * await eventStore.commitEvents([
     *   {
     *     subject: '/user',  // For new resources
     *     type: 'added',
     *     data: { id: 123, name: 'John' }
     *   },
     *   {
     *     subject: '/user/123',  // For existing resources with UUID
     *     type: 'updated',
     *     data: { id: 123, name: 'John Smith' }
     *   }
     * ]);
     * ```
     */
    commitEvents(events: {
        subject: string;
        type: string;
        data: any;
    }[]): Promise<void>;
    audit(): Promise<string>;
    ping(): Promise<string>;
    q(query: string): Promise<any[]>;
    observeEvents(subject: string): AsyncGenerator<CloudEvent<unknown>, void, unknown>;
}
