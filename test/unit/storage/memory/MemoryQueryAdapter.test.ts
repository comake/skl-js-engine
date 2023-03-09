/* eslint-disable @typescript-eslint/naming-convention */
import { OWL, XSD } from '@comake/rmlmapper-js';
import { MemoryQueryAdapter } from '../../../../src/storage/memory/MemoryQueryAdapter';
import { Equal } from '../../../../src/storage/operator/Equal';
import { GreaterThan } from '../../../../src/storage/operator/GreaterThan';
import { GreaterThanOrEqual } from '../../../../src/storage/operator/GreaterThanOrEqual';
import { In } from '../../../../src/storage/operator/In';
import { Inverse } from '../../../../src/storage/operator/Inverse';
import { InverseRelation } from '../../../../src/storage/operator/InverseRelation';
import { LessThan } from '../../../../src/storage/operator/LessThan';
import { LessThanOrEqual } from '../../../../src/storage/operator/LessThanOrEqual';
import { Not } from '../../../../src/storage/operator/Not';
import type { Entity } from '../../../../src/util/Types';
import { RDFS, SKL } from '../../../../src/util/Vocabularies';

describe('a MemoryQueryAdapter', (): void => {
  let schemas: Entity[];
  let adapter: MemoryQueryAdapter;

  beforeEach(async(): Promise<void> => {
    schemas = [];
  });

  describe('executeRawQuery', (): void => {
    it('is not supported and returns an empty array.', async(): Promise<void> => {
      schemas = [{
        '@id': 'https://example.com/data/123',
        '@type': 'https://standardknowledge.com/ontologies/core/File',
      }];
      adapter = new MemoryQueryAdapter({ type: 'memory', schemas });
      await expect(
        adapter.executeRawQuery(''),
      ).resolves.toEqual([]);
    });
  });

  describe('executeRawEntityQuery', (): void => {
    it('is not supported and returns an empty GraphObject.', async(): Promise<void> => {
      schemas = [{
        '@id': 'https://example.com/data/123',
        '@type': 'https://standardknowledge.com/ontologies/core/File',
      }];
      adapter = new MemoryQueryAdapter({ type: 'memory', schemas });
      await expect(
        adapter.executeRawEntityQuery('', {}),
      ).resolves.toEqual({ '@graph': []});
    });
  });

  describe('find', (): void => {
    it('returns a schema by id.', async(): Promise<void> => {
      schemas = [{
        '@id': 'https://example.com/data/123',
        '@type': 'https://standardknowledge.com/ontologies/core/File',
      }];
      adapter = new MemoryQueryAdapter({ type: 'memory', schemas });
      await expect(
        adapter.find({
          where: {
            id: 'https://example.com/data/123',
          },
        }),
      ).resolves.toEqual(schemas[0]);
    });

    it('returns null if not all query fields match.', async(): Promise<void> => {
      schemas = [{
        '@id': 'https://example.com/data/123',
        '@type': 'https://standardknowledge.com/ontologies/core/File',
      }];
      adapter = new MemoryQueryAdapter({ type: 'memory', schemas });
      await expect(
        adapter.find({
          where: {
            id: 'https://example.com/data/123',
            [RDFS.label]: 'image.jpeg',
          },
        }),
      ).resolves.toBeNull();
    });

    it('returns a schema matching all the query fields.', async(): Promise<void> => {
      schemas = [{
        '@id': 'https://example.com/data/123',
        '@type': 'https://standardknowledge.com/ontologies/core/File',
        [RDFS.label]: 'image.jpeg',
      }];
      adapter = new MemoryQueryAdapter({ type: 'memory', schemas });
      await expect(
        adapter.find({
          where: {
            [RDFS.label]: 'image.jpeg',
          },
        }),
      ).resolves.toEqual(schemas[0]);
    });

    it('returns a schema matching an array valued query field.', async(): Promise<void> => {
      schemas = [
        {
          '@id': 'https://example.com/data/123',
          '@type': 'https://standardknowledge.com/ontologies/core/File',
          [RDFS.label]: 'image.jpeg',
        },
        {
          '@id': 'https://example.com/data/124',
          '@type': 'https://standardknowledge.com/ontologies/core/File',
          [RDFS.label]: 'image.jpeg',
          'https://example.com/rating': [
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
            'https://example.com/rating': [ 1, 2 ],
          },
        }),
      ).resolves.toEqual(schemas[1]);
    });

    it('returns a schema matching an IRI query field.', async(): Promise<void> => {
      schemas = [{
        '@id': 'https://example.com/data/123',
        '@type': 'https://standardknowledge.com/ontologies/core/File',
        [SKL.integration]: { '@id': 'https://example.com/data/BoxIntegration' },
      }];
      adapter = new MemoryQueryAdapter({ type: 'memory', schemas });
      await expect(
        adapter.find({
          where: {
            [SKL.integration]: 'https://example.com/data/BoxIntegration',
          },
        }),
      ).resolves.toEqual(schemas[0]);
    });

    it('returns the first entity if no where clause is provided.', async(): Promise<void> => {
      schemas = [{
        '@id': 'https://example.com/data/123',
        '@type': 'https://standardknowledge.com/ontologies/core/File',
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
          '@id': 'https://example.com/data/123',
          '@type': 'https://standardknowledge.com/ontologies/core/File',
          [SKL.integration]: { '@id': 'https://example.com/data/BoxIntegration' },
        },
        {
          '@id': 'https://example.com/data/BoxIntegration',
          '@type': 'https://standardknowledge.com/ontologies/core/Integration',
          [RDFS.label]: 'Box',
        },
      ];
      adapter = new MemoryQueryAdapter({ type: 'memory', schemas });
      await expect(
        adapter.find({
          where: {
            '@type': 'https://standardknowledge.com/ontologies/core/File',
            [SKL.integration]: {
              [RDFS.label]: 'Box',
            },
          },
        }),
      ).resolves.toEqual(schemas[0]);
    });

    it('returns entities matching a nested where clause when the entity has an array value.',
      async(): Promise<void> => {
        schemas = [
          {
            '@id': 'https://example.com/data/123',
            '@type': 'https://standardknowledge.com/ontologies/core/File',
            [SKL.integration]: { '@id': 'https://example.com/data/BoxIntegration' },
          },
          {
            '@id': 'https://example.com/data/BoxIntegration',
            '@type': 'https://standardknowledge.com/ontologies/core/Integration',
            [RDFS.label]: 'Box',
            'https://example.com/rating': [
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
              '@type': 'https://standardknowledge.com/ontologies/core/File',
              [SKL.integration]: {
                'https://example.com/rating': 1,
              },
            },
          }),
        ).resolves.toEqual(schemas[0]);
      });

    it('returns an entity with an array value matching an object field value.',
      async(): Promise<void> => {
        schemas = [
          {
            '@id': 'https://example.com/data/123',
            '@type': 'https://standardknowledge.com/ontologies/core/File',
            [SKL.integration]: [
              { '@id': 'https://example.com/data/BoxIntegration' },
              { '@id': 'https://example.com/data/GoogleDriveIntegration' },
            ],
          },
          {
            '@id': 'https://example.com/data/BoxIntegration',
            '@type': 'https://standardknowledge.com/ontologies/core/Integration',
            [RDFS.label]: 'Box',
          },
        ];
        adapter = new MemoryQueryAdapter({ type: 'memory', schemas });
        await expect(
          adapter.find({
            where: {
              '@type': 'https://standardknowledge.com/ontologies/core/File',
              [SKL.integration]: {
                [RDFS.label]: 'Box',
              },
            },
          }),
        ).resolves.toEqual(schemas[0]);
      });

    it('does not returns entities with an array value not matching an object field value.',
      async(): Promise<void> => {
        schemas = [
          {
            '@id': 'https://example.com/data/123',
            '@type': 'https://standardknowledge.com/ontologies/core/File',
            [SKL.integration]: [
              { '@id': 'https://example.com/data/BoxIntegration' },
              { '@id': 'https://example.com/data/GoogleDriveIntegration' },
            ],
          },
          {
            '@id': 'https://example.com/data/BoxIntegration',
            '@type': 'https://standardknowledge.com/ontologies/core/Integration',
            [RDFS.label]: 'Box',
          },
        ];
        adapter = new MemoryQueryAdapter({ type: 'memory', schemas });
        await expect(
          adapter.find({
            where: {
              '@type': 'https://standardknowledge.com/ontologies/core/File',
              [SKL.integration]: {
                [RDFS.label]: 'Dropbox',
              },
            },
          }),
        ).resolves.toBeNull();
      });

    it('returns entities with a literal value when filtering with an object field value.',
      async(): Promise<void> => {
        schemas = [{
          '@id': 'https://example.com/data/123',
          '@type': 'https://standardknowledge.com/ontologies/core/File',
          [RDFS.label]: 'image.jpeg',
        }];
        adapter = new MemoryQueryAdapter({ type: 'memory', schemas });
        await expect(
          adapter.find({
            where: {
              [RDFS.label]: {
                '@value': 'image.jpeg',
              },
            },
          }),
        ).resolves.toEqual(schemas[0]);
      });

    it('does not return entities when it references a node that does not exist.',
      async(): Promise<void> => {
        adapter = new MemoryQueryAdapter({ type: 'memory', schemas });
        await expect(
          adapter.find({
            where: {
              [RDFS.label]: {
                '@value': 'image.jpeg',
              },
            },
          }),
        ).resolves.toBeNull();
      });

    it('does not return entities if the where field includes an object for a field which is not an object.',
      async(): Promise<void> => {
        schemas = [{
          '@id': 'https://example.com/data/123',
          '@type': 'https://standardknowledge.com/ontologies/core/File',
          [RDFS.label]: 'image.jpeg',
        }];
        adapter = new MemoryQueryAdapter({ type: 'memory', schemas });
        await expect(
          adapter.find({
            where: {
              [RDFS.label]: { value: 'image.jpeg' },
            },
          }),
        ).resolves.toBeNull();
      });

    it('returns entities with a nested blank node matching a nested object query.',
      async(): Promise<void> => {
        schemas = [{
          '@id': 'https://example.com/data/123',
          '@type': 'https://standardknowledge.com/ontologies/core/File',
          'https://example.com/createdAt': {
            '@id': '_:b',
            '@type': 'https://standardknowledge.com/ontologies/core/DateTime',
            'https://example.com/localTime': '2022-12-02T17:57:04',
          },
        }];
        adapter = new MemoryQueryAdapter({ type: 'memory', schemas });
        await expect(
          adapter.find({
            where: {
              'https://example.com/createdAt': {
                'https://example.com/localTime': '2022-12-02T17:57:04',
              },
            },
          }),
        ).resolves.toEqual(schemas[0]);
      });
  });

  describe('findBy', (): void => {
    it('returns a schema by id.', async(): Promise<void> => {
      schemas = [{
        '@id': 'https://example.com/data/123',
        '@type': 'https://standardknowledge.com/ontologies/core/File',
      }];
      adapter = new MemoryQueryAdapter({ type: 'memory', schemas });
      await expect(
        adapter.findBy({
          id: 'https://example.com/data/123',
        }),
      ).resolves.toEqual(schemas[0]);
    });

    it('returns null if not all query fields match.', async(): Promise<void> => {
      schemas = [{
        '@id': 'https://example.com/data/123',
        '@type': 'https://standardknowledge.com/ontologies/core/File',
      }];
      adapter = new MemoryQueryAdapter({ type: 'memory', schemas });
      await expect(
        adapter.findBy({
          id: 'https://example.com/data/123',
          [RDFS.label]: 'image.jpeg',
        }),
      ).resolves.toBeNull();
    });

    it('returns a schema matching all the query fields.', async(): Promise<void> => {
      schemas = [{
        '@id': 'https://example.com/data/123',
        '@type': 'https://standardknowledge.com/ontologies/core/File',
        [RDFS.label]: 'image.jpeg',
      }];
      adapter = new MemoryQueryAdapter({ type: 'memory', schemas });
      await expect(
        adapter.findBy({
          [RDFS.label]: 'image.jpeg',
        }),
      ).resolves.toEqual(schemas[0]);
    });

    it('returns a schema matching an IRI query field.', async(): Promise<void> => {
      schemas = [{
        '@id': 'https://example.com/data/123',
        '@type': 'https://standardknowledge.com/ontologies/core/File',
        [SKL.integration]: { '@id': 'https://example.com/data/BoxIntegration' },
      }];
      adapter = new MemoryQueryAdapter({ type: 'memory', schemas });
      await expect(
        adapter.findBy({
          [SKL.integration]: 'https://example.com/data/BoxIntegration',
        }),
      ).resolves.toEqual(schemas[0]);
    });
  });

  describe('findAll', (): void => {
    it('returns an array of one schema by id.', async(): Promise<void> => {
      schemas = [{
        '@id': 'https://example.com/data/123',
        '@type': 'https://standardknowledge.com/ontologies/core/File',
      }];
      adapter = new MemoryQueryAdapter({ type: 'memory', schemas });
      await expect(
        adapter.findAll({
          where: {
            id: 'https://example.com/data/123',
          },
        }),
      ).resolves.toEqual([ schemas[0] ]);
    });

    it('returns an empty array if no schema matches the id field.', async(): Promise<void> => {
      schemas = [{
        '@id': 'https://example.com/data/123',
        '@type': 'https://standardknowledge.com/ontologies/core/File',
      }];
      adapter = new MemoryQueryAdapter({ type: 'memory', schemas });
      await expect(
        adapter.findAll({
          where: {
            id: 'https://example.com/data/127',
          },
        }),
      ).resolves.toEqual([]);
    });

    it('returns an array of schema matching all the query fields.', async(): Promise<void> => {
      schemas = [
        {
          '@id': 'https://example.com/data/123',
          '@type': 'https://standardknowledge.com/ontologies/core/File',
        },
        {
          '@id': 'https://example.com/data/124',
          '@type': 'https://standardknowledge.com/ontologies/core/File',
        },
      ];
      adapter = new MemoryQueryAdapter({ type: 'memory', schemas });
      await expect(
        adapter.findAll({
          where: {
            type: 'https://standardknowledge.com/ontologies/core/File',
          },
        }),
      ).resolves.toEqual([ schemas[0], schemas[1] ]);
    });

    it('returns an array of schema which are instances of a subclass of the type field of the query.',
      async(): Promise<void> => {
        schemas = [
          {
            '@id': 'https://example.com/data/123',
            '@type': 'https://standardknowledge.com/ontologies/core/File',
          },
          {
            '@id': 'https://example.com/data/124',
            '@type': 'https://standardknowledge.com/ontologies/core/Article',
          },
          {
            '@id': 'https://standardknowledge.com/ontologies/core/File',
            '@type': OWL.Class,
            [RDFS.subClassOf]: [
              { '@id': 'https://standardknowledge.com/ontologies/core/Noun' },
            ],
          },
          {
            '@id': 'https://standardknowledge.com/ontologies/core/Article',
            '@type': OWL.Class,
            [RDFS.subClassOf]: [
              { '@id': 'https://standardknowledge.com/ontologies/core/Noun' },
            ],
          },
        ];
        adapter = new MemoryQueryAdapter({ type: 'memory', schemas });
        await expect(
          adapter.findAll({
            where: {
              type: 'https://standardknowledge.com/ontologies/core/Noun',
            },
          }),
        ).resolves.toEqual([ schemas[0], schemas[1] ]);
      });

    it('returns the all entities if no where clause is provided.', async(): Promise<void> => {
      schemas = [{
        '@id': 'https://example.com/data/123',
        '@type': 'https://standardknowledge.com/ontologies/core/File',
      }];
      adapter = new MemoryQueryAdapter({ type: 'memory', schemas });
      await expect(adapter.findAll()).resolves.toEqual(schemas);
    });

    it('returns a limited number of entities.',
      async(): Promise<void> => {
        schemas = [
          {
            '@id': 'https://example.com/data/123',
            '@type': 'https://standardknowledge.com/ontologies/core/File',
          },
          {
            '@id': 'https://example.com/data/124',
            '@type': 'https://standardknowledge.com/ontologies/core/File',
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
            '@id': 'https://example.com/data/123',
            '@type': 'https://standardknowledge.com/ontologies/core/File',
          },
          {
            '@id': 'https://example.com/data/124',
            '@type': 'https://standardknowledge.com/ontologies/core/File',
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
            '@id': 'https://example.com/data/123',
            '@type': 'https://standardknowledge.com/ontologies/core/File',
          },
          {
            '@id': 'https://example.com/data/124',
            '@type': 'https://standardknowledge.com/ontologies/core/File',
          },
          {
            '@id': 'https://example.com/data/125',
            '@type': 'https://standardknowledge.com/ontologies/core/File',
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
          '@id': 'https://example.com/data/1',
          '@type': 'https://standardknowledge.com/ontologies/core/File',
        },
        {
          '@id': 'https://example.com/data/2',
          '@type': 'https://standardknowledge.com/ontologies/core/File',
          [RDFS.label]: 'image.jpeg',
        },
      ];
      adapter = new MemoryQueryAdapter({ type: 'memory', schemas });
      await expect(adapter.findAll({
        where: {
          [RDFS.label]: In([ 'image.jpeg' ]),
        },
      })).resolves.toEqual([ schemas[1] ]);
    });

    it('returns entities matching a not operator.', async(): Promise<void> => {
      schemas = [
        {
          '@id': 'https://example.com/data/1',
          '@type': 'https://standardknowledge.com/ontologies/core/File',
        },
        {
          '@id': 'https://example.com/data/2',
          '@type': 'https://standardknowledge.com/ontologies/core/File',
          [RDFS.label]: 'image.jpeg',
        },
      ];
      adapter = new MemoryQueryAdapter({ type: 'memory', schemas });
      await expect(adapter.findAll({
        where: {
          [RDFS.label]: Not('image.jpeg'),
        },
      })).resolves.toEqual([ schemas[0] ]);
    });

    it('returns entities matching a nested not in operator.', async(): Promise<void> => {
      schemas = [
        {
          '@id': 'https://example.com/data/1',
          '@type': 'https://standardknowledge.com/ontologies/core/File',
        },
        {
          '@id': 'https://example.com/data/2',
          '@type': 'https://standardknowledge.com/ontologies/core/File',
          [RDFS.label]: 'image.jpeg',
        },
      ];
      adapter = new MemoryQueryAdapter({ type: 'memory', schemas });
      await expect(adapter.findAll({
        where: {
          [RDFS.label]: Not(In([ 'image.jpeg' ])),
        },
      })).resolves.toEqual([ schemas[0] ]);
    });

    it('returns entities matching a nested not equal operator.', async(): Promise<void> => {
      schemas = [
        {
          '@id': 'https://example.com/data/1',
          '@type': 'https://standardknowledge.com/ontologies/core/File',
        },
        {
          '@id': 'https://example.com/data/2',
          '@type': 'https://standardknowledge.com/ontologies/core/File',
          [RDFS.label]: 'image.jpeg',
        },
      ];
      adapter = new MemoryQueryAdapter({ type: 'memory', schemas });
      await expect(adapter.findAll({
        where: {
          [RDFS.label]: Not(Equal('image.jpeg')),
        },
      })).resolves.toEqual([ schemas[0] ]);
    });

    it('returns entities matching an equal operator.', async(): Promise<void> => {
      schemas = [
        {
          '@id': 'https://example.com/data/1',
          '@type': 'https://standardknowledge.com/ontologies/core/File',
        },
        {
          '@id': 'https://example.com/data/2',
          '@type': 'https://standardknowledge.com/ontologies/core/File',
          [RDFS.label]: 'image.jpeg',
        },
      ];
      adapter = new MemoryQueryAdapter({ type: 'memory', schemas });
      await expect(adapter.findAll({
        where: {
          [RDFS.label]: Equal('image.jpeg'),
        },
      })).resolves.toEqual([ schemas[1] ]);
    });

    it('throws an error if there is an unsupported operation.', async(): Promise<void> => {
      schemas = [{
        '@id': 'https://example.com/data/1',
        '@type': 'https://standardknowledge.com/ontologies/core/File',
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

    it('does not support the gt operator.', async(): Promise<void> => {
      schemas = [
        {
          '@id': 'https://example.com/data/2',
          '@type': 'https://standardknowledge.com/ontologies/core/File',
          'https://example.com/rating': [
            { '@value': '3', '@type': XSD.integer },
          ],
        },
      ];
      adapter = new MemoryQueryAdapter({ type: 'memory', schemas });
      await expect(adapter.findAll({
        where: {
          'https://example.com/rating': GreaterThan(1),
        },
      })).resolves.toEqual([]);
    });

    it('does not support the gte operator.', async(): Promise<void> => {
      schemas = [
        {
          '@id': 'https://example.com/data/2',
          '@type': 'https://standardknowledge.com/ontologies/core/File',
          'https://example.com/rating': [
            { '@value': '3', '@type': XSD.integer },
          ],
        },
      ];
      adapter = new MemoryQueryAdapter({ type: 'memory', schemas });
      await expect(adapter.findAll({
        where: {
          'https://example.com/rating': GreaterThanOrEqual(1),
        },
      })).resolves.toEqual([]);
    });

    it('does not support the lt operator.', async(): Promise<void> => {
      schemas = [
        {
          '@id': 'https://example.com/data/2',
          '@type': 'https://standardknowledge.com/ontologies/core/File',
          'https://example.com/rating': [
            { '@value': '2', '@type': XSD.integer },
          ],
        },
      ];
      adapter = new MemoryQueryAdapter({ type: 'memory', schemas });
      await expect(adapter.findAll({
        where: {
          'https://example.com/rating': LessThan(3),
        },
      })).resolves.toEqual([]);
    });

    it('does not support the lte operator.', async(): Promise<void> => {
      schemas = [
        {
          '@id': 'https://example.com/data/2',
          '@type': 'https://standardknowledge.com/ontologies/core/File',
          'https://example.com/rating': [
            { '@value': '2', '@type': XSD.integer },
          ],
        },
      ];
      adapter = new MemoryQueryAdapter({ type: 'memory', schemas });
      await expect(adapter.findAll({
        where: {
          'https://example.com/rating': LessThanOrEqual(3),
        },
      })).resolves.toEqual([]);
    });

    it('does not support the inverse operator.', async(): Promise<void> => {
      schemas = [
        {
          '@id': 'https://example.com/data/2',
          '@type': 'https://standardknowledge.com/ontologies/core/File',
          'https://example.com/rating': [
            { '@value': '2', '@type': XSD.integer },
          ],
        },
      ];
      adapter = new MemoryQueryAdapter({ type: 'memory', schemas });
      await expect(adapter.findAll({
        where: {
          'https://example.com/rating': Inverse(2),
        },
      })).resolves.toEqual([]);
    });

    it('does not support the inverseRelation operator.', async(): Promise<void> => {
      schemas = [
        {
          '@id': 'https://example.com/data/2',
          '@type': 'https://standardknowledge.com/ontologies/core/File',
          'https://example.com/rating': [
            { '@value': '2', '@type': XSD.integer },
          ],
        },
      ];
      adapter = new MemoryQueryAdapter({ type: 'memory', schemas });
      await expect(adapter.findAll({
        where: {
          'https://example.com/rating': InverseRelation({ resolvedName: 'foobar' }),
        },
      })).resolves.toEqual([]);
    });
  });

  describe('findAllBy', (): void => {
    it('returns an array of one schema by id.', async(): Promise<void> => {
      schemas = [{
        '@id': 'https://example.com/data/123',
        '@type': 'https://standardknowledge.com/ontologies/core/File',
      }];
      adapter = new MemoryQueryAdapter({ type: 'memory', schemas });
      await expect(
        adapter.findAllBy({
          id: 'https://example.com/data/123',
        }),
      ).resolves.toEqual([ schemas[0] ]);
    });

    it('returns an empty array if no schema matches the id field.', async(): Promise<void> => {
      schemas = [{
        '@id': 'https://example.com/data/123',
        '@type': 'https://standardknowledge.com/ontologies/core/File',
      }];
      adapter = new MemoryQueryAdapter({ type: 'memory', schemas });
      await expect(
        adapter.findAllBy({
          id: 'https://example.com/data/127',
        }),
      ).resolves.toEqual([]);
    });

    it('returns an array of schema matching all the query fields.', async(): Promise<void> => {
      schemas = [
        {
          '@id': 'https://example.com/data/123',
          '@type': 'https://standardknowledge.com/ontologies/core/File',
        },
        {
          '@id': 'https://example.com/data/124',
          '@type': 'https://standardknowledge.com/ontologies/core/File',
        },
      ];
      adapter = new MemoryQueryAdapter({ type: 'memory', schemas });
      await expect(
        adapter.findAllBy({
          type: 'https://standardknowledge.com/ontologies/core/File',
        }),
      ).resolves.toEqual([ schemas[0], schemas[1] ]);
    });

    it('returns an array of schema which are instances of a subclass of the type field of the query.',
      async(): Promise<void> => {
        schemas = [
          {
            '@id': 'https://example.com/data/123',
            '@type': 'https://standardknowledge.com/ontologies/core/File',
          },
          {
            '@id': 'https://example.com/data/124',
            '@type': 'https://standardknowledge.com/ontologies/core/Article',
          },
          {
            '@id': 'https://standardknowledge.com/ontologies/core/File',
            '@type': OWL.Class,
            [RDFS.subClassOf]: [
              { '@id': 'https://standardknowledge.com/ontologies/core/Noun' },
            ],
          },
          {
            '@id': 'https://standardknowledge.com/ontologies/core/Article',
            '@type': OWL.Class,
            [RDFS.subClassOf]: [
              { '@id': 'https://standardknowledge.com/ontologies/core/Noun' },
            ],
          },
        ];
        adapter = new MemoryQueryAdapter({ type: 'memory', schemas });
        await expect(
          adapter.findAllBy({
            type: 'https://standardknowledge.com/ontologies/core/Noun',
          }),
        ).resolves.toEqual([ schemas[0], schemas[1] ]);
      });
  });

  describe('count', (): void => {
    it('is not supported.', async(): Promise<void> => {
      schemas = [{
        '@id': 'https://example.com/data/123',
        '@type': 'https://standardknowledge.com/ontologies/core/File',
      }];
      adapter = new MemoryQueryAdapter({ type: 'memory', schemas });
      await expect(
        adapter.count({ id: 'https://example.com/data/123' }),
      ).resolves.toBe(0);
    });
  });

  describe('save', (): void => {
    it('saves a single schema.', async(): Promise<void> => {
      schemas = [{
        '@id': 'https://standardknowledge.com/ontologies/core/File',
        '@type': 'https://standardknowledge.com/ontologies/core/Noun',
        [RDFS.label]: 'File',
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
          '@id': 'https://example.com/data/123',
          '@type': 'https://standardknowledge.com/ontologies/core/File',
        },
        {
          '@id': 'https://example.com/data/124',
          '@type': 'https://standardknowledge.com/ontologies/core/Article',
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
        '@id': 'https://example.com/data/123',
        '@type': 'https://standardknowledge.com/ontologies/core/File',
      };
      adapter = new MemoryQueryAdapter({ type: 'memory', schemas });
      await expect(adapter.destroy(entity))
        .rejects.toThrow('Entity with id https://example.com/data/123 does not exist.');
    });

    it('destroys a single schema.', async(): Promise<void> => {
      schemas = [{
        '@id': 'https://example.com/data/123',
        '@type': 'https://standardknowledge.com/ontologies/core/File',
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
          '@id': 'https://example.com/data/123',
          '@type': 'https://standardknowledge.com/ontologies/core/File',
        },
        {
          '@id': 'https://example.com/data/124',
          '@type': 'https://standardknowledge.com/ontologies/core/Article',
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

  describe('destroyAll', (): void => {
    it('destroys all the schema.', async(): Promise<void> => {
      schemas = [{
        '@id': 'https://example.com/data/123',
        '@type': 'https://standardknowledge.com/ontologies/core/File',
      }];
      adapter = new MemoryQueryAdapter({ type: 'memory', schemas });
      const res = await adapter.destroyAll();
      expect(res).toBeUndefined();
      await expect(
        adapter.findBy({ id: schemas[0]['@id'] }),
      ).resolves.toBeNull();
    });
  });
});
