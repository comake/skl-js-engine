/* eslint-disable @typescript-eslint/no-floating-promises, no-console, @typescript-eslint/naming-convention */
import { Skql } from '@comake/skql-js-engine';
import { frameAndCombineSchemas } from './Util';

async function run(): Promise<void> {
  const schemas = [
    './src/assets/core.jsonld',
    './src/assets/get-ticketmaster-events.jsonld',
  ];
  const env = { TICKETMASTER_APIKEY: process.env.TICKETMASTER_APIKEY! };
  const schema = await frameAndCombineSchemas(schemas, env);
  const skql = new Skql({ schema });
  const eventsCollection = await skql.do.getEvents({
    account: 'https://skl.standard.storage/data/TicketmasterAccount1',
    city: 'Atlanta',
    pageSize: 20,
  });
  console.log(eventsCollection.records);
}

run();
