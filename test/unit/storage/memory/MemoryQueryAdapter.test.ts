/* eslint-disable @typescript-eslint/naming-convention */
import { OWL, XSD } from '@comake/rmlmapper-js';
import { MemoryQueryAdapter } from '../../../../src/storage/memory/MemoryQueryAdapter';
import { Equal } from '../../../../src/storage/operator/Equal';
import { In } from '../../../../src/storage/operator/In';
import { Not } from '../../../../src/storage/operator/Not';
import type { Entity } from '../../../../src/util/Types';
import { RDFS, SKL } from '../../../../src/util/Vocabularies';

describe('a MemoryQueryAdapter', (): void => {
  let schemas: Entity[];
  let adapter: MemoryQueryAdapter;

  beforeEach(async(): Promise<void> => {
    schemas = [];
  });

  describe('find', (): void => {
    it('returns a schema by id.', async(): Promise<void> => {
      schemas = [{
        '@id': 'https://skl.standard.storage/data/123',
        '@type': 'https://skl.standard.storage/File',
      }];
      adapter = new MemoryQueryAdapter({ type: 'memory', schemas });
      await expect(
        adapter.find({
          where: {
            id: 'https://skl.standard.storage/data/123',
          },
        }),
      ).resolves.toEqual(schemas[0]);
    });

    it('returns null if not all query fields match.', async(): Promise<void> => {
      schemas = [{
        '@id': 'https://skl.standard.storage/data/123',
        '@type': 'https://skl.standard.storage/File',
      }];
      adapter = new MemoryQueryAdapter({ type: 'memory', schemas });
      await expect(
        adapter.find({
          where: {
            id: 'https://skl.standard.storage/data/123',
            [SKL.name]: 'image.jpeg',
          },
        }),
      ).resolves.toBeNull();
    });

    it('returns a schema matching all the query fields.', async(): Promise<void> => {
      schemas = [{
        '@id': 'https://skl.standard.storage/data/123',
        '@type': 'https://skl.standard.storage/File',
        [SKL.name]: 'image.jpeg',
      }];
      adapter = new MemoryQueryAdapter({ type: 'memory', schemas });
      await expect(
        adapter.find({
          where: {
            [SKL.name]: 'image.jpeg',
          },
        }),
      ).resolves.toEqual(schemas[0]);
    });

    it('returns a schema matching an array valued query field.', async(): Promise<void> => {
      schemas = [
        {
          '@id': 'https://skl.standard.storage/data/123',
          '@type': 'https://skl.standard.storage/File',
          [SKL.name]: 'image.jpeg',
        },
        {
          '@id': 'https://skl.standard.storage/data/124',
          '@type': 'https://skl.standard.storage/File',
          [SKL.name]: 'image.jpeg',
          'https://skl.standard.storage/rating': [
            { '@value': '1', '@type': XSD.integer },
            { '@value': '2', '@type': XSD.integer },
            { '@value': '3', '@type': XSD.integer },
          ],
        },
      ];
      adapter = new MemoryQueryAdapter({ type: 'memory', schemas });
      await expect(
        adapter.find({
          where: {
            'https://skl.standard.storage/rating': [ 1, 2 ],
          },
        }),
      ).resolves.toEqual(schemas[1]);
    });

    it('returns a schema matching an IRI query field.', async(): Promise<void> => {
      schemas = [{
        '@id': 'https://skl.standard.storage/data/123',
        '@type': 'https://skl.standard.storage/File',
        [SKL.integration]: { '@id': 'https://skl.standard.storage/data/BoxIntegration' },
      }];
      adapter = new MemoryQueryAdapter({ type: 'memory', schemas });
      await expect(
        adapter.find({
          where: {
            [SKL.integration]: 'https://skl.standard.storage/data/BoxIntegration',
          },
        }),
      ).resolves.toEqual(schemas[0]);
    });

    it('returns the first entity if no where clause is provided.', async(): Promise<void> => {
      schemas = [{
        '@id': 'https://skl.standard.storage/data/123',
        '@type': 'https://skl.standard.storage/File',
      }];
      adapter = new MemoryQueryAdapter({ type: 'memory', schemas });
      await expect(adapter.find()).resolves.toEqual(schemas[0]);
    });

    it('returns null if no where clause is provided and there are no entities.', async(): Promise<void> => {
      adapter = new MemoryQueryAdapter({ type: 'memory', schemas });
      await expect(adapter.find()).resolves.toBeNull();
    });

    it('returns entities matching a nested where clause.', async(): Promise<void> => {
      schemas = [
        {
          '@id': 'https://skl.standard.storage/data/123',
          '@type': 'https://skl.standard.storage/File',
          [SKL.integration]: { '@id': 'https://skl.standard.storage/data/BoxIntegration' },
        },
        {
          '@id': 'https://skl.standard.storage/data/BoxIntegration',
          '@type': 'https://skl.standard.storage/Integration',
          [SKL.name]: 'Box',
        },
      ];
      adapter = new MemoryQueryAdapter({ type: 'memory', schemas });
      await expect(
        adapter.find({
          where: {
            '@type': 'https://skl.standard.storage/File',
            [SKL.integration]: {
              [SKL.name]: 'Box',
            },
          },
        }),
      ).resolves.toEqual(schemas[0]);
    });

    it('returns entities matching a nested where clause when the entity has an array value.',
      async(): Promise<void> => {
        schemas = [
          {
            '@id': 'https://skl.standard.storage/data/123',
            '@type': 'https://skl.standard.storage/File',
            [SKL.integration]: { '@id': 'https://skl.standard.storage/data/BoxIntegration' },
          },
          {
            '@id': 'https://skl.standard.storage/data/BoxIntegration',
            '@type': 'https://skl.standard.storage/Integration',
            [SKL.name]: 'Box',
            'https://skl.standard.storage/rating': [
              { '@value': '1', '@type': XSD.integer },
              { '@value': '2', '@type': XSD.integer },
              { '@value': '3', '@type': XSD.integer },
            ],
          },
        ];
        adapter = new MemoryQueryAdapter({ type: 'memory', schemas });
        await expect(
          adapter.find({
            where: {
              '@type': 'https://skl.standard.storage/File',
              [SKL.integration]: {
                'https://skl.standard.storage/rating': 1,
              },
            },
          }),
        ).resolves.toEqual(schemas[0]);
      });

    it('returns an entity with an array value matching an object field value.',
      async(): Promise<void> => {
        schemas = [
          {
            '@id': 'https://skl.standard.storage/data/123',
            '@type': 'https://skl.standard.storage/File',
            [SKL.integration]: [
              { '@id': 'https://skl.standard.storage/data/BoxIntegration' },
              { '@id': 'https://skl.standard.storage/data/GoogleDriveIntegration' },
            ],
          },
          {
            '@id': 'https://skl.standard.storage/data/BoxIntegration',
            '@type': 'https://skl.standard.storage/Integration',
            [SKL.name]: 'Box',
          },
        ];
        adapter = new MemoryQueryAdapter({ type: 'memory', schemas });
        await expect(
          adapter.find({
            where: {
              '@type': 'https://skl.standard.storage/File',
              [SKL.integration]: {
                [SKL.name]: 'Box',
              },
            },
          }),
        ).resolves.toEqual(schemas[0]);
      });

    it('does not returns entities with an array value not matching an object field value.',
      async(): Promise<void> => {
        schemas = [
          {
            '@id': 'https://skl.standard.storage/data/123',
            '@type': 'https://skl.standard.storage/File',
            [SKL.integration]: [
              { '@id': 'https://skl.standard.storage/data/BoxIntegration' },
              { '@id': 'https://skl.standard.storage/data/GoogleDriveIntegration' },
            ],
          },
          {
            '@id': 'https://skl.standard.storage/data/BoxIntegration',
            '@type': 'https://skl.standard.storage/Integration',
            [SKL.name]: 'Box',
          },
        ];
        adapter = new MemoryQueryAdapter({ type: 'memory', schemas });
        await expect(
          adapter.find({
            where: {
              '@type': 'https://skl.standard.storage/File',
              [SKL.integration]: {
                [SKL.name]: 'Dropbox',
              },
            },
          }),
        ).resolves.toBeNull();
      });

    it('does not returns entities with a literal value when filtering with an object field value.',
      async(): Promise<void> => {
        schemas = [{
          '@id': 'https://skl.standard.storage/data/123',
          '@type': 'https://skl.standard.storage/File',
          [SKL.name]: 'image.jpeg',
        }];
        adapter = new MemoryQueryAdapter({ type: 'memory', schemas });
        await expect(
          adapter.find({
            where: {
              [SKL.name]: {
                '@value': 'image.jpeg',
              },
            },
          }),
        ).resolves.toBeNull();
      });

    it('does not returns entities when it references a node that does not exist.',
      async(): Promise<void> => {
        adapter = new MemoryQueryAdapter({ type: 'memory', schemas });
        await expect(
          adapter.find({
            where: {
              [SKL.name]: {
                '@value': 'image.jpeg',
              },
            },
          }),
        ).resolves.toBeNull();
      });

    it('returns entities with a nested blank node matching a nested object query.',
      async(): Promise<void> => {
        schemas = [{
          '@id': 'https://skl.standard.storage/data/123',
          '@type': 'https://skl.standard.storage/File',
          'https://skl.standard.storage/createdAt': {
            '@id': '_:b',
            '@type': 'https://skl.standard.storage/DateTime',
            'https://skl.standard.storage/localTime': '2022-12-02T17:57:04',
          },
        }];
        adapter = new MemoryQueryAdapter({ type: 'memory', schemas });
        await expect(
          adapter.find({
            where: {
              'https://skl.standard.storage/createdAt': {
                'https://skl.standard.storage/localTime': '2022-12-02T17:57:04',
              },
            },
          }),
        ).resolves.toEqual(schemas[0]);
      });
  });

  describe('findBy', (): void => {
    it('returns a schema by id.', async(): Promise<void> => {
      schemas = [{
        '@id': 'https://skl.standard.storage/data/123',
        '@type': 'https://skl.standard.storage/File',
      }];
      adapter = new MemoryQueryAdapter({ type: 'memory', schemas });
      await expect(
        adapter.findBy({
          id: 'https://skl.standard.storage/data/123',
        }),
      ).resolves.toEqual(schemas[0]);
    });

    it('returns null if not all query fields match.', async(): Promise<void> => {
      schemas = [{
        '@id': 'https://skl.standard.storage/data/123',
        '@type': 'https://skl.standard.storage/File',
      }];
      adapter = new MemoryQueryAdapter({ type: 'memory', schemas });
      await expect(
        adapter.findBy({
          id: 'https://skl.standard.storage/data/123',
          [SKL.name]: 'image.jpeg',
        }),
      ).resolves.toBeNull();
    });

    it('returns a schema matching all the query fields.', async(): Promise<void> => {
      schemas = [{
        '@id': 'https://skl.standard.storage/data/123',
        '@type': 'https://skl.standard.storage/File',
        [SKL.name]: 'image.jpeg',
      }];
      adapter = new MemoryQueryAdapter({ type: 'memory', schemas });
      await expect(
        adapter.findBy({
          [SKL.name]: 'image.jpeg',
        }),
      ).resolves.toEqual(schemas[0]);
    });

    it('returns a schema matching an IRI query field.', async(): Promise<void> => {
      schemas = [{
        '@id': 'https://skl.standard.storage/data/123',
        '@type': 'https://skl.standard.storage/File',
        [SKL.integration]: { '@id': 'https://skl.standard.storage/data/BoxIntegration' },
      }];
      adapter = new MemoryQueryAdapter({ type: 'memory', schemas });
      await expect(
        adapter.findBy({
          [SKL.integration]: 'https://skl.standard.storage/data/BoxIntegration',
        }),
      ).resolves.toEqual(schemas[0]);
    });
  });

  describe('findAll', (): void => {
    it('returns an array of one schema by id.', async(): Promise<void> => {
      schemas = [{
        '@id': 'https://skl.standard.storage/data/123',
        '@type': 'https://skl.standard.storage/File',
      }];
      adapter = new MemoryQueryAdapter({ type: 'memory', schemas });
      await expect(
        adapter.findAll({
          where: {
            id: 'https://skl.standard.storage/data/123',
          },
        }),
      ).resolves.toEqual([ schemas[0] ]);
    });

    it('returns an empty array if no schema matches the id field.', async(): Promise<void> => {
      schemas = [{
        '@id': 'https://skl.standard.storage/data/123',
        '@type': 'https://skl.standard.storage/File',
      }];
      adapter = new MemoryQueryAdapter({ type: 'memory', schemas });
      await expect(
        adapter.findAll({
          where: {
            id: 'https://skl.standard.storage/data/127',
          },
        }),
      ).resolves.toEqual([]);
    });

    it('returns an array of schema matching all the query fields.', async(): Promise<void> => {
      schemas = [
        {
          '@id': 'https://skl.standard.storage/data/123',
          '@type': 'https://skl.standard.storage/File',
        },
        {
          '@id': 'https://skl.standard.storage/data/124',
          '@type': 'https://skl.standard.storage/File',
        },
      ];
      adapter = new MemoryQueryAdapter({ type: 'memory', schemas });
      await expect(
        adapter.findAll({
          where: {
            type: 'https://skl.standard.storage/File',
          },
        }),
      ).resolves.toEqual([ schemas[0], schemas[1] ]);
    });

    it('returns an array of schema which are instances of a subclass of the type field of the query.',
      async(): Promise<void> => {
        schemas = [
          {
            '@id': 'https://skl.standard.storage/data/123',
            '@type': 'https://skl.standard.storage/File',
          },
          {
            '@id': 'https://skl.standard.storage/data/124',
            '@type': 'https://skl.standard.storage/Article',
          },
          {
            '@id': 'https://skl.standard.storage/File',
            '@type': OWL.class,
            [RDFS.subClassOf]: [
              { '@id': 'https://skl.standard.storage/Noun' },
            ],
          },
          {
            '@id': 'https://skl.standard.storage/Article',
            '@type': OWL.class,
            [RDFS.subClassOf]: [
              { '@id': 'https://skl.standard.storage/Noun' },
            ],
          },
        ];
        adapter = new MemoryQueryAdapter({ type: 'memory', schemas });
        await expect(
          adapter.findAll({
            where: {
              type: 'https://skl.standard.storage/Noun',
            },
          }),
        ).resolves.toEqual([ schemas[0], schemas[1] ]);
      });

    it('returns the all entities if no where clause is provided.', async(): Promise<void> => {
      schemas = [{
        '@id': 'https://skl.standard.storage/data/123',
        '@type': 'https://skl.standard.storage/File',
      }];
      adapter = new MemoryQueryAdapter({ type: 'memory', schemas });
      await expect(adapter.findAll()).resolves.toEqual(schemas);
    });

    it('returns a limited number of entities.',
      async(): Promise<void> => {
        schemas = [
          {
            '@id': 'https://skl.standard.storage/data/123',
            '@type': 'https://skl.standard.storage/File',
          },
          {
            '@id': 'https://skl.standard.storage/data/124',
            '@type': 'https://skl.standard.storage/File',
          },
        ];
        adapter = new MemoryQueryAdapter({ type: 'memory', schemas });
        await expect(
          adapter.findAll({
            where: { type: SKL.File },
            limit: 1,
          }),
        ).resolves.toEqual([ schemas[0] ]);
      });

    it('returns matching entities after an offset.',
      async(): Promise<void> => {
        schemas = [
          {
            '@id': 'https://skl.standard.storage/data/123',
            '@type': 'https://skl.standard.storage/File',
          },
          {
            '@id': 'https://skl.standard.storage/data/124',
            '@type': 'https://skl.standard.storage/File',
          },
        ];
        adapter = new MemoryQueryAdapter({ type: 'memory', schemas });
        await expect(
          adapter.findAll({
            where: { type: SKL.File },
            offset: 1,
          }),
        ).resolves.toEqual([ schemas[1] ]);
      });

    it('returns a limited number of matching entities after an offset.',
      async(): Promise<void> => {
        schemas = [
          {
            '@id': 'https://skl.standard.storage/data/123',
            '@type': 'https://skl.standard.storage/File',
          },
          {
            '@id': 'https://skl.standard.storage/data/124',
            '@type': 'https://skl.standard.storage/File',
          },
          {
            '@id': 'https://skl.standard.storage/data/125',
            '@type': 'https://skl.standard.storage/File',
          },
        ];
        adapter = new MemoryQueryAdapter({ type: 'memory', schemas });
        await expect(
          adapter.findAll({
            where: { type: SKL.File },
            offset: 1,
            limit: 1,
          }),
        ).resolves.toEqual([ schemas[1] ]);
      });

    it('returns entities matching an in operator.', async(): Promise<void> => {
      schemas = [
        {
          '@id': 'https://skl.standard.storage/data/1',
          '@type': 'https://skl.standard.storage/File',
        },
        {
          '@id': 'https://skl.standard.storage/data/2',
          '@type': 'https://skl.standard.storage/File',
          [SKL.name]: 'image.jpeg',
        },
      ];
      adapter = new MemoryQueryAdapter({ type: 'memory', schemas });
      await expect(adapter.findAll({
        where: {
          [SKL.name]: In([ 'image.jpeg' ]),
        },
      })).resolves.toEqual([ schemas[1] ]);
    });

    it('returns entities matching a not operator.', async(): Promise<void> => {
      schemas = [
        {
          '@id': 'https://skl.standard.storage/data/1',
          '@type': 'https://skl.standard.storage/File',
        },
        {
          '@id': 'https://skl.standard.storage/data/2',
          '@type': 'https://skl.standard.storage/File',
          [SKL.name]: 'image.jpeg',
        },
      ];
      adapter = new MemoryQueryAdapter({ type: 'memory', schemas });
      await expect(adapter.findAll({
        where: {
          [SKL.name]: Not('image.jpeg'),
        },
      })).resolves.toEqual([ schemas[0] ]);
    });

    it('returns entities matching a nested not in operator.', async(): Promise<void> => {
      schemas = [
        {
          '@id': 'https://skl.standard.storage/data/1',
          '@type': 'https://skl.standard.storage/File',
        },
        {
          '@id': 'https://skl.standard.storage/data/2',
          '@type': 'https://skl.standard.storage/File',
          [SKL.name]: 'image.jpeg',
        },
      ];
      adapter = new MemoryQueryAdapter({ type: 'memory', schemas });
      await expect(adapter.findAll({
        where: {
          [SKL.name]: Not(In([ 'image.jpeg' ])),
        },
      })).resolves.toEqual([ schemas[0] ]);
    });

    it('returns entities matching a nested not equal operator.', async(): Promise<void> => {
      schemas = [
        {
          '@id': 'https://skl.standard.storage/data/1',
          '@type': 'https://skl.standard.storage/File',
        },
        {
          '@id': 'https://skl.standard.storage/data/2',
          '@type': 'https://skl.standard.storage/File',
          [SKL.name]: 'image.jpeg',
        },
      ];
      adapter = new MemoryQueryAdapter({ type: 'memory', schemas });
      await expect(adapter.findAll({
        where: {
          [SKL.name]: Not(Equal('image.jpeg')),
        },
      })).resolves.toEqual([ schemas[0] ]);
    });

    it('returns entities matching an equal operator.', async(): Promise<void> => {
      schemas = [
        {
          '@id': 'https://skl.standard.storage/data/1',
          '@type': 'https://skl.standard.storage/File',
        },
        {
          '@id': 'https://skl.standard.storage/data/2',
          '@type': 'https://skl.standard.storage/File',
          [SKL.name]: 'image.jpeg',
        },
      ];
      adapter = new MemoryQueryAdapter({ type: 'memory', schemas });
      await expect(adapter.findAll({
        where: {
          [SKL.name]: Equal('image.jpeg'),
        },
      })).resolves.toEqual([ schemas[1] ]);
    });

    it('throws an error if there is an unsupported operation.', async(): Promise<void> => {
      schemas = [{
        '@id': 'https://skl.standard.storage/data/1',
        '@type': 'https://skl.standard.storage/File',
      }];
      adapter = new MemoryQueryAdapter({ type: 'memory', schemas });
      await expect(
        adapter.findAll({
          where: {
            type: {
              type: 'operator',
              operator: 'and' as any,
              value: [ SKL.File, SKL.Event ],
            },
          },
        }),
      ).rejects.toThrow('Unsupported operator "and"');
    });
  });

  describe('findAllBy', (): void => {
    it('returns an array of one schema by id.', async(): Promise<void> => {
      schemas = [{
        '@id': 'https://skl.standard.storage/data/123',
        '@type': 'https://skl.standard.storage/File',
      }];
      adapter = new MemoryQueryAdapter({ type: 'memory', schemas });
      await expect(
        adapter.findAllBy({
          id: 'https://skl.standard.storage/data/123',
        }),
      ).resolves.toEqual([ schemas[0] ]);
    });

    it('returns an empty array if no schema matches the id field.', async(): Promise<void> => {
      schemas = [{
        '@id': 'https://skl.standard.storage/data/123',
        '@type': 'https://skl.standard.storage/File',
      }];
      adapter = new MemoryQueryAdapter({ type: 'memory', schemas });
      await expect(
        adapter.findAllBy({
          id: 'https://skl.standard.storage/data/127',
        }),
      ).resolves.toEqual([]);
    });

    it('returns an array of schema matching all the query fields.', async(): Promise<void> => {
      schemas = [
        {
          '@id': 'https://skl.standard.storage/data/123',
          '@type': 'https://skl.standard.storage/File',
        },
        {
          '@id': 'https://skl.standard.storage/data/124',
          '@type': 'https://skl.standard.storage/File',
        },
      ];
      adapter = new MemoryQueryAdapter({ type: 'memory', schemas });
      await expect(
        adapter.findAllBy({
          type: 'https://skl.standard.storage/File',
        }),
      ).resolves.toEqual([ schemas[0], schemas[1] ]);
    });

    it('returns an array of schema which are instances of a subclass of the type field of the query.',
      async(): Promise<void> => {
        schemas = [
          {
            '@id': 'https://skl.standard.storage/data/123',
            '@type': 'https://skl.standard.storage/File',
          },
          {
            '@id': 'https://skl.standard.storage/data/124',
            '@type': 'https://skl.standard.storage/Article',
          },
          {
            '@id': 'https://skl.standard.storage/File',
            '@type': OWL.class,
            [RDFS.subClassOf]: [
              { '@id': 'https://skl.standard.storage/Noun' },
            ],
          },
          {
            '@id': 'https://skl.standard.storage/Article',
            '@type': OWL.class,
            [RDFS.subClassOf]: [
              { '@id': 'https://skl.standard.storage/Noun' },
            ],
          },
        ];
        adapter = new MemoryQueryAdapter({ type: 'memory', schemas });
        await expect(
          adapter.findAllBy({
            type: 'https://skl.standard.storage/Noun',
          }),
        ).resolves.toEqual([ schemas[0], schemas[1] ]);
      });
  });

  describe('save', (): void => {
    it('saves a single schema.', async(): Promise<void> => {
      schemas = [{
        '@id': 'https://skl.standard.storage/File',
        '@type': 'https://skl.standard.storage/Noun',
        [SKL.name]: 'File',
      }];
      const entity = schemas[0];
      adapter = new MemoryQueryAdapter({ type: 'memory', schemas });
      const res = await adapter.save(entity);
      expect(res).toEqual(entity);
      adapter = new MemoryQueryAdapter({ type: 'memory', schemas });
      await expect(
        adapter.findBy({ id: entity['@id'] }),
      ).resolves.toEqual(entity);
    });
    it('saves multiple schema.', async(): Promise<void> => {
      schemas = [
        {
          '@id': 'https://skl.standard.storage/data/123',
          '@type': 'https://skl.standard.storage/File',
        },
        {
          '@id': 'https://skl.standard.storage/data/124',
          '@type': 'https://skl.standard.storage/Article',
        },
      ];
      const entities = [ schemas[0], schemas[1] ];
      adapter = new MemoryQueryAdapter({ type: 'memory', schemas });
      const res = await adapter.save(entities);
      expect(res).toEqual(entities);
      await expect(
        adapter.findBy({ id: entities[0]['@id'] }),
      ).resolves.toEqual(entities[0]);
      await expect(
        adapter.findBy({ id: entities[1]['@id'] }),
      ).resolves.toEqual(entities[1]);
    });
  });

  describe('destroy', (): void => {
    it('throws an error if the entity does not exist.', async(): Promise<void> => {
      const entity = {
        '@id': 'https://skl.standard.storage/data/123',
        '@type': 'https://skl.standard.storage/File',
      };
      adapter = new MemoryQueryAdapter({ type: 'memory', schemas });
      await expect(adapter.destroy(entity))
        .rejects.toThrow('Entity with id https://skl.standard.storage/data/123 does not exist.');
    });

    it('destroys a single schema.', async(): Promise<void> => {
      schemas = [{
        '@id': 'https://skl.standard.storage/data/123',
        '@type': 'https://skl.standard.storage/File',
      }];
      adapter = new MemoryQueryAdapter({ type: 'memory', schemas });
      const entity = schemas[0];
      const res = await adapter.destroy(entity);
      expect(res).toEqual(entity);
      await expect(
        adapter.findBy({ id: entity['@id'] }),
      ).resolves.toBeNull();
    });

    it('destroys multiple schema.', async(): Promise<void> => {
      schemas = [
        {
          '@id': 'https://skl.standard.storage/data/123',
          '@type': 'https://skl.standard.storage/File',
        },
        {
          '@id': 'https://skl.standard.storage/data/124',
          '@type': 'https://skl.standard.storage/Article',
        },
      ];
      const entities = [
        schemas[0],
        schemas[1],
      ];
      adapter = new MemoryQueryAdapter({ type: 'memory', schemas });
      const res = await adapter.destroy(entities);
      expect(res).toEqual(entities);
      await expect(
        adapter.findBy({ id: entities[0]['@id'] }),
      ).resolves.toBeNull();
      await expect(
        adapter.findBy({ id: entities[1]['@id'] }),
      ).resolves.toBeNull();
    });
  });
});
