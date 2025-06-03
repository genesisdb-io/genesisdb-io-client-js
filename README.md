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
EVENTSTORE_AUTH_TOKEN=fkf1d4ce8598fc660fa9e813b0367d151aa4ba209a620c878ddec90fda198b2b
EVENTSTORE_TZ=Europe/Vienna
EVENTSTORE_EVENT_SPEC_VERSION=1.0
EVENTSTORE_SOURCE=io.genesisdb.<sourcename>
EVENTSTORE_MEMCACHE=true
EVENTSTORE_PROMETHEUS_METRICS=true
```

```typescript
import { Client } from 'genesisdb';

// Initialize the genesisdb client
const client = new Client();

// Use the genesisdb client methods
await client.streamEvents('/customer');

await client.commitEvents([
  {
    subject: '/customer',
    type: 'added',
    data: {
      firstName: 'Bruce',
      lastName: 'Wayne',
      emailAddress: 'bruce.wayne@enterprise.wayne'
    }
  },
  {
    subject: '/customer',
    type: 'added',
    data: {
      firstName: 'Alfred',
      lastName: 'Pennyworth',
      emailAddress: 'alfred.pennyworth@enterprise.wayne'
    }
  },
  {
    subject: '/customer/fed2902d-0135-460d-8605-263a06308448',
    type: 'personalDataChanged',
    data: {
      firstName: 'Angus',
      lastName: 'MacGyer',
      emailAddress: 'angus.macgyer@phoenix.foundation'
    }
  }
]);

// Use the genesisdb client status methods
await client.audit();
await client.ping();

```

## License

MIT

## Author

E-Mail: mail@genesisdb.io
URL: http://www.genesisdb.io
