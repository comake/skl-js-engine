/* eslint-disable @typescript-eslint/naming-convention */
import { MemoryQueryAdapter } from '../../../src/storage/MemoryQueryAdapter';
import { SKL, RDFS, OWL } from '../../../src/util/Vocabularies';

describe('a MemoryQueryAdapter', (): void => {
  const schema = [
    {
      '@id': 'https://skl.standard.storage/data/123',
      '@type': 'https://skl.standard.storage/nouns/File',
    },
    {
      '@id': 'https://skl.standard.storage/data/124',
      '@type': 'https://skl.standard.storage/nouns/File',
      [SKL.nameProperty]: 'image.jpeg',
      [SKL.integrationProperty]: { '@id': 'https://skl.standard.storage/data/BoxIntegration' },
    },
    {
      '@id': 'https://skl.standard.storage/data/125',
      '@type': 'https://skl.standard.storage/nouns/Article',
      [SKL.nameProperty]: 'Delicious recipe',
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
    {
      '@id': 'https://skl.standard.storage/nouns/Noun',
      '@type': OWL.class,
    },
  ];
  let adapter: MemoryQueryAdapter;

  beforeEach(async(): Promise<void> => {
    adapter = new MemoryQueryAdapter(schema);
  });

  describe('finding a schema', (): void => {
    it('returns a schema by id.', async(): Promise<void> => {
      await expect(adapter.find({ id: 'https://skl.standard.storage/data/123' }))
        .resolves.toEqual(schema[0]);
    });

    it('returns undefined if not all query fields match.', async(): Promise<void> => {
      await expect(adapter.find({ id: 'https://skl.standard.storage/data/123', [SKL.nameProperty]: 'image.jpeg' }))
        .resolves.toBeUndefined();
    });

    it('returns a schema matching all the query fields.', async(): Promise<void> => {
      await expect(adapter.find({ [SKL.nameProperty]: 'image.jpeg' }))
        .resolves.toEqual(schema[1]);
    });

    it('returns a schema matching an IRI query field.', async(): Promise<void> => {
      await expect(adapter.find({ [SKL.integrationProperty]: 'https://skl.standard.storage/data/BoxIntegration' }))
        .resolves.toEqual(schema[1]);
    });
  });

  describe('finding multiple schema', (): void => {
    it('returns an array of one schema by id.', async(): Promise<void> => {
      await expect(adapter.findAll({ id: 'https://skl.standard.storage/data/123' }))
        .resolves.toEqual([ schema[0] ]);
    });

    it('returns an empty array if no schema matches the id field.', async(): Promise<void> => {
      await expect(adapter.findAll({ id: 'https://skl.standard.storage/data/127' }))
        .resolves.toEqual([]);
    });

    it('returns an array of schema matching all the query fields.', async(): Promise<void> => {
      await expect(adapter.findAll({ type: 'https://skl.standard.storage/nouns/File' }))
        .resolves.toEqual([ schema[0], schema[1] ]);
    });

    it('returns an array of schema which are instances of a subclass of the type field of the query.',
      async(): Promise<void> => {
        await expect(adapter.findAll({ type: 'https://skl.standard.storage/nouns/Noun' }))
          .resolves.toEqual([ schema[0], schema[1], schema[2] ]);
      });
  });

  describe('creating a schema', (): void => {
    it('returns a saved schema.', async(): Promise<void> => {
      const res = await adapter.create({ '@type': 'https://skl.standard.storage/nouns/Verb' });
      expect(res['@id']).toMatch(/https:\/\/skl.standard.storage\/data\/[\d+-_/A-Za-z%]+/u);
    });
  });

  describe('updating a schema', (): void => {
    it('returns the updated schema.', async(): Promise<void> => {
      const res = await adapter.update({
        '@id': 'https://skl.standard.storage/nouns/File',
        [SKL.nameProperty]: 'File',
      });
      expect(res).toEqual({
        '@id': 'https://skl.standard.storage/nouns/File',
        '@type': OWL.class,
        [RDFS.subClassOf]: [
          { '@id': 'https://skl.standard.storage/nouns/Noun' },
        ],
        [SKL.nameProperty]: 'File',
      });
    });
  });
});
