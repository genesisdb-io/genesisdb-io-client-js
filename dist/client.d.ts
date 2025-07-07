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
     * Commits events to Genesis DB
     * @param events Array of events to commit
     * @param preconditions Optional array of preconditions to check before committing
     * @example
     * ```typescript
     * await client.commitEvents([
     *   {
     *     source: 'io.genesisdb.app',
     *     subject: '/user',
     *     type: 'io.genesisdb.app.user-added',
     *     data: { name: 'John' }
     *   },
     *   {
     *     source: 'io.genesisdb.app',
     *     subject: '/user/6db0dbbe-218e-4518-b740-93b6e11e6190',
     *     type: 'io.genesisdb.app.user-updated',
     *     data: { name: 'John Smith' }
     *   }
     * ]);
     * ```
     * @example
     * ```typescript
     * await client.commitEvents([
     *   {
     *     source: 'io.genesisdb.app',
     *     subject: '/foo/21',
     *     type: 'io.genesisdb.app.foo-added',
     *     data: { value: 'Foo' }
     *   }
     * ], [
     *   {
     *     type: 'isSubjectNew',
     *     payload: {
     *       subject: '/foo/21'
     *     }
     *   }
     * ]);
     * ```
     */
    commitEvents(events: {
        source: string;
        subject: string;
        type: string;
        data: any;
    }[], preconditions?: {
        type: string;
        payload: any;
    }[]): Promise<void>;
    audit(): Promise<string>;
    ping(): Promise<string>;
    q(query: string): Promise<any[]>;
    observeEvents(subject: string): AsyncGenerator<CloudEvent<unknown>, void, unknown>;
}
