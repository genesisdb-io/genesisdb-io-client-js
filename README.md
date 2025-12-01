# JavaScript/TypeScript SDK

This is the official JS/TS SDK for GenesisDB, an awesome and production ready event store database system for building event-driven apps.

## GenesisDB Advantages

* Incredibly fast when reading, fast when writing 🚀
* Easy backup creation and recovery
* [CloudEvents](https://cloudevents.io/) compatible
* GDPR-ready
* Easily accessible via the HTTP interface
* Auditable. Guarantee database consistency
* Logging and metrics for Prometheus
* SQL like query language called GenesisDB Query Language (GDBQL)
* ...

## Installation

```bash
npm install genesisdb
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

// Initialize the GenesisDB client
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
  latestByEventType: 'io.genesisdb.app.customer-updated'
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

Preconditions allow you to enforce certain checks on the server before committing events. GenesisDB supports multiple precondition types:

### isSubjectNew
Ensures that a subject is new (has no existing events):

```typescript
await client.commitEvents([
  {
    source: 'io.genesisdb.app',
    subject: '/user/456',
    type: 'io.genesisdb.app.user-created',
    data: {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com'
    }
  }
], [
  {
    type: 'isSubjectNew',
    payload: {
      subject: '/user/456'
    }
  }
]);
```

### isSubjectExisting
Ensures that events exist for the specified subject:

```typescript
await client.commitEvents([
  {
    source: 'io.genesisdb.app',
    subject: '/user/456',
    type: 'io.genesisdb.app.user-created',
    data: {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com'
    }
  }
], [
  {
    type: 'isSubjectExisting',
    payload: {
      subject: '/user/456'
    }
  }
]);
```

### isQueryResultTrue
Evaluates a query and ensures the result is truthy. Supports the full GDBQL feature set including complex WHERE clauses, aggregations, and calculated fields.

**Basic uniqueness check:**
```typescript
await client.commitEvents([
  {
    source: 'io.genesisdb.app',
    subject: '/user/456',
    type: 'io.genesisdb.app.user-created',
    data: {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com'
    }
  }
], [
  {
    type: 'isQueryResultTrue',
    payload: {
      query: "STREAM e FROM events WHERE e.data.email == 'john.doe@example.com' MAP COUNT() == 0"
    }
  }
]);
```

**Business rule enforcement (transaction limits):**
```typescript
await client.commitEvents([
  {
    source: 'io.genesisdb.banking',
    subject: '/user/123/transactions',
    type: 'io.genesisdb.banking.transaction-processed',
    data: {
      amount: 500.00,
      currency: 'EUR'
    }
  }
], [
  {
    type: 'isQueryResultTrue',
    payload: {
      query: "STREAM e FROM events WHERE e.subject UNDER '/user/123' AND e.type == 'transaction-processed' AND e.time >= '2024-01-01T00:00:00Z' MAP SUM(e.data.amount) + 500 <= 10000"
    }
  }
]);
```

**Complex validation with aggregations:**
```typescript
await client.commitEvents([
  {
    source: 'io.genesisdb.events',
    subject: '/conference/2024/registrations',
    type: 'io.genesisdb.events.registration-created',
    data: {
      attendeeId: 'att-789',
      ticketType: 'premium'
    }
  }
], [
  {
    type: 'isQueryResultTrue',
    payload: {
      query: "STREAM e FROM events WHERE e.subject UNDER '/conference/2024/registrations' AND e.type == 'registration-created' GROUP BY e.data.ticketType HAVING e.data.ticketType == 'premium' MAP COUNT() < 50"
    }
  }
]);
```

**Supported GDBQL Features in Preconditions:**
- WHERE conditions with AND/OR/IN/BETWEEN operators
- Hierarchical subject queries (UNDER, DESCENDANTS)
- Aggregation functions (COUNT, SUM, AVG, MIN, MAX)
- GROUP BY with HAVING clauses
- ORDER BY and LIMIT clauses
- Calculated fields and expressions
- Nested field access (e.data.address.city)
- String concatenation and arithmetic operations

If a precondition fails, the commit returns HTTP 412 (Precondition Failed) with details about which condition failed.

## GDPR Compliance

### Store Data as Reference

```typescript
await client.commitEvents([
  {
    source: 'io.genesisdb.app',
    subject: '/user/456',
    type: 'io.genesisdb.app.user-created',
    data: {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com'
    },
    options: {
      storeDataAsReference: true
    }
  }
]);
```

### Delete Referenced Data

```typescript
await client.eraseData('/user/456');
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


### Observe Latest Events by Event Type (Message Queue)

```typescript
for await (const event of client.observeEvents('/customer', {
  latestByEventType: 'io.genesisdb.app.customer-updated'
})) {
  console.log('Received latest event:', event)
}
```

## Querying Events

```typescript
const results = await client.queryEvents('STREAM e FROM events WHERE e.type == "io.genesisdb.app.customer-added" ORDER BY e.time DESC LIMIT 20 MAP { subject: e.subject, firstName: e.data.firstName }');
console.log('Query results:', results);
```

## Health Checks

```typescript
// Check API status
const pingResponse = await client.ping();
console.log('Ping response:', pingResponse);

// Run audit to check event consistency
const auditResponse = await client.audit();
console.log('Audit response:', auditResponse);
```

## License

MIT

## Author

* E-Mail: mail@genesisdb.io
* URL: https://www.genesisdb.io
* Docs: https://docs.genesisdb.io
