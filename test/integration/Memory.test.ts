/* eslint-disable @typescript-eslint/naming-convention */
import type { OpenApiOperationExecutor } from '@comake/openapi-operation-executor';
import type { NodeObject } from 'jsonld';
import { SKLEngine } from '../../src/SklEngine';
import { SDO, SKL } from '../../src/util/Vocabularies';
import { describeIf, frameAndCombineSchemas } from '../util/Util';

let executeOperationSpy: any;
jest.mock('@comake/openapi-operation-executor', (): any => {
  const real = jest.requireActual('@comake/openapi-operation-executor');
  return {
    ...real,
    OpenApiOperationExecutor: jest.fn().mockImplementation((): OpenApiOperationExecutor => {
      const realExecutor = new real.OpenApiOperationExecutor();
      executeOperationSpy = jest.spyOn(realExecutor, 'executeOperation');
      return realExecutor;
    }),
  };
});

describeIf('docker', 'An SKL engine backed by a memory query adapter', (): void => {
  it('can get events from ticketmaster.', async(): Promise<void> => {
    const schemaFiles = [
      './test/assets/schemas/core.json',
      './test/assets/schemas/get-ticketmaster-events.json',
    ];
    const env = { TICKETMASTER_APIKEY: process.env.TICKETMASTER_APIKEY! };
    const schemas = await frameAndCombineSchemas(schemaFiles, env);
    const engine = new SKLEngine({ type: 'memory' });
    await engine.save(schemas);
    const eventsCollection = await engine.verb.getEvents<NodeObject>({
      account: 'https://example.com/data/TicketmasterAccount1',
      city: 'Atlanta',
      pageSize: 20,
    });
    expect(executeOperationSpy).toHaveBeenCalledTimes(1);
    expect(executeOperationSpy).toHaveBeenCalledWith(
      'SearchEvents',
      expect.objectContaining({
        apiKey: process.env.TICKETMASTER_APIKEY,
      }),
      {
        city: 'Atlanta',
        size: 20,
      },
    );
    expect(eventsCollection[SKL.records]).toBeInstanceOf(Array);
    expect((eventsCollection[SKL.records] as NodeObject[])[0]['@type']).toBe(SDO.Event);
  });
});
