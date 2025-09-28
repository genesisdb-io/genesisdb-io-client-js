import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { Client } from './client';
import { getTestConfig } from './test-config';

const testConfig = getTestConfig();

// Only run integration tests if we have real environment variables
const describeIntegration = testConfig.useMocks ? describe.skip : describe;

describeIntegration('Client Integration Tests', () => {
  let client: Client;

  beforeEach(() => {
    client = new Client({
      apiUrl: testConfig.apiUrl,
      apiVersion: testConfig.apiVersion,
      authToken: testConfig.authToken
    });
  });

  it('should ping the server successfully', async () => {
    const response = await client.ping();
    assert.ok(response);
    assert.ok(typeof response === 'string');
    console.log('Ping response:', response);
  });

  it('should get audit information', async () => {
    const response = await client.audit();
    assert.ok(response);
    assert.ok(typeof response === 'string');
    console.log('Audit response:', response.substring(0, 100) + '...');
  });

  it('should commit and stream events', async () => {
    const uniqueId = `integration-test-${Date.now()}`;
    const subject = `/test/integration/${uniqueId}`;

    // Commit an event
    await client.commitEvents([
      {
        source: 'io.genesisdb.test.integration',
        subject: subject,
        type: 'io.genesisdb.test.integration.created',
        data: {
          message: 'Integration test event',
          uniqueId: uniqueId,
          timestamp: Date.now()
        }
      }
    ]);

    // Small delay to ensure event is committed
    await new Promise(resolve => setTimeout(resolve, 100));

    // Stream events back
    const events = await client.streamEvents(subject);
    assert.ok(Array.isArray(events));

    const testEvent = events.find(e =>
      e.type === 'io.genesisdb.test.integration.created' &&
      e.data?.uniqueId === uniqueId
    );

    assert.ok(testEvent, 'Integration test event should be found');
    console.log('Found integration test event:', testEvent.id);
  });

  it('should execute queries', async () => {
    const query = `
      FROM e IN events
      WHERE e.source == 'io.genesisdb.test.integration'
      ORDER BY e.time DESC
      TOP 5
      PROJECT INTO { id: e.id, type: e.type, subject: e.subject }
    `;

    const results = await client.q(query);
    assert.ok(Array.isArray(results));
    console.log(`Query returned ${results.length} results`);

    if (results.length > 0) {
      assert.ok(results[0].id);
      assert.ok(results[0].type);
      assert.ok(results[0].subject);
    }
  });

  it('should commit events with preconditions', async () => {
    const uniqueId = `precondition-test-${Date.now()}`;
    const subject = `/test/precondition/${uniqueId}`;

    // This should succeed since it's a new subject
    await client.commitEvents([
      {
        source: 'io.genesisdb.test.precondition',
        subject: subject,
        type: 'io.genesisdb.test.precondition.created',
        data: {
          message: 'Precondition test event',
          uniqueId: uniqueId
        }
      }
    ], [
      {
        type: 'isSubjectNew',
        payload: { subject: subject }
      }
    ]);

    console.log('Successfully committed event with isSubjectNew precondition');
  });

  it('should handle observe events (basic test)', async () => {
    const subject = '/test/observe';
    const generator = client.observeEvents(subject);

    // Just test that the generator starts without error
    // In a real scenario, this would observe live events
    const iterator = generator[Symbol.asyncIterator]();

    // Set a timeout to avoid hanging
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Observe timeout')), 2000);
    });

    try {
      await Promise.race([
        iterator.next(),
        timeoutPromise
      ]);
    } catch (error: any) {
      if (error.message === 'Observe timeout') {
        console.log('Observe test completed (timeout expected for empty stream)');
      } else {
        throw error;
      }
    }
  });
});