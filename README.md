# genesisdb

A TypeScript SDK for working with Genesis DB

## Installation

Using npm:
```bash
npm install genesisdb
```

Using yarn:
```bash
yarn add genesisdb
```

## Usage

### The following envvars are required
```
GENESISDB_AUTH_TOKEN=<secret>
GENESISDB_API_URL=http://localhost:8080
GENESISDB_API_VERSION=v1
```

```typescript
import { Client } from 'genesisdb';

// Initialize the genesisdb client
const client = new Client();

// Use the genesisdb client methods
await client.streamEvents('/customer');

await client.commitEvents([
  {
    source: 'io.genesisdb.app',
    subject: '/customer',
    type: 'io.genesisdb.app.customer-added',
    data: {
      firstName: 'Bruce',
      lastName: 'Wayne',
      emailAddress: 'bruce.wayne@enterprise.wayne'
    }
  },
  {
    source: 'io.genesisdb.app',
    subject: '/customer',
    type: 'io.genesisdb.app.customer-added',
    data: {
      firstName: 'Alfred',
      lastName: 'Pennyworth',
      emailAddress: 'alfred.pennyworth@enterprise.wayne'
    }
  },
  {
    source: 'io.genesisdb.store',
    subject: '/article',
    type: 'io.genesisdb.store.article-added',
    data: {
      name: 'Tumbler',
      color: 'black',
      price: 2990000.00
    }
  },
  {
    source: 'io.genesisdb.app',
    subject: '/customer/fed2902d-0135-460d-8605-263a06308448',
    type: 'io.genesisdb.app.customer-personaldata-changed',
    data: {
      firstName: 'Angus',
      lastName: 'MacGyver',
      emailAddress: 'angus.macgyer@phoenix.foundation'
    }
  }
]);

// Commit events with preconditions
await client.commitEvents([
  {
    source: 'io.genesisdb.app',
    subject: '/foo/21',
    type: 'io.genesisdb.app.foo-added',
    data: {
      value: 'Foo'
    }
  }
], [
  {
    type: 'isSubjectNew',
    payload: {
      subject: '/foo/21'
    }
  }
]);

const encoder = new TextEncoder()
const stream = new ReadableStream({
  async start(controller) {
    try {
      for await (const event of client.observeEvents('/customer')) {
        controller.enqueue(encoder.encode(JSON.stringify(event) + '\n'))
      }
    } catch (err) {
      console.error('Error:', err)
      controller.close()
    }
  }
})

// Use the genesisdb client status methods
await client.audit();
await client.ping();

```

## License

MIT

## Author

E-Mail: mail@genesisdb.io
URL: http://www.genesisdb.io
