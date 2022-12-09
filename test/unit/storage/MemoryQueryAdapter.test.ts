/* eslint-disable @typescript-eslint/naming-convention */
import { OWL } from '@comake/rmlmapper-js';
import { MemoryQueryAdapter } from '../../../src/storage/MemoryQueryAdapter';
import { In } from '../../../src/storage/operator/In';
import type { Entity } from '../../../src/util/Types';
import { RDFS, SKL } from '../../../src/util/Vocabularies';

describe('a MemoryQueryAdapter', (): void => {
  let schema: Entity[];
  let adapter: MemoryQueryAdapter;

  beforeEach(async(): Promise<void> => {
    schema = [];
  });

  describe('find', (): void => {
    it('returns a schema by id.', async(): Promise<void> => {
      schema = [{
        '@id': 'https://skl.standard.storage/data/123',
        '@type': 'https://skl.standard.storage/nouns/File',
      }];
      adapter = new MemoryQueryAdapter(schema);
      await expect(
        adapter.find({
          where: {
            id: 'https://skl.standard.storage/data/123',
          },
        }),
      ).resolves.toEqual(schema[0]);
    });

    it('returns null if not all query fields match.', async(): Promise<void> => {
      schema = [{
        '@id': 'https://skl.standard.storage/data/123',
        '@type': 'https://skl.standard.storage/nouns/File',
      }];
      adapter = new MemoryQueryAdapter(schema);
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
      schema = [{
        '@id': 'https://skl.standard.storage/data/123',
        '@type': 'https://skl.standard.storage/nouns/File',
        [SKL.name]: 'image.jpeg',
      }];
      adapter = new MemoryQueryAdapter(schema);
      await expect(
        adapter.find({
          where: {
            [SKL.name]: 'image.jpeg',
          },
        }),
      ).resolves.toEqual(schema[0]);
    });

    it('returns a schema matching an IRI query field.', async(): Promise<void> => {
      schema = [{
        '@id': 'https://skl.standard.storage/data/123',
        '@type': 'https://skl.standard.storage/nouns/File',
        [SKL.integration]: { '@id': 'https://skl.standard.storage/data/BoxIntegration' },
      }];
      adapter = new MemoryQueryAdapter(schema);
      await expect(
        adapter.find({
          where: {
            [SKL.integration]: 'https://skl.standard.storage/data/BoxIntegration',
          },
        }),
      ).resolves.toEqual(schema[0]);
    });

    it('returns the first entity if no where clause is provided.', async(): Promise<void> => {
      schema = [{
        '@id': 'https://skl.standard.storage/data/123',
        '@type': 'https://skl.standard.storage/nouns/File',
      }];
      adapter = new MemoryQueryAdapter(schema);
      await expect(adapter.find()).resolves.toEqual(schema[0]);
    });

    it('returns null if no where clause is provided and there are no entities.', async(): Promise<void> => {
      adapter = new MemoryQueryAdapter(schema);
      await expect(adapter.find()).resolves.toBeNull();
    });

    it('returns entities matching a nested where clause.', async(): Promise<void> => {
      schema = [
        {
          '@id': 'https://skl.standard.storage/data/123',
          '@type': 'https://skl.standard.storage/nouns/File',
          [SKL.integration]: { '@id': 'https://skl.standard.storage/data/BoxIntegration' },
        },
        {
          '@id': 'https://skl.standard.storage/data/BoxIntegration',
          '@type': 'https://skl.standard.storage/nouns/Integration',
          [SKL.name]: 'Box',
        },
      ];
      adapter = new MemoryQueryAdapter(schema);
      await expect(
        adapter.find({
          where: {
            '@type': 'https://skl.standard.storage/nouns/File',
            [SKL.integration]: {
              [SKL.name]: 'Box',
            },
          },
        }),
      ).resolves.toEqual(schema[0]);
    });

    it('returns entities matching a nested where clause when the entity has an array value.',
      async(): Promise<void> => {
        schema = [
          {
            '@id': 'https://skl.standard.storage/data/123',
            '@type': 'https://skl.standard.storage/nouns/File',
            [SKL.integration]: { '@id': 'https://skl.standard.storage/data/BoxIntegration' },
          },
          {
            '@id': 'https://skl.standard.storage/data/BoxIntegration',
            '@type': 'https://skl.standard.storage/nouns/Integration',
            [SKL.name]: 'Box',
            'https://skl.standard.storage/rating': [
              { '@value': '1' },
              { '@value': '2' },
              { '@value': '3' },
            ],
          },
        ];
        adapter = new MemoryQueryAdapter(schema);
        await expect(
          adapter.find({
            where: {
              '@type': 'https://skl.standard.storage/nouns/File',
              [SKL.integration]: {
                'https://skl.standard.storage/rating': '1',
              },
            },
          }),
        ).resolves.toEqual(schema[0]);
      });

    it('returns an entity with an array value matching an object field value.',
      async(): Promise<void> => {
        schema = [
          {
            '@id': 'https://skl.standard.storage/data/123',
            '@type': 'https://skl.standard.storage/nouns/File',
            [SKL.integration]: [
              { '@id': 'https://skl.standard.storage/data/BoxIntegration' },
              { '@id': 'https://skl.standard.storage/data/GoogleDriveIntegration' },
            ],
          },
          {
            '@id': 'https://skl.standard.storage/data/BoxIntegration',
            '@type': 'https://skl.standard.storage/nouns/Integration',
            [SKL.name]: 'Box',
          },
        ];
        adapter = new MemoryQueryAdapter(schema);
        await expect(
          adapter.find({
            where: {
              '@type': 'https://skl.standard.storage/nouns/File',
              [SKL.integration]: {
                [SKL.name]: 'Box',
              },
            },
          }),
        ).resolves.toEqual(schema[0]);
      });

    it('does not returns entities with an array value not matching an object field value.',
      async(): Promise<void> => {
        schema = [
          {
            '@id': 'https://skl.standard.storage/data/123',
            '@type': 'https://skl.standard.storage/nouns/File',
            [SKL.integration]: [
              { '@id': 'https://skl.standard.storage/data/BoxIntegration' },
              { '@id': 'https://skl.standard.storage/data/GoogleDriveIntegration' },
            ],
          },
          {
            '@id': 'https://skl.standard.storage/data/BoxIntegration',
            '@type': 'https://skl.standard.storage/nouns/Integration',
            [SKL.name]: 'Box',
          },
        ];
        adapter = new MemoryQueryAdapter(schema);
        await expect(
          adapter.find({
            where: {
              '@type': 'https://skl.standard.storage/nouns/File',
              [SKL.integration]: {
                [SKL.name]: 'Dropbox',
              },
            },
          }),
        ).resolves.toBeNull();
      });

    it('does not returns entities with a literal value when filtering with an object field value.',
      async(): Promise<void> => {
        schema = [{
          '@id': 'https://skl.standard.storage/data/123',
          '@type': 'https://skl.standard.storage/nouns/File',
          [SKL.name]: 'image.jpeg',
        }];
        adapter = new MemoryQueryAdapter(schema);
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
        adapter = new MemoryQueryAdapter(schema);
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
        schema = [{
          '@id': 'https://skl.standard.storage/data/123',
          '@type': 'https://skl.standard.storage/nouns/File',
          'https://skl.standard.storage/createdAt': {
            '@id': '_:b',
            '@type': 'https://skl.standard.storage/DateTime',
            'https://skl.standard.storage/localTime': '2022-12-02T17:57:04',
          },
        }];
        adapter = new MemoryQueryAdapter(schema);
        await expect(
          adapter.find({
            where: {
              'https://skl.standard.storage/createdAt': {
                'https://skl.standard.storage/localTime': '2022-12-02T17:57:04',
              },
            },
          }),
        ).resolves.toEqual(schema[0]);
      });
  });

  describe('findBy', (): void => {
    it('returns a schema by id.', async(): Promise<void> => {
      schema = [{
        '@id': 'https://skl.standard.storage/data/123',
        '@type': 'https://skl.standard.storage/nouns/File',
      }];
      adapter = new MemoryQueryAdapter(schema);
      await expect(
        adapter.findBy({
          id: 'https://skl.standard.storage/data/123',
        }),
      ).resolves.toEqual(schema[0]);
    });

    it('returns null if not all query fields match.', async(): Promise<void> => {
      schema = [{
        '@id': 'https://skl.standard.storage/data/123',
        '@type': 'https://skl.standard.storage/nouns/File',
      }];
      adapter = new MemoryQueryAdapter(schema);
      await expect(
        adapter.findBy({
          id: 'https://skl.standard.storage/data/123',
          [SKL.name]: 'image.jpeg',
        }),
      ).resolves.toBeNull();
    });

    it('returns a schema matching all the query fields.', async(): Promise<void> => {
      schema = [{
        '@id': 'https://skl.standard.storage/data/123',
        '@type': 'https://skl.standard.storage/nouns/File',
        [SKL.name]: 'image.jpeg',
      }];
      adapter = new MemoryQueryAdapter(schema);
      await expect(
        adapter.findBy({
          [SKL.name]: 'image.jpeg',
        }),
      ).resolves.toEqual(schema[0]);
    });

    it('returns a schema matching an IRI query field.', async(): Promise<void> => {
      schema = [{
        '@id': 'https://skl.standard.storage/data/123',
        '@type': 'https://skl.standard.storage/nouns/File',
        [SKL.integration]: { '@id': 'https://skl.standard.storage/data/BoxIntegration' },
      }];
      adapter = new MemoryQueryAdapter(schema);
      await expect(
        adapter.findBy({
          [SKL.integration]: 'https://skl.standard.storage/data/BoxIntegration',
        }),
      ).resolves.toEqual(schema[0]);
    });
  });

  describe('findAll', (): void => {
    it('returns an array of one schema by id.', async(): Promise<void> => {
      schema = [{
        '@id': 'https://skl.standard.storage/data/123',
        '@type': 'https://skl.standard.storage/nouns/File',
      }];
      adapter = new MemoryQueryAdapter(schema);
      await expect(
        adapter.findAll({
          where: {
            id: 'https://skl.standard.storage/data/123',
          },
        }),
      ).resolves.toEqual([ schema[0] ]);
    });

    it('returns an empty array if no schema matches the id field.', async(): Promise<void> => {
      schema = [{
        '@id': 'https://skl.standard.storage/data/123',
        '@type': 'https://skl.standard.storage/nouns/File',
      }];
      adapter = new MemoryQueryAdapter(schema);
      await expect(
        adapter.findAll({
          where: {
            id: 'https://skl.standard.storage/data/127',
          },
        }),
      ).resolves.toEqual([]);
    });

    it('returns an array of schema matching all the query fields.', async(): Promise<void> => {
      schema = [
        {
          '@id': 'https://skl.standard.storage/data/123',
          '@type': 'https://skl.standard.storage/nouns/File',
        },
        {
          '@id': 'https://skl.standard.storage/data/124',
          '@type': 'https://skl.standard.storage/nouns/File',
        },
      ];
      adapter = new MemoryQueryAdapter(schema);
      await expect(
        adapter.findAll({
          where: {
            type: 'https://skl.standard.storage/nouns/File',
          },
        }),
      ).resolves.toEqual([ schema[0], schema[1] ]);
    });

    it('returns an array of schema which are instances of a subclass of the type field of the query.',
      async(): Promise<void> => {
        schema = [
          {
            '@id': 'https://skl.standard.storage/data/123',
            '@type': 'https://skl.standard.storage/nouns/File',
          },
          {
            '@id': 'https://skl.standard.storage/data/124',
            '@type': 'https://skl.standard.storage/nouns/Article',
          },
          {
            '@id': 'https://skl.standard.storage/nouns/File',
            '@type': OWL.class,
            [RDFS.subClassOf]: [
              { '@id': 'https://skl.standard.storage/nouns/Noun' },
            ],
          },
          {
            '@id': 'https://skl.standard.storage/nouns/Article',
            '@type': OWL.class,
            [RDFS.subClassOf]: [
              { '@id': 'https://skl.standard.storage/nouns/Noun' },
            ],
          },
        ];
        adapter = new MemoryQueryAdapter(schema);
        await expect(
          adapter.findAll({
            where: {
              type: 'https://skl.standard.storage/nouns/Noun',
            },
          }),
        ).resolves.toEqual([ schema[0], schema[1] ]);
      });

    it('returns the all entities if no where clause is provided.', async(): Promise<void> => {
      schema = [{
        '@id': 'https://skl.standard.storage/data/123',
        '@type': 'https://skl.standard.storage/nouns/File',
      }];
      adapter = new MemoryQueryAdapter(schema);
      await expect(adapter.findAll()).resolves.toEqual(schema);
    });

    it('returns a limited number of entities.',
      async(): Promise<void> => {
        schema = [
          {
            '@id': 'https://skl.standard.storage/data/123',
            '@type': 'https://skl.standard.storage/nouns/File',
          },
          {
            '@id': 'https://skl.standard.storage/data/124',
            '@type': 'https://skl.standard.storage/nouns/File',
          },
        ];
        adapter = new MemoryQueryAdapter(schema);
        await expect(
          adapter.findAll({
            where: { type: SKL.File },
            limit: 1,
          }),
        ).resolves.toEqual([ schema[0] ]);
      });

    it('returns matching entities after an offset.',
      async(): Promise<void> => {
        schema = [
          {
            '@id': 'https://skl.standard.storage/data/123',
            '@type': 'https://skl.standard.storage/nouns/File',
          },
          {
            '@id': 'https://skl.standard.storage/data/124',
            '@type': 'https://skl.standard.storage/nouns/File',
          },
        ];
        adapter = new MemoryQueryAdapter(schema);
        await expect(
          adapter.findAll({
            where: { type: SKL.File },
            offset: 1,
          }),
        ).resolves.toEqual([ schema[1] ]);
      });

    it('returns a limited number of matching entities after an offset.',
      async(): Promise<void> => {
        schema = [
          {
            '@id': 'https://skl.standard.storage/data/123',
            '@type': 'https://skl.standard.storage/nouns/File',
          },
          {
            '@id': 'https://skl.standard.storage/data/124',
            '@type': 'https://skl.standard.storage/nouns/File',
          },
          {
            '@id': 'https://skl.standard.storage/data/125',
            '@type': 'https://skl.standard.storage/nouns/File',
          },
        ];
        adapter = new MemoryQueryAdapter(schema);
        await expect(
          adapter.findAll({
            where: { type: SKL.File },
            offset: 1,
            limit: 1,
          }),
        ).resolves.toEqual([ schema[1] ]);
      });

    it('returns entities matching an in operator on the id field.', async(): Promise<void> => {
      schema = [
        {
          '@id': 'https://example.com/data/1',
          '@type': 'https://skl.standard.storage/nouns/File',
        },
        {
          '@id': 'https://example.com/data/2',
          '@type': 'https://skl.standard.storage/nouns/File',
        },
        {
          '@id': 'https://example.com/data/3',
          '@type': 'https://skl.standard.storage/nouns/File',
        },
      ];
      adapter = new MemoryQueryAdapter(schema);
      await expect(adapter.findAll({
        where: {
          id: In([ 'https://example.com/data/2', 'https://example.com/data/3' ]),
        },
      })).resolves.toEqual([ schema[1], schema[2] ]);
    });

    it('returns entities matching an operator on the type field.', async(): Promise<void> => {
      schema = [
        {
          '@id': 'https://skl.standard.storage/data/1',
          '@type': 'https://skl.standard.storage/nouns/File',
        },
        {
          '@id': 'https://skl.standard.storage/data/2',
          '@type': 'https://skl.standard.storage/nouns/Article',
        },
        {
          '@id': 'https://skl.standard.storage/data/3',
          '@type': 'https://skl.standard.storage/nouns/Event',
        },
      ];
      adapter = new MemoryQueryAdapter(schema);
      await expect(adapter.findAll({
        where: {
          type: In([ SKL.File, 'https://skl.standard.storage/nouns/Article' ]),
        },
      })).resolves.toEqual([ schema[0], schema[1] ]);
    });

    it('returns entities matching an in operator on a non id or type field.', async(): Promise<void> => {
      schema = [
        {
          '@id': 'https://skl.standard.storage/data/1',
          '@type': 'https://skl.standard.storage/nouns/File',
        },
        {
          '@id': 'https://skl.standard.storage/data/2',
          '@type': 'https://skl.standard.storage/nouns/File',
          [SKL.name]: 'image.jpeg',
        },
      ];
      adapter = new MemoryQueryAdapter(schema);
      await expect(adapter.findAll({
        where: {
          [SKL.name]: In([ 'image.jpeg' ]),
        },
      })).resolves.toEqual([ schema[1] ]);
    });

    it('throws an error if there is an unsupported operation.', async(): Promise<void> => {
      schema = [{
        '@id': 'https://skl.standard.storage/data/1',
        '@type': 'https://skl.standard.storage/nouns/File',
      }];
      adapter = new MemoryQueryAdapter(schema);
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
      schema = [{
        '@id': 'https://skl.standard.storage/data/123',
        '@type': 'https://skl.standard.storage/nouns/File',
      }];
      adapter = new MemoryQueryAdapter(schema);
      await expect(
        adapter.findAllBy({
          id: 'https://skl.standard.storage/data/123',
        }),
      ).resolves.toEqual([ schema[0] ]);
    });

    it('returns an empty array if no schema matches the id field.', async(): Promise<void> => {
      schema = [{
        '@id': 'https://skl.standard.storage/data/123',
        '@type': 'https://skl.standard.storage/nouns/File',
      }];
      adapter = new MemoryQueryAdapter(schema);
      await expect(
        adapter.findAllBy({
          id: 'https://skl.standard.storage/data/127',
        }),
      ).resolves.toEqual([]);
    });

    it('returns an array of schema matching all the query fields.', async(): Promise<void> => {
      schema = [
        {
          '@id': 'https://skl.standard.storage/data/123',
          '@type': 'https://skl.standard.storage/nouns/File',
        },
        {
          '@id': 'https://skl.standard.storage/data/124',
          '@type': 'https://skl.standard.storage/nouns/File',
        },
      ];
      adapter = new MemoryQueryAdapter(schema);
      await expect(
        adapter.findAllBy({
          type: 'https://skl.standard.storage/nouns/File',
        }),
      ).resolves.toEqual([ schema[0], schema[1] ]);
    });

    it('returns an array of schema which are instances of a subclass of the type field of the query.',
      async(): Promise<void> => {
        schema = [
          {
            '@id': 'https://skl.standard.storage/data/123',
            '@type': 'https://skl.standard.storage/nouns/File',
          },
          {
            '@id': 'https://skl.standard.storage/data/124',
            '@type': 'https://skl.standard.storage/nouns/Article',
          },
          {
            '@id': 'https://skl.standard.storage/nouns/File',
            '@type': OWL.class,
            [RDFS.subClassOf]: [
              { '@id': 'https://skl.standard.storage/nouns/Noun' },
            ],
          },
          {
            '@id': 'https://skl.standard.storage/nouns/Article',
            '@type': OWL.class,
            [RDFS.subClassOf]: [
              { '@id': 'https://skl.standard.storage/nouns/Noun' },
            ],
          },
        ];
        adapter = new MemoryQueryAdapter(schema);
        await expect(
          adapter.findAllBy({
            type: 'https://skl.standard.storage/nouns/Noun',
          }),
        ).resolves.toEqual([ schema[0], schema[1] ]);
      });
  });

  describe('save', (): void => {
    it('saves a single schema.', async(): Promise<void> => {
      schema = [{
        '@id': 'https://skl.standard.storage/nouns/File',
        '@type': 'https://skl.standard.storage/nouns/Noun',
        [SKL.name]: 'File',
      }];
      const entity = schema[0];
      adapter = new MemoryQueryAdapter(schema);
      const res = await adapter.save(entity);
      expect(res).toEqual(entity);
      adapter = new MemoryQueryAdapter(schema);
      await expect(
        adapter.findBy({ id: entity['@id'] }),
      ).resolves.toEqual(entity);
    });
    it('saves multiple schema.', async(): Promise<void> => {
      schema = [
        {
          '@id': 'https://skl.standard.storage/data/123',
          '@type': 'https://skl.standard.storage/nouns/File',
        },
        {
          '@id': 'https://skl.standard.storage/data/124',
          '@type': 'https://skl.standard.storage/nouns/Article',
        },
      ];
      const entities = [ schema[0], schema[1] ];
      adapter = new MemoryQueryAdapter(schema);
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
        '@type': 'https://skl.standard.storage/nouns/File',
      };
      adapter = new MemoryQueryAdapter(schema);
      await expect(adapter.destroy(entity))
        .rejects.toThrow('Entity with id https://skl.standard.storage/data/123 does not exist.');
    });

    it('destroys a single schema.', async(): Promise<void> => {
      schema = [{
        '@id': 'https://skl.standard.storage/data/123',
        '@type': 'https://skl.standard.storage/nouns/File',
      }];
      adapter = new MemoryQueryAdapter(schema);
      const entity = schema[0];
      const res = await adapter.destroy(entity);
      expect(res).toEqual(entity);
      await expect(
        adapter.findBy({ id: entity['@id'] }),
      ).resolves.toBeNull();
    });

    it('destroys multiple schema.', async(): Promise<void> => {
      schema = [
        {
          '@id': 'https://skl.standard.storage/data/123',
          '@type': 'https://skl.standard.storage/nouns/File',
        },
        {
          '@id': 'https://skl.standard.storage/data/124',
          '@type': 'https://skl.standard.storage/nouns/Article',
        },
      ];
      const entities = [
        schema[0],
        schema[1],
      ];
      adapter = new MemoryQueryAdapter(schema);
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
