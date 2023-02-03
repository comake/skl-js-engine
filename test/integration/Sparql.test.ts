/* eslint-disable unicorn/expiring-todo-comments */
/* eslint-disable @typescript-eslint/naming-convention */
import type { NodeObject, ValueObject } from 'jsonld';
import { Skql } from '../../src/Skql';
import { In } from '../../src/storage/operator/In';
import type { Entity } from '../../src/util/Types';
import { SCHEMA, SKL, OWL, RDFS } from '../../src/util/Vocabularies';
import { describeIf, frameAndCombineSchemas } from '../util/Util';

const endpointUrl = 'http://localhost:9999/blazegraph/namespace/kb/sparql';

describeIf('docker', 'An Skql engine backed by a sparql query adapter', (): void => {
  let skql: Skql;
  let schema: Entity[];

  beforeAll(async(): Promise<void> => {
    const schemas = [
      './test/assets/schemas/core.json',
      './test/assets/schemas/get-ticketmaster-events.json',
    ];
    const env = { TICKETMASTER_APIKEY: process.env.TICKETMASTER_APIKEY! };
    schema = await frameAndCombineSchemas(schemas, env);
    skql = new Skql({ type: 'sparql', endpointUrl });
    await skql.destroyAll();
  });

  afterAll(async(): Promise<void> => {
    await skql.destroyAll();
  });

  it('can save entities.', async(): Promise<void> => {
    await skql.save(schema);
    const savedSchemasCount = await skql.count();
    expect(savedSchemasCount).toBe(schema.length);
  });

  it('can get events from ticketmaster.', async(): Promise<void> => {
    const eventsCollection = await skql.verb.getEvents({
      account: 'https://example.com/data/TicketmasterAccount1',
      city: 'Atlanta',
      pageSize: 20,
    });
    expect(eventsCollection[SKL.records]).toBeInstanceOf(Array);
    expect((eventsCollection[SKL.records] as NodeObject[])[0]['@type']).toBe(SCHEMA.Event);
  });

  it('can find one entity.', async(): Promise<void> => {
    const accessTokenProperty = await skql.find({
      where: {
        type: OWL.ObjectProperty,
      },
      order: {
        [RDFS.label]: 'asc',
      },
    });
    expect(accessTokenProperty).toBeDefined();
    expect((accessTokenProperty[RDFS.label] as ValueObject)['@value']).toBe('accessToken');
  });

  it('can find many entities.', async(): Promise<void> => {
    const nouns = await skql.findAll({
      where: {
        type: In([
          'https://standardknowledge.com/ontologies/core/Integration',
          'https://standardknowledge.com/ontologies/core/Account',
        ]),
      },
      order: {
        [RDFS.label]: 'asc',
      },
    });
    expect(nouns).toHaveLength(2);
    expect((nouns[0][RDFS.label] as ValueObject)['@value']).toBe('Ticketmaster');
    expect((nouns[1][RDFS.label] as ValueObject)['@value']).toBe('Ticketmaster Account');
  });

  it('can update an entity.', async(): Promise<void> => {
    const eventSchema = await skql.findBy({
      id: 'https://schema.org/Event',
    });
    expect(eventSchema[RDFS.label]).toBeUndefined();
    eventSchema[RDFS.label] = 'Event';
    await skql.save(eventSchema);
    const updatedEventSchema = await skql.findBy({
      id: 'https://schema.org/Event',
    });
    expect(updatedEventSchema[RDFS.label]).toBeDefined();
    expect((updatedEventSchema[RDFS.label] as ValueObject)['@value']).toBe('Event');
  });

  // TODO: Test relations
  // TODO: Test select
});
