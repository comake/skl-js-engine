/* eslint-disable @typescript-eslint/naming-convention */
import type { NodeObject } from 'jsonld';
import { Skql } from '../../src/Skql';
import { SCHEMA } from '../../src/util/Vocabularies';
import { describeIf, frameAndCombineSchemas } from '../util/Util';

describeIf('docker', 'An Skql engine backed by a memory query adapter', (): void => {
  it('can get events from ticketmaster.', async(): Promise<void> => {
    const schemas = [
      './test/assets/schemas/core.json',
      './test/assets/schemas/get-ticketmaster-events.json',
    ];
    const env = { TICKETMASTER_APIKEY: process.env.TICKETMASTER_APIKEY! };
    const schema = await frameAndCombineSchemas(schemas, env);
    const skql = new Skql({ schema });
    const eventsCollection = await skql.do.getEvents({
      account: 'https://skl.standard.storage/data/TicketmasterAccount1',
      city: 'Atlanta',
      pageSize: 20,
    });
    expect(eventsCollection.records).toBeInstanceOf(Array);
    expect((eventsCollection.records as NodeObject[])[0]['@type']).toBe(SCHEMA.Event);
  });
});
