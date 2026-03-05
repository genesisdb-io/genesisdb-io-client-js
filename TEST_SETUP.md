# GenesisDB JavaScript Client Test Setup

## Overview

The tests use Node.js built-in test runner (Node 18+) with TypeScript support via `tsx`. Tests can run in two modes:

1. **Unit Tests** - Use mocked HTTP responses (no server required)
2. **Integration Tests** - Use real GenesisDB server (requires environment configuration)

## Requirements

- Node.js 18 or higher (for built-in test runner)
- `tsx` package for TypeScript execution

## Installation

Install tsx as a dev dependency:

```bash
npm install --save-dev tsx
# or
yarn add -D tsx
```

## Environment Configuration

### Using .env File

Copy the example environment file and configure it:

```bash
cp .env.example .env
```

Edit `.env` with your GenesisDB server details:

```bash
# GenesisDB API URL (without trailing slash)
TEST_GENESISDB_API_URL=http://localhost:8080

# GenesisDB API Version
TEST_GENESISDB_API_VERSION=v1

# GenesisDB Authentication Token
TEST_GENESISDB_AUTH_TOKEN=your-secret-token-here
```

### Using Environment Variables

Alternatively, set environment variables directly:

```bash
export TEST_GENESISDB_API_URL=http://localhost:8080
export TEST_GENESISDB_API_VERSION=v1
export TEST_GENESISDB_AUTH_TOKEN=your-secret-token
```

## Running Tests

### Unit Tests (Mocked - No Server Required)

```bash
# Run unit tests with mocks
node --test --import tsx src/client.test.ts

# With watch mode
node --test --watch --import tsx src/client.test.ts

# With coverage (Node 19.7+)
node --test --experimental-test-coverage --import tsx src/client.test.ts
```

### Integration Tests (Real Server Required)

```bash
# Load .env file and run integration tests
node -r ./load-env.js --test --import tsx src/client.integration.test.ts

# Or set env vars and run directly
TEST_GENESISDB_API_URL=http://localhost:8080 \
TEST_GENESISDB_API_VERSION=v1 \
TEST_GENESISDB_AUTH_TOKEN=secret \
node --test --import tsx src/client.integration.test.ts
```

### All Tests

```bash
# Run all tests (unit + integration if configured)
node -r ./load-env.js --test --import tsx "./src/**/*.test.ts"
```

## Package.json Scripts

Add these scripts to your package.json:

```json
{
  "scripts": {
    "test": "node --test --import tsx \"./src/**/*.test.ts\"",
    "test:unit": "node --test --import tsx src/client.test.ts",
    "test:integration": "node -r ./load-env.js --test --import tsx src/client.integration.test.ts",
    "test:watch": "node --test --watch --import tsx \"./src/**/*.test.ts\"",
    "test:coverage": "node --test --experimental-test-coverage --import tsx \"./src/**/*.test.ts\""
  },
  "devDependencies": {
    "tsx": "^4.0.0"
  }
}
```

## Test Types

### Unit Tests (`client.test.ts`)
- **Mock-based** - No external dependencies
- Tests all client methods with simulated responses
- Fast execution
- Always available

**Coverage:**
- Constructor validation and configuration
- All API methods (ping, audit, commitEvents, streamEvents, etc.)
- Error handling and edge cases
- JSON parsing and CloudEvent creation

### Integration Tests (`client.integration.test.ts`)
- **Real server** - Requires running GenesisDB instance
- Tests actual API communication
- Validates end-to-end functionality
- Only runs when environment variables are configured

**Coverage:**
- Server connectivity (ping, audit)
- Event lifecycle (commit → stream → query)
- Precondition handling
- Real-time event observation

## Test Behavior

- **Missing env vars**: Integration tests are automatically skipped, unit tests run with mocks
- **Configured env vars**: Both unit and integration tests run
- **Environment loading**: The `load-env.js` script automatically loads `.env` file if present

## Debugging Tests

### Run specific test suite
```bash
node --test --import tsx src/client.test.ts --test-name-pattern="streamEvents"
```

### Run with Node inspector
```bash
node --inspect --test --import tsx src/client.test.ts
```

### Verbose output
```bash
node --test --test-reporter=spec --import tsx "./src/**/*.test.ts"
```

## CI/CD Integration

For GitHub Actions or other CI systems:

```yaml
- name: Install dependencies
  run: npm install

- name: Run Unit Tests
  run: npm run test:unit

- name: Run Integration Tests (if server available)
  run: npm run test:integration
  env:
    TEST_GENESISDB_API_URL: http://localhost:8080
    TEST_GENESISDB_API_VERSION: v1
    TEST_GENESISDB_AUTH_TOKEN: ${{ secrets.GENESISDB_TOKEN }}
```

## Advantages of This Setup

1. **Dual Mode Testing** - Both mocked and real server testing
2. **Zero Dependencies** - Only requires `tsx` for TypeScript execution
3. **Native Test Runner** - Uses Node.js built-in test runner
4. **Automatic Configuration** - Falls back to mocks if no server configured
5. **Environment Flexible** - Supports .env files or direct environment variables
6. **Fast Unit Tests** - Mocked tests run instantly
7. **Real Integration Tests** - Validates actual server communication
8. **Type Safety** - Full TypeScript benefits in tests
