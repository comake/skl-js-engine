/* eslint-disable @typescript-eslint/naming-convention */
import type { Readable } from 'stream';
import DataFactory from '@rdfjs/data-model';
import SparqlClient from 'sparql-http-client';
import { SparqlQueryAdapter } from '../../../../src/storage/sparql/SparqlQueryAdapter';
import { rdfTypeNamedNode } from '../../../../src/util/TripleUtil';
import { SKL, XSD } from '../../../../src/util/Vocabularies';
import { streamFrom } from '../../../util/Util';

const endpointUrl = 'https://example.com/sparql';
const file = DataFactory.namedNode(SKL.File);
const data1 = DataFactory.namedNode('https://example.com/data/1');
const data2 = DataFactory.namedNode('https://example.com/data/2');

jest.mock('sparql-http-client');

describe('a SparqlQueryAdapter', (): void => {
  let response: any = [];
  let select: any;
  let update: any;
  let ask: any;
  let error: any;
  let adapter: SparqlQueryAdapter;

  beforeEach(async(): Promise<void> => {
    response = [];
    error = null;
    select = jest.fn().mockImplementation(async(): Promise<Readable> => {
      if (error) {
        return {
          on(event, handler): void {
            if (event === 'error') {
              handler(error);
            }
          },
        } as Readable;
      }
      return streamFrom(response);
    });
    update = jest.fn();
    ask = jest.fn();
    (SparqlClient as unknown as jest.Mock).mockReturnValue({
      query: { select, update, ask },
    });
    adapter = new SparqlQueryAdapter({ type: 'sparql', endpointUrl });
  });

  describe('executeRawQuery', (): void => {
    it('executes a variable selection and returns an empty array if there are no results.', async(): Promise<void> => {
      await expect(
        adapter.executeRawQuery([
          'SELECT ?modifiedAt ?related',
          'WHERE {',
          '  {',
          '    SELECT ?modifiedAt ?related WHERE {',
          '     ?entity <http://purl.org/dc/terms/modified> ?modifiedAt',
          '     ?entity <https://example.com/related> ?related',
          '    }',
          '    LIMIT 1',
          '  }',
          '}',
        ].join('\n')),
      ).resolves.toEqual([]);
    });

    it('executes a variable selection and returns an array of values.', async(): Promise<void> => {
      response = [{
        modifiedAt: DataFactory.literal('2022-10-10T00:00:00.000Z', XSD.dateTime),
        related: DataFactory.namedNode('https://example.com/data/1'),
      }];
      await expect(
        adapter.executeRawQuery([
          'SELECT ?modifiedAt ?related',
          'WHERE {',
          '  {',
          '    SELECT ?modifiedAt ?related WHERE {',
          '     ?entity <http://purl.org/dc/terms/modified> ?modifiedAt',
          '     ?entity <https://example.com/related> ?related',
          '    }',
          '    LIMIT 1',
          '  }',
          '}',
        ].join('\n')),
      ).resolves.toEqual([
        {
          modifiedAt: '2022-10-10T00:00:00.000Z',
          related: 'https://example.com/data/1',
        },
      ]);
    });
  });

  describe('executeRawEntityQuery', (): void => {
    it('executes a sparql construct query and returns an empty GraphObject if no triples are found.',
      async(): Promise<void> => {
        await expect(
          adapter.executeRawEntityQuery([
            'CONSTRUCT { ?subject ?predicate ?object. }',
            'WHERE {',
            '  {',
            '    SELECT ?entity WHERE {',
            '      ?entity ?c1 ?c2.',
            '    }',
            '    LIMIT 1',
            '  }',
            '  GRAPH ?entity { ?subject ?predicate ?object. }',
            '}',
          ].join('\n')),
        ).resolves.toEqual({ '@graph': []});
        expect(select).toHaveBeenCalledTimes(1);
        expect(select.mock.calls[0][0].split('\n')).toEqual([
          'CONSTRUCT { ?subject ?predicate ?object. }',
          'WHERE {',
          '  {',
          '    SELECT ?entity WHERE {',
          '      ?entity ?c1 ?c2.',
          '    }',
          '    LIMIT 1',
          '  }',
          '  GRAPH ?entity { ?subject ?predicate ?object. }',
          '}',
        ]);
      });
    it('executes a sparql construct query and returns GraphObject with an array of Entities.',
      async(): Promise<void> => {
        response = [{
          subject: data1,
          predicate: rdfTypeNamedNode,
          object: file,
        }];
        await expect(
          adapter.executeRawEntityQuery([
            'CONSTRUCT { ?subject ?predicate ?object. }',
            'WHERE {',
            '  {',
            '    SELECT ?entity WHERE {',
            '      ?entity ?c1 ?c2.',
            '    }',
            '    LIMIT 1',
            '  }',
            '  GRAPH ?entity { ?subject ?predicate ?object. }',
            '}',
          ].join('\n')),
        ).resolves.toEqual({
          '@graph': [{
            '@id': 'https://example.com/data/1',
            '@type': 'https://skl.standard.storage/File',
          }],
        });
        expect(select).toHaveBeenCalledTimes(1);
        expect(select.mock.calls[0][0].split('\n')).toEqual([
          'CONSTRUCT { ?subject ?predicate ?object. }',
          'WHERE {',
          '  {',
          '    SELECT ?entity WHERE {',
          '      ?entity ?c1 ?c2.',
          '    }',
          '    LIMIT 1',
          '  }',
          '  GRAPH ?entity { ?subject ?predicate ?object. }',
          '}',
        ]);
      });
  });

  describe('count', (): void => {
    it('queries for the count of entities matching.', async(): Promise<void> => {
      response = [{ count: { value: 1 }}];
      await expect(
        adapter.count({
          id: 'https://example.com/data/1',
        }),
      ).resolves.toBe(1);
      expect(select).toHaveBeenCalledTimes(1);
      expect(select.mock.calls[0][0].split('\n')).toEqual([
        'SELECT (COUNT(DISTINCT ?entity) AS ?count) WHERE {',
        '  GRAPH ?entity {',
        '    ?entity ?c1 ?c2.',
        '    FILTER(?entity = <https://example.com/data/1>)',
        '  }',
        '}',
      ]);
    });

    it('throws an error when the sparql endpoint stream errors.', async(): Promise<void> => {
      error = new Error('Something bad happened');
      await expect(
        adapter.count({
          id: 'https://example.com/data/1',
        }),
      ).rejects.toThrow('Something bad happened');
      expect(select).toHaveBeenCalledTimes(1);
      expect(select.mock.calls[0][0].split('\n')).toEqual([
        'SELECT (COUNT(DISTINCT ?entity) AS ?count) WHERE {',
        '  GRAPH ?entity {',
        '    ?entity ?c1 ?c2.',
        '    FILTER(?entity = <https://example.com/data/1>)',
        '  }',
        '}',
      ]);
    });
  });

  describe('find', (): void => {
    it('queries for entities with a limit of 1 and returns null if there is not response.',
      async(): Promise<void> => {
        await expect(
          adapter.find({
            where: {
              id: 'https://example.com/data/1',
            },
          }),
        ).resolves.toBeNull();
        expect(select).toHaveBeenCalledTimes(1);
        expect(select.mock.calls[0][0].split('\n')).toEqual([
          'CONSTRUCT { ?subject ?predicate ?object. }',
          'WHERE {',
          '  {',
          '    SELECT ?entity WHERE {',
          '      ?entity ?c1 ?c2.',
          '      FILTER(?entity = <https://example.com/data/1>)',
          '    }',
          '    LIMIT 1',
          '  }',
          '  GRAPH ?entity { ?subject ?predicate ?object. }',
          '}',
        ]);
      });

    it('queries for entities with a limit of 1 and returns an entity if there is a response.',
      async(): Promise<void> => {
        response = [{
          subject: data1,
          predicate: rdfTypeNamedNode,
          object: file,
        }];
        await expect(
          adapter.find({
            where: {
              id: 'https://example.com/data/1',
            },
          }),
        ).resolves.toEqual({
          '@id': 'https://example.com/data/1',
          '@type': 'https://skl.standard.storage/File',
        });
        expect(select).toHaveBeenCalledTimes(1);
        expect(select.mock.calls[0][0].split('\n')).toEqual([
          'CONSTRUCT { ?subject ?predicate ?object. }',
          'WHERE {',
          '  {',
          '    SELECT ?entity WHERE {',
          '      ?entity ?c1 ?c2.',
          '      FILTER(?entity = <https://example.com/data/1>)',
          '    }',
          '    LIMIT 1',
          '  }',
          '  GRAPH ?entity { ?subject ?predicate ?object. }',
          '}',
        ]);
      });

    it('throws an error when the sparql endpoint stream errors.', async(): Promise<void> => {
      error = new Error('Something bad happened');
      await expect(
        adapter.find({
          where: {
            id: 'https://example.com/data/1',
          },
        }),
      ).rejects.toThrow('Something bad happened');
      expect(select).toHaveBeenCalledTimes(1);
      expect(select.mock.calls[0][0].split('\n')).toEqual([
        'CONSTRUCT { ?subject ?predicate ?object. }',
        'WHERE {',
        '  {',
        '    SELECT ?entity WHERE {',
        '      ?entity ?c1 ?c2.',
        '      FILTER(?entity = <https://example.com/data/1>)',
        '    }',
        '    LIMIT 1',
        '  }',
        '  GRAPH ?entity { ?subject ?predicate ?object. }',
        '}',
      ]);
    });
  });

  describe('findBy', (): void => {
    it('queries for entities with a limit of 1 and returns null if there is not response.',
      async(): Promise<void> => {
        await expect(
          adapter.findBy({ id: 'https://example.com/data/1' }),
        ).resolves.toBeNull();
        expect(select).toHaveBeenCalledTimes(1);
        expect(select.mock.calls[0][0].split('\n')).toEqual([
          'CONSTRUCT { ?subject ?predicate ?object. }',
          'WHERE {',
          '  {',
          '    SELECT ?entity WHERE {',
          '      ?entity ?c1 ?c2.',
          '      FILTER(?entity = <https://example.com/data/1>)',
          '    }',
          '    LIMIT 1',
          '  }',
          '  GRAPH ?entity { ?subject ?predicate ?object. }',
          '}',
        ]);
      });

    it('queries for entities with a limit of 1 and returns an entity if there is a response.',
      async(): Promise<void> => {
        response = [{
          subject: data1,
          predicate: rdfTypeNamedNode,
          object: file,
        }];
        await expect(
          adapter.findBy({ id: 'https://example.com/data/1' }),
        ).resolves.toEqual({
          '@id': 'https://example.com/data/1',
          '@type': 'https://skl.standard.storage/File',
        });
        expect(select).toHaveBeenCalledTimes(1);
        expect(select.mock.calls[0][0].split('\n')).toEqual([
          'CONSTRUCT { ?subject ?predicate ?object. }',
          'WHERE {',
          '  {',
          '    SELECT ?entity WHERE {',
          '      ?entity ?c1 ?c2.',
          '      FILTER(?entity = <https://example.com/data/1>)',
          '    }',
          '    LIMIT 1',
          '  }',
          '  GRAPH ?entity { ?subject ?predicate ?object. }',
          '}',
        ]);
      });
  });

  describe('findAll', (): void => {
    it('queries for entities and returns an empty array if there are no results.',
      async(): Promise<void> => {
        await expect(
          adapter.findAll({
            where: {
              type: SKL.File,
            },
          }),
        ).resolves.toEqual([]);
        expect(select).toHaveBeenCalledTimes(1);
        expect(select.mock.calls[0][0].split('\n')).toEqual([
          'CONSTRUCT { ?subject ?predicate ?object. }',
          'WHERE {',
          '  { SELECT ?entity WHERE { ?entity (<http://www.w3.org/1999/02/22-rdf-syntax-ns#type>/(<http://www.w3.org/2000/01/rdf-schema#subClassOf>*)) <https://skl.standard.storage/File>. } }',
          '  GRAPH ?entity { ?subject ?predicate ?object. }',
          '}',
        ]);
      });

    it('queries for entities and returns a list of entities if there are results.',
      async(): Promise<void> => {
        response = [
          {
            subject: data1,
            predicate: rdfTypeNamedNode,
            object: file,
          },
          {
            subject: data2,
            predicate: rdfTypeNamedNode,
            object: file,
          },
        ];
        await expect(
          adapter.findAll({
            where: {
              type: SKL.File,
            },
          }),
        ).resolves.toEqual([
          {
            '@id': 'https://example.com/data/1',
            '@type': 'https://skl.standard.storage/File',
          },
          {
            '@id': 'https://example.com/data/2',
            '@type': 'https://skl.standard.storage/File',
          },
        ]);
        expect(select).toHaveBeenCalledTimes(1);
        expect(select.mock.calls[0][0].split('\n')).toEqual([
          'CONSTRUCT { ?subject ?predicate ?object. }',
          'WHERE {',
          '  { SELECT ?entity WHERE { ?entity (<http://www.w3.org/1999/02/22-rdf-syntax-ns#type>/(<http://www.w3.org/2000/01/rdf-schema#subClassOf>*)) <https://skl.standard.storage/File>. } }',
          '  GRAPH ?entity { ?subject ?predicate ?object. }',
          '}',
        ]);
      });

    it('returns a list of one entity if there is one result.',
      async(): Promise<void> => {
        response = [{
          subject: data1,
          predicate: rdfTypeNamedNode,
          object: file,
        }];
        await expect(
          adapter.findAll({
            where: {
              type: SKL.File,
            },
          }),
        ).resolves.toEqual([{
          '@id': 'https://example.com/data/1',
          '@type': 'https://skl.standard.storage/File',
        }]);
        expect(select).toHaveBeenCalledTimes(1);
        expect(select.mock.calls[0][0].split('\n')).toEqual([
          'CONSTRUCT { ?subject ?predicate ?object. }',
          'WHERE {',
          '  { SELECT ?entity WHERE { ?entity (<http://www.w3.org/1999/02/22-rdf-syntax-ns#type>/(<http://www.w3.org/2000/01/rdf-schema#subClassOf>*)) <https://skl.standard.storage/File>. } }',
          '  GRAPH ?entity { ?subject ?predicate ?object. }',
          '}',
        ]);
      });

    it('executes an entity selection query then queries for entities if there is an order and a limit greater than 1.',
      async(): Promise<void> => {
        select.mockImplementationOnce(
          async(): Promise<Readable> => streamFrom([{ entity: data1 }, { entity: data2 }]),
        );
        response = [
          {
            subject: data1,
            predicate: rdfTypeNamedNode,
            object: file,
          },
          {
            subject: data2,
            predicate: rdfTypeNamedNode,
            object: file,
          },
        ];
        await expect(
          adapter.findAll({
            order: {
              'https://example.com/pred': 'asc',
            },
          }),
        ).resolves.toEqual([
          {
            '@id': 'https://example.com/data/1',
            '@type': 'https://skl.standard.storage/File',
          },
          {
            '@id': 'https://example.com/data/2',
            '@type': 'https://skl.standard.storage/File',
          },
        ]);
        expect(select).toHaveBeenCalledTimes(2);
        expect(select.mock.calls[0][0].split('\n')).toEqual([
          'SELECT ?entity WHERE {',
          '  ?entity ?c1 ?c2.',
          '  OPTIONAL { ?entity <https://example.com/pred> ?c3. }',
          '}',
          'ORDER BY (?c3)',
        ]);
        expect(select.mock.calls[1][0].split('\n')).toEqual([
          'CONSTRUCT { ?subject ?predicate ?object. }',
          'WHERE {',
          '  FILTER(?entity IN(<https://example.com/data/1>, <https://example.com/data/2>))',
          '  GRAPH ?entity { ?subject ?predicate ?object. }',
          '}',
        ]);
      });
  });

  describe('findAllBy', (): void => {
    it('queries for entities and returns an empty array if there are no results.',
      async(): Promise<void> => {
        await expect(
          adapter.findAllBy({ type: SKL.File }),
        ).resolves.toEqual([]);
        expect(select).toHaveBeenCalledTimes(1);
        expect(select.mock.calls[0][0].split('\n')).toEqual([
          'CONSTRUCT { ?subject ?predicate ?object. }',
          'WHERE {',
          '  { SELECT ?entity WHERE { ?entity (<http://www.w3.org/1999/02/22-rdf-syntax-ns#type>/(<http://www.w3.org/2000/01/rdf-schema#subClassOf>*)) <https://skl.standard.storage/File>. } }',
          '  GRAPH ?entity { ?subject ?predicate ?object. }',
          '}',
        ]);
      });

    it('queries for entities and returns a list of entities if there are results.',
      async(): Promise<void> => {
        response = [
          {
            subject: data1,
            predicate: rdfTypeNamedNode,
            object: file,
          },
          {
            subject: data2,
            predicate: rdfTypeNamedNode,
            object: file,
          },
        ];
        await expect(
          adapter.findAllBy({ type: SKL.File }),
        ).resolves.toEqual([
          {
            '@id': 'https://example.com/data/1',
            '@type': 'https://skl.standard.storage/File',
          },
          {
            '@id': 'https://example.com/data/2',
            '@type': 'https://skl.standard.storage/File',
          },
        ]);
        expect(select).toHaveBeenCalledTimes(1);
        expect(select.mock.calls[0][0].split('\n')).toEqual([
          'CONSTRUCT { ?subject ?predicate ?object. }',
          'WHERE {',
          '  { SELECT ?entity WHERE { ?entity (<http://www.w3.org/1999/02/22-rdf-syntax-ns#type>/(<http://www.w3.org/2000/01/rdf-schema#subClassOf>*)) <https://skl.standard.storage/File>. } }',
          '  GRAPH ?entity { ?subject ?predicate ?object. }',
          '}',
        ]);
      });
  });

  describe('exists', (): void => {
    it('querues for the existence of an entity matching the where parameter.', async(): Promise<void> => {
      ask.mockReturnValue(true);
      await expect(adapter.exists({ type: SKL.File })).resolves.toBe(true);
    });
  });

  describe('save', (): void => {
    it('saves a single schema.', async(): Promise<void> => {
      const entity = {
        '@id': 'https://example.com/data/1',
        '@type': 'https://skl.standard.storage/File',
      };
      await expect(adapter.save(entity)).resolves.toEqual(entity);
      expect(update).toHaveBeenCalledTimes(1);
      expect(update.mock.calls[0][0].split('\n')).toEqual([
        'DELETE WHERE { GRAPH <https://example.com/data/1> { ?c1 ?c2 ?c3. } };',
        'INSERT DATA { GRAPH <https://example.com/data/1> { <https://example.com/data/1> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <https://skl.standard.storage/File>. } }',
      ]);
    });
    it('saves multiple schema.', async(): Promise<void> => {
      const entities = [
        {
          '@id': 'https://example.com/data/1',
          '@type': 'https://skl.standard.storage/File',
        },
        {
          '@id': 'https://example.com/data/2',
          '@type': 'https://skl.standard.storage/Article',
        },
      ];
      await expect(adapter.save(entities)).resolves.toEqual(entities);
      expect(update).toHaveBeenCalledTimes(1);
      expect(update.mock.calls[0][0].split('\n')).toEqual([
        'DELETE WHERE {',
        '  GRAPH <https://example.com/data/1> { ?c1 ?c2 ?c3. }',
        '  GRAPH <https://example.com/data/2> { ?c4 ?c5 ?c6. }',
        '};',
        'INSERT DATA {',
        '  GRAPH <https://example.com/data/1> { <https://example.com/data/1> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <https://skl.standard.storage/File>. }',
        '  GRAPH <https://example.com/data/2> { <https://example.com/data/2> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <https://skl.standard.storage/Article>. }',
        '}',
      ]);
    });
  });

  describe('destroy', (): void => {
    it('destroys a single schema.', async(): Promise<void> => {
      const entity = {
        '@id': 'https://example.com/data/1',
        '@type': 'https://skl.standard.storage/File',
      };
      await expect(adapter.destroy(entity)).resolves.toEqual(entity);
      expect(update).toHaveBeenCalledTimes(1);
      expect(update.mock.calls[0][0].split('\n')).toEqual([
        'DELETE WHERE { GRAPH <https://example.com/data/1> { ?c1 ?c2 ?c3. } }',
      ]);
    });

    it('destroys multiple schema.', async(): Promise<void> => {
      const entities = [
        {
          '@id': 'https://example.com/data/1',
          '@type': 'https://skl.standard.storage/File',
        },
        {
          '@id': 'https://example.com/data/2',
          '@type': 'https://skl.standard.storage/Article',
        },
      ];
      await expect(adapter.destroy(entities)).resolves.toEqual(entities);
      expect(update).toHaveBeenCalledTimes(1);
      expect(update.mock.calls[0][0].split('\n')).toEqual([
        'DELETE WHERE {',
        '  GRAPH <https://example.com/data/1> { ?c1 ?c2 ?c3. }',
        '  GRAPH <https://example.com/data/2> { ?c4 ?c5 ?c6. }',
        '}',
      ]);
    });
  });

  describe('destroyAll', (): void => {
    it('destroys all schema.', async(): Promise<void> => {
      await expect(adapter.destroyAll()).resolves.toBeUndefined();
      expect(update).toHaveBeenCalledTimes(1);
      expect(update.mock.calls[0][0].split('\n')).toEqual([
        'DELETE WHERE { ?subject ?predicate ?object. }',
      ]);
    });
  });
});
