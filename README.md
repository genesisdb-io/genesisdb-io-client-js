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

## Configuration

### Environment Variables
The following environment variables are required:
```
GENESISDB_AUTH_TOKEN=<secret>
GENESISDB_API_URL=http://localhost:8080
GENESISDB_API_VERSION=v1
```

### Basic Setup

```typescript
import { Client } from 'genesisdb';

// Initialize the Genesis DB client
const client = new Client();
```

## Streaming Events

### Basic Event Streaming

```typescript
// Stream all events for a subject
await client.streamEvents('/customer');
```

### Stream Events from Lower Bound

```typescript
await client.streamEvents('/', {
  lowerBound: '2d6d4141-6107-4fb2-905f-445730f4f2a9',
  includeLowerBoundEvent: true
});
```

### Stream Latest Events by Event Type

```typescript
await client.streamEvents('/', {
  latestByEventType: 'io.genesisdb.foo.foobarfoo-updated'
});
```

This feature allows you to stream only the latest event of a specific type for each subject. Useful for getting the current state of entities.

## Committing Events

### Basic Event Committing

```typescript
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
```

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
    data: {
      attendeeName: 'Alice',
      eventId: 'conf-2024'
    }
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

## GDPR Compliance

### Store Data as Reference

```typescript
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
```

### Delete Referenced Data

```typescript
await client.eraseData('/foo/21');
```

## Observing Events

### Basic Event Observation

```typescript
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
```

### Observe Events from Lower Bound (Message Queue)

```typescript
for await (const event of client.observeEvents('/customer', {
  lowerBound: '2d6d4141-6107-4fb2-905f-445730f4f2a9',
  includeLowerBoundEvent: true
})) {
  console.log('Received event:', event)
}
```

## Querying Events

```typescript
const results = await client.queryEvents('FROM e IN events WHERE e.type == "io.genesisdb.app.customer-added" ORDER BY e.time DESC TOP 20 PROJECT INTO { subject: e.subject, firstName: e.data.firstName }');
console.log('Query results:', results);
```

## Health Checks

```typescript
// Check API status
await client.ping();

// Run audit
await client.audit();
```

## License

MIT

## Author

* E-Mail: mail@genesisdb.io
* URL: https://www.genesisdb.io
* Docs: https://docs.genesisdb.io
