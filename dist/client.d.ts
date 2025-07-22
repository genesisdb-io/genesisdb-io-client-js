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
    streamEvents(subject: string, options?: {
        lowerBound?: string;
        includeLowerBoundEvent?: boolean;
        latestByEventType?: string;
    }): Promise<CloudEvent<unknown>[]>;
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
     *     data: { value: 'Foo' },
     *     options: { storeDataAsReference: true }
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
        options?: {
            storeDataAsReference?: boolean;
        };
    }[], preconditions?: {
        type: string;
        payload: any;
    }[]): Promise<void>;
    /**
     * Erase data for a subject (GDPR compliance)
     * @param subject The subject to erase data for
     * @example
     * ```typescript
     * await client.eraseData('/foo/21');
     * ```
     */
    eraseData(subject: string): Promise<void>;
    audit(): Promise<string>;
    ping(): Promise<string>;
    q(query: string): Promise<any[]>;
    observeEvents(subject: string, options?: {
        lowerBound?: string;
        includeLowerBoundEvent?: boolean;
        latestByEventType?: string;
    }): AsyncGenerator<CloudEvent<unknown>, void, unknown>;
}
