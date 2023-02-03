/* eslint-disable
@typescript-eslint/no-floating-promises,
no-console,
@typescript-eslint/naming-convention,
no-process-env */
import { Skql, SKL } from '@comake/skql-js-engine';
import { frameAndCombineSchemas } from './Util';

async function run(): Promise<void> {
  const schemaFiles = [
    './src/assets/core.json',
    './src/assets/get-ticketmaster-events.json',
  ];
  const env = { TICKETMASTER_APIKEY: process.env.TICKETMASTER_APIKEY! };
  const schemas = await frameAndCombineSchemas(schemaFiles, env);
  const skql = new Skql({ type: 'memory', schemas });
  const eventsCollection = await skql.verb.getEvents({
    account: 'https://example.com/data/TicketmasterAccount1',
    city: 'Atlanta',
    pageSize: 20,
  });
  console.log(eventsCollection[SKL.records]);
}

run();
