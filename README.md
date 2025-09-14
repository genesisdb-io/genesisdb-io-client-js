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

// Stream Events from lower bound
await client.streamEvents('/', {
  lowerBound: '2d6d4141-6107-4fb2-905f-445730f4f2a9',
  includeLowerBoundEvent: true
});

// Stream Events with latest by event type
await client.streamEvents('/', {
  latestByEventType: 'io.genesisdb.foo.foobarfoo-updated'
});

// This feature allows you to stream only the latest event of a specific type for each subject.
// Useful for getting the current state of entities.

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


// Usage of referenced data (GDPR)
await client.commitEvents([
  {
    source: 'io.genesisdb.app',
    subject: '/foo/21',
    type: 'io.genesisdb.app.foo-added',
    data: {
      value: 'Foo'
    },
    options: {
      storeDataAsReference: true
    }
  }
]);

// Deleting referenced data (GDPR)
await client.eraseData('/foo/21');

## Preconditions

Preconditions allow you to enforce certain checks on the server before committing events. Genesis DB supports multiple precondition types:

### isSubjectNew
Ensures that a subject is new (has no existing events):

```typescript
await client.commitEvents([
  {
    source: 'io.genesisdb.app',
    subject: '/foo/21',
    type: 'io.genesisdb.app.foo-added',
    data: { value: 'Foo' }
  }
], [
  {
    type: 'isSubjectNew',
    payload: {
      subject: '/foo/21'
    }
  }
]);
```

### isQueryResultTrue
Evaluates a query and ensures the result is truthy:

```typescript
await client.commitEvents([
  {
    source: 'io.genesisdb.app',
    subject: '/event/conf-2024',
    type: 'io.genesisdb.app.registration-added',
    data: { attendeeName: 'Alice', eventId: 'conf-2024' }
  }
], [
  {
    type: 'isQueryResultTrue',
    payload: {
      query: "FROM e IN events WHERE e.data.eventId == 'conf-2024' PROJECT INTO COUNT() < 500"
    }
  }
]);
```

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

// Observe Events from lower bound (Message queue)
for await (const event of client.observeEvents('/customer', {
  lowerBound: '2d6d4141-6107-4fb2-905f-445730f4f2a9',
  includeLowerBoundEvent: true
})) {
  console.log('Received event:', event)
}

// Query events using the query language
const results = await client.queryEvents('FROM e IN events WHERE e.type == "io.genesisdb.app.customer-added" ORDER BY e.time DESC TOP 20 PROJECT INTO { subject: e.subject, firstName: e.data.firstName }');
console.log('Query results:', results);

// Use the genesisdb client status methods
await client.audit();
await client.ping();

```

## License

MIT

## Author

E-Mail: mail@genesisdb.io
URL: http://www.genesisdb.io
