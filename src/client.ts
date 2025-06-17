import { CloudEvent } from 'cloudevents';

export class Client {
  private apiUrl: string;
  private apiVersion: string;
  private authToken: string;

  private checkRequiredEnv() {
    const requiredEnvVars = [
      'GENESISDB_API_URL',
      'GENESISDB_API_VERSION',
      'GENESISDB_AUTH_TOKEN',
    ];

    const missingEnvVars = requiredEnvVars.filter(
      envVar => !process.env[envVar]
    );

    if (missingEnvVars.length > 0) {
      console.error('Missing required environment variables:', missingEnvVars.join(', '));
      throw new Error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
    }
  }

  constructor(config?: {
    apiUrl?: string,
    apiVersion?: string,
    authToken?: string
  }) {
    if (config) {
      const envApiUrl = process.env.GENESISDB_API_URL;
      const envApiVersion = process.env.GENESISDB_API_VERSION;
      const envAuthToken = process.env.GENESISDB_AUTH_TOKEN;

      this.apiUrl = config.apiUrl || envApiUrl || '';
      this.apiVersion = config.apiVersion || envApiVersion || '';
      this.authToken = config.authToken || envAuthToken || '';

      if (!this.apiUrl || !this.apiVersion || !this.authToken) {
        this.checkRequiredEnv();
        this.apiUrl = process.env.GENESISDB_API_URL!;
        this.apiVersion = process.env.GENESISDB_API_VERSION!;
        this.authToken = process.env.GENESISDB_AUTH_TOKEN!;
      }
    } else {
      this.checkRequiredEnv();
      this.apiUrl = process.env.GENESISDB_API_URL!;
      this.apiVersion = process.env.GENESISDB_API_VERSION!;
      this.authToken = process.env.GENESISDB_AUTH_TOKEN!;
    }
  }

  async streamEvents(subject: string) {
    const url = `${this.apiUrl}/api/${this.apiVersion}/stream`;

    const requestBody = { subject: subject };

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

      // Log the raw response text first
      const rawText = await res.text();

      if (!rawText || rawText.trim() === '') {
        console.log('No events found for subject:', subject);
        return [];
      }

      // Create a new ReadableStream from the text
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(rawText));
          controller.close();
        }
      });

      const reader = stream.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      const events: CloudEvent<unknown>[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        let newlineIndex;
        while ((newlineIndex = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, newlineIndex).trim();
          buffer = buffer.slice(newlineIndex + 1);

          if (!line) continue;

          try {
            const json = JSON.parse(line);
            const event = new CloudEvent(json);
            events.push(event);
          } catch (err) {
            console.error('Error while parsing event:', err);
            console.error('Problem with JSON:', line);
          }
        }
      }
      return events;

    } catch (error) {
      console.error('Error while streaming events:', error);
      throw error;
    }
  }

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
  async commitEvents(events: { subject: string, type: string, data: any }[]) {
    const url = `${this.apiUrl}/api/${this.apiVersion}/commit`;

    const requestBody = {
      events: events.map(event => ({
        subject: event.subject,
        type: event.type,
        data: event.data
      }))
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
    } catch (error) {
      console.error('Error while committing events:', error);
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
    } catch (error) {
      console.error('Error while running audit:', error);
      throw error;
    }
  }

  async ping(): Promise<string> {
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
    } catch (error) {
      console.error('Error while pinging:', error);
      throw error;
    }
  }

  async q(query: string): Promise<any[]> {
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
      const results: any[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        let newlineIndex;
        while ((newlineIndex = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, newlineIndex).trim();
          buffer = buffer.slice(newlineIndex + 1);

          if (!line) continue;

          try {
            const json = JSON.parse(line);
            results.push(json);
          } catch (err) {
            console.error('Error while parsing result:', err);
            console.error('Problem with JSON:', line);
          }
        }
      }
      return results;

    } catch (error) {
      console.error('Error while querying:', error);
      throw error;
    }
  }

  async *observeEvents(subject: string): AsyncGenerator<CloudEvent<unknown>, void, unknown> {
    const url = `${this.apiUrl}/api/${this.apiVersion}/observe`;

    const requestBody = { subject: subject };

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + this.authToken,
          'Content-Type': 'application/json',
          Accept: 'application/x-ndjson',
          'User-Agent': 'inoovum-eventstore-sdk',
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

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          // If the stream ends, we'll break the loop
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        let newlineIndex;

        while ((newlineIndex = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, newlineIndex).trim();
          buffer = buffer.slice(newlineIndex + 1);

          if (!line) continue;

          try {
            const jsonStr = line.startsWith('data: ') ? line.slice(6) : line;
            const json = JSON.parse(jsonStr);
            console.log('Parsed JSON:', json);
            const event = new CloudEvent(json);
            console.log('Created CloudEvent:', event);
            yield event;
          } catch (err) {
            console.error('Error while parsing event:', err);
            console.error('Problem with JSON:', line);
          }
        }
      }
    } catch (error) {
      console.error('Error while observing events:', error);
      throw error;
    }
  }

}
