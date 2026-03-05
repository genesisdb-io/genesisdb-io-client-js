import { CloudEvent } from 'cloudevents';
import { ClientConfig } from './config';
import { CommitEvent } from './events';
import { StreamOptions } from './stream-options';
import { Precondition } from './preconditions';
export declare class Client {
    private apiUrl;
    private apiVersion;
    private authToken;
    private checkRequiredEnv;
    constructor(config?: ClientConfig);
    streamEvents(subject: string, options?: StreamOptions): Promise<CloudEvent<unknown>[]>;
    /**
     * Commits events to GenesisDB
     * @param events Array of events to commit
     * @param preconditions Optional array of preconditions to check before committing.
     *   If a precondition fails, the server returns HTTP 412 (Precondition Failed).
     *
     * @example
     * ```typescript
     * // Basic commit
     * await client.commitEvents([
     *   {
     *     source: 'io.genesisdb.app',
     *     subject: '/customer',
     *     type: 'io.genesisdb.app.customer-added',
     *     data: {
     *       firstName: 'Bruce',
     *       lastName: 'Wayne',
     *       emailAddress: 'bruce.wayne@enterprise.wayne'
     *     }
     *   },
     *   {
     *     source: 'io.genesisdb.app',
     *     subject: '/customer',
     *     type: 'io.genesisdb.app.customer-added',
     *     data: {
     *       firstName: 'Alfred',
     *       lastName: 'Pennyworth',
     *       emailAddress: 'alfred.pennyworth@enterprise.wayne'
     *     }
     *   },
     *   {
     *     source: 'io.genesisdb.store',
     *     subject: '/article',
     *     type: 'io.genesisdb.store.article-added',
     *     data: {
     *       name: 'Tumbler',
     *       color: 'black',
     *       price: 2990000.00
     *     }
     *   }
     * ]);
     * ```
     *
     * @example
     * ```typescript
     * // Using isSubjectNew precondition
     * await client.commitEvents([
     *   {
     *     source: 'io.genesisdb.app',
     *     subject: '/user/456',
     *     type: 'io.genesisdb.app.user-created',
     *     data: {
     *       firstName: 'John',
     *       lastName: 'Doe',
     *       email: 'john.doe@example.com'
     *     }
     *   }
     * ], [
     *   {
     *     type: 'isSubjectNew',
     *     payload: { subject: '/user/456' }
     *   }
     * ]);
     * ```
     *
     * @example
     * ```typescript
     * // Using isSubjectExisting precondition
     * await client.commitEvents([
     *   {
     *     source: 'io.genesisdb.app',
     *     subject: '/user/456',
     *     type: 'io.genesisdb.app.user-created',
     *     data: {
     *       firstName: 'John',
     *       lastName: 'Doe',
     *       email: 'john.doe@example.com'
     *     }
     *   }
     * ], [
     *   {
     *     type: 'isSubjectExisting',
     *     payload: { subject: '/user/456' }
     *   }
     * ]);
     * ```
     *
     * @example
     * ```typescript
     * // Using isQueryResultTrue precondition
     * await client.commitEvents([
     *   {
     *     source: 'io.genesisdb.app',
     *     subject: '/user/456',
     *     type: 'io.genesisdb.app.user-created',
     *     data: {
     *       firstName: 'John',
     *       lastName: 'Doe',
     *       email: 'john.doe@example.com'
     *     }
     *   }
     * ], [
     *   {
     *     type: 'isQueryResultTrue',
     *     payload: {
     *       query: "STREAM e FROM events WHERE e.data.email == 'john.doe@example.com' MAP COUNT() == 0"
     *     }
     *   }
     * ]);
     * ```
     *
     * @example
     * ```typescript
     * // GDPR: Store data as reference
     * await client.commitEvents([
     *   {
     *     source: 'io.genesisdb.app',
     *     subject: '/user/456',
     *     type: 'io.genesisdb.app.user-created',
     *     data: {
     *       firstName: 'John',
     *       lastName: 'Doe',
     *       email: 'john.doe@example.com'
     *     },
     *     options: { storeDataAsReference: true }
     *   }
     * ]);
     * ```
     *
     */
    commitEvents(events: CommitEvent[], preconditions?: Precondition[]): Promise<void>;
    /**
     * Erase data for a subject (GDPR compliance)
     * @param subject The subject to erase data for
     * @example
     * ```typescript
     * await client.eraseData('/user/456');
     * ```
     */
    eraseData(subject: string): Promise<void>;
    audit(): Promise<string>;
    ping(): Promise<string>;
    q(query: string): Promise<any[]>;
    /**
     * Query events using the same functionality as the q method
     * @param query The query string to execute
     * @returns Promise<any[]> Array of query results
     * @example
     * ```typescript
     * const results = await client.queryEvents("STREAM e FROM events WHERE e.subject UNDER '/customer' ORDER BY e.time MAP { id: e.id, firstName: e.data.firstName }");
     * ```
     */
    queryEvents(query: string): Promise<any[]>;
    observeEvents(subject: string, options?: StreamOptions): AsyncGenerator<CloudEvent<unknown>, void, unknown>;
}
