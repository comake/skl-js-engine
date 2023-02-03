/* eslint-disable
@typescript-eslint/no-floating-promises,
no-console,
@typescript-eslint/naming-convention,
no-process-env */
import { SKLEngine, SKL } from '@comake/skl-js-engine';
import { frameAndCombineSchemas } from './Util';

async function run(): Promise<void> {
  const schemaFiles = [
    './src/assets/core.json',
    './src/assets/get-ticketmaster-events.json',
  ];
  const env = { TICKETMASTER_APIKEY: process.env.TICKETMASTER_APIKEY! };
  const schemas = await frameAndCombineSchemas(schemaFiles, env);
  const engine = new SKLEngine({ type: 'memory', schemas });
  const eventsCollection = await engine.verb.getEvents({
    account: 'https://example.com/data/TicketmasterAccount1',
    city: 'Atlanta',
    pageSize: 20,
  });
  console.log(eventsCollection[SKL.records]);
}

run();
