/* eslint-disable @typescript-eslint/naming-convention */
import type { NodeObject } from 'jsonld';
import { Skql } from '../../src/Skql';
import { SCHEMA, SKL } from '../../src/util/Vocabularies';
import { describeIf, frameAndCombineSchemas } from '../util/Util';

const endpointUrl = 'http://localhost:9999/blazegraph/namespace/kb/sparql';

describeIf('docker', 'An Skql engine backed by a sparql query adapter', (): void => {
  it('can get events from ticketmaster.', async(): Promise<void> => {
    const schemas = [
      './test/assets/schemas/core.json',
      './test/assets/schemas/get-ticketmaster-events.json',
    ];
    const env = { TICKETMASTER_APIKEY: process.env.TICKETMASTER_APIKEY! };
    const schema = await frameAndCombineSchemas(schemas, env);

    const skql = new Skql({ type: 'sparql', endpointUrl });
    await skql.save(schema);
    const eventsCollection = await skql.do.getEvents({
      account: 'https://skl.standard.storage/data/TicketmasterAccount1',
      city: 'Atlanta',
      pageSize: 20,
    });
    expect(eventsCollection[SKL.records]).toBeInstanceOf(Array);
    expect((eventsCollection[SKL.records] as NodeObject[])[0]['@type']).toBe(SCHEMA.Event);
  });
});
