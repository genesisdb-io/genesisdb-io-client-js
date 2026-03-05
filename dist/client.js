"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Client = void 0;
const cloudevents_1 = require("cloudevents");
class Client {
    checkRequiredEnv() {
        const requiredEnvVars = [
            'GENESISDB_API_URL',
            'GENESISDB_API_VERSION',
            'GENESISDB_AUTH_TOKEN',
        ];
        const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
        if (missingEnvVars.length > 0) {
            console.error('Missing required environment variables:', missingEnvVars.join(', '));
            throw new Error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
        }
    }
    constructor(config) {
        if (config) {
            const envApiUrl = process.env.GENESISDB_API_URL;
            const envApiVersion = process.env.GENESISDB_API_VERSION;
            const envAuthToken = process.env.GENESISDB_AUTH_TOKEN;
            this.apiUrl = config.apiUrl || envApiUrl || '';
            this.apiVersion = config.apiVersion || envApiVersion || '';
            this.authToken = config.authToken || envAuthToken || '';
            if (!this.apiUrl || !this.apiVersion || !this.authToken) {
                this.checkRequiredEnv();
                this.apiUrl = process.env.GENESISDB_API_URL;
                this.apiVersion = process.env.GENESISDB_API_VERSION;
                this.authToken = process.env.GENESISDB_AUTH_TOKEN;
            }
        }
        else {
            this.checkRequiredEnv();
            this.apiUrl = process.env.GENESISDB_API_URL;
            this.apiVersion = process.env.GENESISDB_API_VERSION;
            this.authToken = process.env.GENESISDB_AUTH_TOKEN;
        }
    }
    async streamEvents(subject, options) {
        const url = `${this.apiUrl}/api/${this.apiVersion}/stream`;
        const requestBody = { subject: subject };
        if (options) {
            requestBody.options = options;
        }
        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: {
                    Authorization: 'Bearer ' + this.authToken,
                    'Content-Type': 'application/json',
                    Accept: 'application/x-ndjson',
                    'User-Agent': 'genesisdb-sdk',
                },
                body: JSON.stringify(requestBody),
            });
            if (!res.ok) {
                console.error('API Error:', {
                    status: res.status,
                    statusText: res.statusText,
                    headers: Object.fromEntries(res.headers)
                });
                throw new Error(`API Error: ${res.status} ${res.statusText}`);
            }
            const rawText = await res.text();
            if (!rawText || rawText.trim() === '') {
                return [];
            }
            const stream = new ReadableStream({
                start(controller) {
                    controller.enqueue(new TextEncoder().encode(rawText));
                    controller.close();
                }
            });
            const reader = stream.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            const events = [];
            while (true) {
                const { done, value } = await reader.read();
                if (done)
                    break;
                buffer += decoder.decode(value, { stream: true });
                let newlineIndex;
                while ((newlineIndex = buffer.indexOf('\n')) >= 0) {
                    const line = buffer.slice(0, newlineIndex).trim();
                    buffer = buffer.slice(newlineIndex + 1);
                    if (!line)
                        continue;
                    try {
                        const json = JSON.parse(line);
                        const event = new cloudevents_1.CloudEvent(json);
                        events.push(event);
                    }
                    catch (err) {
                        console.error('Error while parsing event:', err);
                        console.error('Problem with JSON:', line);
                    }
                }
            }
            return events;
        }
        catch (error) {
            console.error('Error while streaming events:', error);
            throw error;
        }
    }
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
    async commitEvents(events, preconditions) {
        const url = `${this.apiUrl}/api/${this.apiVersion}/commit`;
        const requestBody = {
            events: events.map(event => {
                const eventData = {
                    source: event.source,
                    subject: event.subject,
                    type: event.type,
                    data: event.data
                };
                if (event.options) {
                    eventData.options = event.options;
                }
                return eventData;
            })
        };
        if (preconditions && preconditions.length > 0) {
            requestBody.preconditions = preconditions;
        }
        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: {
                    Authorization: 'Bearer ' + this.authToken,
                    'Content-Type': 'application/json',
                    'User-Agent': 'genesisdb-sdk',
                },
                body: JSON.stringify(requestBody),
            });
            if (!res.ok) {
                console.error('API Error:', {
                    status: res.status,
                    statusText: res.statusText,
                    headers: Object.fromEntries(res.headers)
                });
                throw new Error(`API Error: ${res.status} ${res.statusText}`);
            }
        }
        catch (error) {
            console.error('Error while committing events:', error);
            throw error;
        }
    }
    /**
     * Erase data for a subject (GDPR compliance)
     * @param subject The subject to erase data for
     * @example
     * ```typescript
     * await client.eraseData('/user/456');
     * ```
     */
    async eraseData(subject) {
        const url = `${this.apiUrl}/api/${this.apiVersion}/erase`;
        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: {
                    Authorization: 'Bearer ' + this.authToken,
                    'Content-Type': 'application/json',
                    'User-Agent': 'genesisdb-sdk',
                },
                body: JSON.stringify({ subject }),
            });
            if (!res.ok) {
                console.error('API Error:', {
                    status: res.status,
                    statusText: res.statusText,
                    headers: Object.fromEntries(res.headers)
                });
                throw new Error(`API Error: ${res.status} ${res.statusText}`);
            }
        }
        catch (error) {
            console.error('Error while erasing data:', error);
            throw error;
        }
    }
    async audit() {
        const url = `${this.apiUrl}/api/${this.apiVersion}/status/audit`;
        try {
            const res = await fetch(url, {
                method: 'GET',
                headers: {
                    Authorization: 'Bearer ' + this.authToken,
                    'Content-Type': 'text/plain',
                    'User-Agent': 'genesisdb-sdk',
                }
            });
            if (!res.ok) {
                console.error('API Error:', {
                    status: res.status,
                    statusText: res.statusText,
                    headers: Object.fromEntries(res.headers)
                });
                throw new Error(`API Error: ${res.status} ${res.statusText}`);
            }
            return await res.text();
        }
        catch (error) {
            console.error('Error while running audit:', error);
            throw error;
        }
    }
    async ping() {
        const url = `${this.apiUrl}/api/${this.apiVersion}/status/ping`;
        try {
            const res = await fetch(url, {
                method: 'GET',
                headers: {
                    Authorization: 'Bearer ' + this.authToken,
                    'Content-Type': 'text/plain',
                    'User-Agent': 'genesisdb-sdk',
                }
            });
            if (!res.ok) {
                console.error('API Error:', {
                    status: res.status,
                    statusText: res.statusText,
                    headers: Object.fromEntries(res.headers)
                });
                throw new Error(`API Error: ${res.status} ${res.statusText}`);
            }
            return await res.text();
        }
        catch (error) {
            console.error('Error while pinging:', error);
            throw error;
        }
    }
    async q(query) {
        const url = `${this.apiUrl}/api/${this.apiVersion}/q`;
        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: {
                    Authorization: 'Bearer ' + this.authToken,
                    'Content-Type': 'application/json',
                    Accept: 'application/x-ndjson',
                    'User-Agent': 'genesisdb-sdk',
                },
                body: JSON.stringify({ query })
            });
            if (!res.ok) {
                console.error('API Error:', {
                    status: res.status,
                    statusText: res.statusText,
                    headers: Object.fromEntries(res.headers)
                });
                throw new Error(`API Error: ${res.status} ${res.statusText}`);
            }
            const rawText = await res.text();
            if (!rawText || rawText.trim() === '') {
                return [];
            }
            const stream = new ReadableStream({
                start(controller) {
                    controller.enqueue(new TextEncoder().encode(rawText));
                    controller.close();
                }
            });
            const reader = stream.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            const results = [];
            while (true) {
                const { done, value } = await reader.read();
                if (done)
                    break;
                buffer += decoder.decode(value, { stream: true });
                let newlineIndex;
                while ((newlineIndex = buffer.indexOf('\n')) >= 0) {
                    const line = buffer.slice(0, newlineIndex).trim();
                    buffer = buffer.slice(newlineIndex + 1);
                    if (!line)
                        continue;
                    try {
                        const json = JSON.parse(line);
                        results.push(json);
                    }
                    catch (err) {
                        console.error('Error while parsing result:', err);
                        console.error('Problem with JSON:', line);
                    }
                }
            }
            return results;
        }
        catch (error) {
            console.error('Error while querying:', error);
            throw error;
        }
    }
    /**
     * Query events using the same functionality as the q method
     * @param query The query string to execute
     * @returns Promise<any[]> Array of query results
     * @example
     * ```typescript
     * const results = await client.queryEvents("STREAM e FROM events WHERE e.subject UNDER '/customer' ORDER BY e.time MAP { id: e.id, firstName: e.data.firstName }");
     * ```
     */
    async queryEvents(query) {
        return this.q(query);
    }
    async *observeEvents(subject, options) {
        const url = `${this.apiUrl}/api/${this.apiVersion}/observe`;
        const requestBody = { subject: subject };
        if (options) {
            requestBody.options = options;
        }
        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: {
                    Authorization: 'Bearer ' + this.authToken,
                    'Content-Type': 'application/json',
                    Accept: 'application/x-ndjson',
                    'User-Agent': 'genesisdb-sdk',
                },
                body: JSON.stringify(requestBody),
            });
            if (!res.ok) {
                console.error('API Error:', {
                    status: res.status,
                    statusText: res.statusText,
                    headers: Object.fromEntries(res.headers)
                });
                throw new Error(`API Error: ${res.status} ${res.statusText}`);
            }
            if (!res.body) {
                throw new Error('Response body is null');
            }
            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) {
                        break;
                    }
                    buffer += decoder.decode(value, { stream: true });
                    let newlineIndex;
                    while ((newlineIndex = buffer.indexOf('\n')) >= 0) {
                        const line = buffer.slice(0, newlineIndex).trim();
                        buffer = buffer.slice(newlineIndex + 1);
                        if (!line)
                            continue;
                        try {
                            const jsonStr = line.startsWith('data: ') ? line.slice(6) : line;
                            const json = JSON.parse(jsonStr);
                            if (json.payload === '' && Object.keys(json).length === 1) {
                                continue;
                            }
                            const event = new cloudevents_1.CloudEvent(json);
                            yield event;
                        }
                        catch (err) {
                            console.error('Error while parsing event:', err);
                            console.error('Problem with JSON:', line);
                        }
                    }
                }
            }
            finally {
                reader.cancel();
            }
        }
        catch (error) {
            console.error('Error while observing events:', error);
            throw error;
        }
    }
}
exports.Client = Client;
