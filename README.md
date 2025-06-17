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
