import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { Client } from './client';

describe('Client Integration Tests', () => {
  let client: Client;

  beforeEach(() => {
    client = new Client({
      apiUrl: 'http://localhost:8080',
      apiVersion: 'v1',
      authToken: 'secret'
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

  it('should commit and stream customer events', async () => {
    const uniqueId = `integration-test-${Date.now()}`;
    const subject = `/customer/${uniqueId}`;

    // Commit customer events matching the documentation examples
    await client.commitEvents([
      {
        source: 'io.genesisdb.app',
        subject: subject,
        type: 'io.genesisdb.app.customer-added',
        data: {
          firstName: 'Bruce',
          lastName: 'Wayne',
          emailAddress: 'bruce.wayne@enterprise.wayne'
        }
      }
    ]);

    // Stream events back
    const events = await client.streamEvents(subject);
    assert.ok(Array.isArray(events));
    assert.ok(events.length >= 1, 'Should have at least one event');

    const customerEvent = events.find(e =>
      e.type === 'io.genesisdb.app.customer-added'
    );

    assert.ok(customerEvent, 'Customer event should be found');
    assert.strictEqual(customerEvent.data?.firstName, 'Bruce');
    assert.strictEqual(customerEvent.data?.lastName, 'Wayne');
    assert.strictEqual(customerEvent.data?.emailAddress, 'bruce.wayne@enterprise.wayne');
    console.log('Found customer event:', customerEvent.id);
  });

  it('should commit multiple events in a single commit', async () => {
    const uniqueId = `batch-test-${Date.now()}`;

    await client.commitEvents([
      {
        source: 'io.genesisdb.app',
        subject: `/customer/${uniqueId}`,
        type: 'io.genesisdb.app.customer-added',
        data: {
          firstName: 'Bruce',
          lastName: 'Wayne',
          emailAddress: 'bruce.wayne@enterprise.wayne'
        }
      },
      {
        source: 'io.genesisdb.app',
        subject: `/customer/${uniqueId}`,
        type: 'io.genesisdb.app.customer-added',
        data: {
          firstName: 'Alfred',
          lastName: 'Pennyworth',
          emailAddress: 'alfred.pennyworth@enterprise.wayne'
        }
      },
      {
        source: 'io.genesisdb.store',
        subject: `/article/${uniqueId}`,
        type: 'io.genesisdb.store.article-added',
        data: {
          name: 'Tumbler',
          color: 'black',
          price: 2990000.00
        }
      }
    ]);

    // Stream customer events
    const customerEvents = await client.streamEvents(`/customer/${uniqueId}`);
    assert.strictEqual(customerEvents.length, 2, 'Should have 2 customer events');

    // Stream article events
    const articleEvents = await client.streamEvents(`/article/${uniqueId}`);
    assert.strictEqual(articleEvents.length, 1, 'Should have 1 article event');
    assert.strictEqual(articleEvents[0].data?.name, 'Tumbler');
    assert.strictEqual(articleEvents[0].data?.price, 2990000.00);

    console.log('Batch commit: 2 customer events + 1 article event');
  });

  it('should commit events with personal data change', async () => {
    const uniqueId = `personaldata-test-${Date.now()}`;
    const subject = `/customer/${uniqueId}`;

    // First add a customer
    await client.commitEvents([
      {
        source: 'io.genesisdb.app',
        subject: subject,
        type: 'io.genesisdb.app.customer-added',
        data: {
          firstName: 'Bruce',
          lastName: 'Wayne',
          emailAddress: 'bruce.wayne@enterprise.wayne'
        }
      }
    ]);

    // Then change personal data
    await client.commitEvents([
      {
        source: 'io.genesisdb.app',
        subject: subject,
        type: 'io.genesisdb.app.customer-personaldata-changed',
        data: {
          firstName: 'Angus',
          lastName: 'MacGyver',
          emailAddress: 'angus.macgyer@phoenix.foundation'
        }
      }
    ]);

    const events = await client.streamEvents(subject);
    assert.strictEqual(events.length, 2, 'Should have 2 events');

    const changedEvent = events.find(e =>
      e.type === 'io.genesisdb.app.customer-personaldata-changed'
    );
    assert.ok(changedEvent, 'Personal data changed event should be found');
    assert.strictEqual(changedEvent.data?.firstName, 'Angus');
    assert.strictEqual(changedEvent.data?.lastName, 'MacGyver');

    console.log('Personal data change committed successfully');
  });

  it('should execute queries with GDBQL', async () => {
    const uniqueId = `query-test-${Date.now()}`;

    // Commit some events to query
    await client.commitEvents([
      {
        source: 'io.genesisdb.app',
        subject: `/customer/${uniqueId}`,
        type: 'io.genesisdb.app.customer-added',
        data: {
          firstName: 'Bruce',
          lastName: 'Wayne',
          emailAddress: 'bruce.wayne@enterprise.wayne'
        }
      },
      {
        source: 'io.genesisdb.app',
        subject: `/customer/${uniqueId}`,
        type: 'io.genesisdb.app.customer-added',
        data: {
          firstName: 'Alfred',
          lastName: 'Pennyworth',
          emailAddress: 'alfred.pennyworth@enterprise.wayne'
        }
      }
    ]);

    const results = await client.queryEvents(
      `STREAM e FROM events WHERE e.subject == '/customer/${uniqueId}' ORDER BY e.time MAP { id: e.id, firstName: e.data.firstName }`
    );

    assert.ok(Array.isArray(results));
    assert.strictEqual(results.length, 2, 'Should have 2 query results');
    assert.ok(results[0].id);
    assert.ok(results[0].firstName);
    console.log(`Query returned ${results.length} results:`, results.map(r => r.firstName));
  });

  it('should commit events with isSubjectNew precondition', async () => {
    const uniqueId = `precondition-new-${Date.now()}`;
    const subject = `/user/${uniqueId}`;

    // This should succeed since it's a new subject
    await client.commitEvents([
      {
        source: 'io.genesisdb.app',
        subject: subject,
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
        payload: { subject: subject }
      }
    ]);

    console.log('isSubjectNew precondition passed');

    // Committing again with isSubjectNew should fail (HTTP 412)
    await assert.rejects(
      async () => await client.commitEvents([
        {
          source: 'io.genesisdb.app',
          subject: subject,
          type: 'io.genesisdb.app.user-created',
          data: {
            firstName: 'Jane',
            lastName: 'Doe',
            email: 'jane.doe@example.com'
          }
        }
      ], [
        {
          type: 'isSubjectNew',
          payload: { subject: subject }
        }
      ]),
      /API Error/,
      'Second commit with isSubjectNew should fail'
    );

    console.log('isSubjectNew precondition correctly rejected duplicate');
  });

  it('should commit events with isSubjectExisting precondition', async () => {
    const uniqueId = `precondition-existing-${Date.now()}`;
    const subject = `/user/${uniqueId}`;

    // First create the subject
    await client.commitEvents([
      {
        source: 'io.genesisdb.app',
        subject: subject,
        type: 'io.genesisdb.app.user-created',
        data: {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john.doe@example.com'
        }
      }
    ]);

    // This should succeed since the subject now exists
    await client.commitEvents([
      {
        source: 'io.genesisdb.app',
        subject: subject,
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
        payload: { subject: subject }
      }
    ]);

    console.log('isSubjectExisting precondition passed');
  });

  it('should commit events with isQueryResultTrue precondition', async () => {
    const uniqueId = `precondition-query-${Date.now()}`;
    const subject = `/user/${uniqueId}`;

    // This should succeed since no events with this email exist yet
    await client.commitEvents([
      {
        source: 'io.genesisdb.app',
        subject: subject,
        type: 'io.genesisdb.app.user-created',
        data: {
          firstName: 'John',
          lastName: 'Doe',
          email: `john.doe.${uniqueId}@example.com`
        }
      }
    ], [
      {
        type: 'isQueryResultTrue',
        payload: {
          query: `STREAM e FROM events WHERE e.data.email == 'john.doe.${uniqueId}@example.com' MAP COUNT() == 0`
        }
      }
    ]);

    console.log('isQueryResultTrue precondition passed');
  });

  it('should stream events with lower and upper bounds', async () => {
    const uniqueId = `bounds-test-${Date.now()}`;
    const subject = `/customer/${uniqueId}`;

    // Commit 3 events
    await client.commitEvents([
      {
        source: 'io.genesisdb.app',
        subject: subject,
        type: 'io.genesisdb.app.customer-added',
        data: { firstName: 'Bruce', lastName: 'Wayne', emailAddress: 'bruce@wayne.com' }
      }
    ]);
    await client.commitEvents([
      {
        source: 'io.genesisdb.app',
        subject: subject,
        type: 'io.genesisdb.app.customer-added',
        data: { firstName: 'Alfred', lastName: 'Pennyworth', emailAddress: 'alfred@wayne.com' }
      }
    ]);
    await client.commitEvents([
      {
        source: 'io.genesisdb.app',
        subject: subject,
        type: 'io.genesisdb.app.customer-added',
        data: { firstName: 'Angus', lastName: 'MacGyver', emailAddress: 'angus@phoenix.foundation' }
      }
    ]);

    // Stream all events to get the IDs
    const allEvents = await client.streamEvents(subject);
    assert.strictEqual(allEvents.length, 3, 'Should have 3 events');

    // Stream from lower bound (skip the first event)
    const fromSecond = await client.streamEvents(subject, {
      lowerBound: allEvents[0].id!,
      includeLowerBoundEvent: false
    });
    assert.strictEqual(fromSecond.length, 2, 'Should have 2 events after lower bound');

    // Stream with upper bound (exclude the last event)
    const untilSecond = await client.streamEvents(subject, {
      upperBound: allEvents[2].id!,
      includeUpperBoundEvent: false
    });
    assert.strictEqual(untilSecond.length, 2, 'Should have 2 events before upper bound');

    // Stream with both bounds
    const middle = await client.streamEvents(subject, {
      lowerBound: allEvents[0].id!,
      includeLowerBoundEvent: false,
      upperBound: allEvents[2].id!,
      includeUpperBoundEvent: false
    });
    assert.strictEqual(middle.length, 1, 'Should have 1 event in the middle');
    assert.strictEqual(middle[0].data?.firstName, 'Alfred');

    console.log('Bound streaming works correctly');
  });

  it('should store data as reference and erase it (GDPR)', async () => {
    const uniqueId = `gdpr-test-${Date.now()}`;
    const subject = `/user/${uniqueId}`;

    // Commit with storeDataAsReference
    await client.commitEvents([
      {
        source: 'io.genesisdb.app',
        subject: subject,
        type: 'io.genesisdb.app.user-created',
        data: {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john.doe@example.com'
        },
        options: { storeDataAsReference: true }
      }
    ]);

    // Verify event was committed
    const eventsBefore = await client.streamEvents(subject);
    assert.strictEqual(eventsBefore.length, 1, 'Should have 1 event');
    assert.strictEqual(eventsBefore[0].data?.firstName, 'John');

    // Erase referenced data
    await client.eraseData(subject);

    // Verify data is erased — the event still exists but data fields should be emptied
    const eventsAfter = await client.streamEvents(subject);
    assert.strictEqual(eventsAfter.length, 1, 'Event should still exist');

    const erasedData = eventsAfter[0].data as any;
    assert.strictEqual(erasedData.firstName, '', 'firstName should be erased');
    assert.strictEqual(erasedData.lastName, '', 'lastName should be erased');
    assert.strictEqual(erasedData.email, '', 'email should be erased');

    console.log('GDPR erase completed successfully');
  });

  it('should observe events', async () => {
    const uniqueId = `observe-test-${Date.now()}`;
    const subject = `/customer/${uniqueId}`;

    // Commit an event first so the observer has something to receive
    await client.commitEvents([
      {
        source: 'io.genesisdb.app',
        subject: subject,
        type: 'io.genesisdb.app.customer-added',
        data: {
          firstName: 'Bruce',
          lastName: 'Wayne',
          emailAddress: 'bruce.wayne@enterprise.wayne'
        }
      }
    ]);

    // Observe with lowerBound to pick up the existing event, then stop
    const events = await client.streamEvents(subject);
    const firstEventId = events[0].id!;

    const generator = client.observeEvents(subject, {
      lowerBound: firstEventId,
      includeLowerBoundEvent: true
    });

    const received = [];
    for await (const event of generator) {
      received.push(event);
      // Got our event, stop observing
      break;
    }

    assert.strictEqual(received.length, 1);
    assert.strictEqual(received[0].data?.firstName, 'Bruce');
    console.log('Observe received event:', received[0].id);
  });
});
