/* eslint-disable unicorn/expiring-todo-comments */
/* eslint-disable @typescript-eslint/naming-convention */
import type { NodeObject, ValueObject } from 'jsonld';
import { SKLEngine } from '../../src/sklEngine';
import { In } from '../../src/storage/operator/In';
import type { Entity } from '../../src/util/Types';
import { getValueIfDefined } from '../../src/util/Util';
import { SCHEMA, SKL, OWL, RDFS, DCTERMS } from '../../src/util/Vocabularies';
import { describeIf, frameAndCombineSchemas } from '../util/Util';

const endpointUrl = 'http://localhost:9999/blazegraph/namespace/kb/sparql';

describeIf('docker', 'An SKL engine backed by a sparql query adapter', (): void => {
  let engine: SKLEngine;
  let schema: Entity[];

  beforeAll(async(): Promise<void> => {
    const schemas = [
      './test/assets/schemas/core.json',
      './test/assets/schemas/get-ticketmaster-events.json',
    ];
    const env = { TICKETMASTER_APIKEY: process.env.TICKETMASTER_APIKEY! };
    schema = await frameAndCombineSchemas(schemas, env);
    engine = new SKLEngine({ type: 'sparql', endpointUrl, setTimestamps: true });
    await engine.destroyAll();
  });

  afterAll(async(): Promise<void> => {
    await engine.destroyAll();
  });

  it('can save entities.', async(): Promise<void> => {
    await engine.save(schema);
    const savedSchemasCount = await engine.count();
    expect(savedSchemasCount).toBe(schema.length);
  });

  it('can get events from ticketmaster.', async(): Promise<void> => {
    const eventsCollection = await engine.verb.getEvents({
      account: 'https://example.com/data/TicketmasterAccount1',
      city: 'Atlanta',
      pageSize: 20,
    });
    expect(eventsCollection[SKL.records]).toBeInstanceOf(Array);
    expect((eventsCollection[SKL.records] as NodeObject[])[0]['@type']).toBe(SCHEMA.Event);
  });

  it('can find one entity.', async(): Promise<void> => {
    const accessTokenProperty = await engine.find({
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
    const nouns = await engine.findAll({
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
    const eventSchema = await engine.findBy({
      id: 'https://schema.org/Event',
    });
    expect(eventSchema[RDFS.label]).not.toBe('Event');
    eventSchema[RDFS.label] = 'Event';
    await engine.save(eventSchema);
    const updatedEventSchema = await engine.findBy({
      id: 'https://schema.org/Event',
    });
    expect(updatedEventSchema[RDFS.label]).toBeDefined();
    expect((updatedEventSchema[RDFS.label] as ValueObject)['@value']).toBe('Event');
  });

  it('can update a partial entity.', async(): Promise<void> => {
    const eventSchema = await engine.findBy({
      id: 'https://schema.org/Event',
    });
    expect(eventSchema[RDFS.label]).not.toBe('Events');
    const prevUpdateTime = getValueIfDefined(eventSchema[DCTERMS.modified]);
    await engine.update(
      'https://schema.org/Event',
      { [RDFS.label]: 'Events' },
    );
    const updatedEventSchema = await engine.findBy({
      id: 'https://schema.org/Event',
    });
    expect(updatedEventSchema[RDFS.label]).toBeDefined();
    expect((updatedEventSchema[RDFS.label] as ValueObject)['@value']).toBe('Events');
    expect(updatedEventSchema[DCTERMS.modified]).toBeDefined();
    expect((updatedEventSchema[DCTERMS.modified] as ValueObject)['@value']).not.toEqual(prevUpdateTime);
  });
  // TODO: Test relations
  // TODO: Test select
});
