/* eslint-disable @typescript-eslint/naming-convention */
import type { Readable } from 'stream';
import DataFactory from '@rdfjs/data-model';
import SparqlClient from 'sparql-http-client';
import { InverseRelation } from '../../../../../src/storage/operator/InverseRelation';
import { SparqlQueryAdapter } from '../../../../../src/storage/query-adapter/sparql/SparqlQueryAdapter';
import { rdfTypeNamedNode } from '../../../../../src/util/SparqlUtil';
import { DCTERMS, SKL, SKL_V2, XSD } from '../../../../../src/util/Vocabularies';
import { streamFrom } from '../../../../util/Util';

const endpointUrl = 'https://example.com/sparql';
const file = DataFactory.namedNode(SKL.File);
const data1 = DataFactory.namedNode('https://example.com/data/1');
const data2 = DataFactory.namedNode('https://example.com/data/2');
const predicate = DataFactory.namedNode('https://example.com/pred');

jest.mock('sparql-http-client');

describe('a SparqlQueryAdapter', (): void => {
  let response: any = [];
  let select: any;
  let update: any;
  let ask: any;
  let error: any;
  let adapter: SparqlQueryAdapter;

  beforeEach(async (): Promise<void> => {
    response = [];
    error = null;
    select = jest.fn().mockImplementation(async (): Promise<Readable> => {
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
    it('executes a variable selection and returns an empty array if there are no results.', async (): Promise<void> => {
      await expect(
        adapter.executeRawQuery(
          [
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
          ].join('\n'),
        ),
      ).resolves.toEqual([]);
    });

    it('executes a variable selection and returns an array of values.', async (): Promise<void> => {
      response = [
        {
          modifiedAt: DataFactory.literal('2022-10-10T00:00:00.000Z', XSD.dateTime),
          related: DataFactory.namedNode('https://example.com/data/1'),
        },
      ];
      await expect(
        adapter.executeRawQuery(
          [
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
          ].join('\n'),
        ),
      ).resolves.toEqual([
        {
          modifiedAt: '2022-10-10T00:00:00.000Z',
          related: 'https://example.com/data/1',
        },
      ]);
    });
  });

  describe('executeRawUpdate', (): void => {
    it('executes a an update query.', async (): Promise<void> => {
      await expect(
        adapter.executeRawUpdate(
          [
            `DELETE { GRAPH <https://example.com/data/1> { <https://example.com/data/1> <${SKL.sourceId}> ?c1. } }`,
            `INSERT { GRAPH <https://example.com/data/1> { <https://example.com/data/1> <${SKL.sourceId}> "abc123". } }`,
            'USING <https://example.com/data/1>',
            `WHERE { OPTIONAL { <https://example.com/data/1> <${SKL.sourceId}> ?c1. } }`,
          ].join('\n'),
        ),
      ).resolves.toBeUndefined();
    });
  });

  describe('executeRawConstructQuery', (): void => {
    it('executes a sparql construct query and returns an empty GraphObject if no triples are found.', async (): Promise<void> => {
      await expect(
        adapter.executeRawConstructQuery(
          [
            'CONSTRUCT { ?subject ?predicate ?object. }',
            'WHERE {',
            '  {',
            '    SELECT DISTINCT ?entity WHERE {',
            '      ?entity ?c1 ?c2.',
            '    }',
            '    LIMIT 1',
            '  }',
            '  GRAPH ?entity { ?subject ?predicate ?object. }',
            '}',
          ].join('\n'),
        ),
      ).resolves.toEqual({ '@graph': [] });
      expect(select).toHaveBeenCalledTimes(1);
      expect(select.mock.calls[0][0].split('\n')).toEqual([
        'CONSTRUCT { ?subject ?predicate ?object. }',
        'WHERE {',
        '  {',
        '    SELECT DISTINCT ?entity WHERE {',
        '      ?entity ?c1 ?c2.',
        '    }',
        '    LIMIT 1',
        '  }',
        '  GRAPH ?entity { ?subject ?predicate ?object. }',
        '}',
      ]);
    });
    it('executes a sparql construct query and returns GraphObject with an array of Entities.', async (): Promise<void> => {
      response = [
        {
          subject: data1,
          predicate: rdfTypeNamedNode,
          object: file,
        },
      ];
      await expect(
        adapter.executeRawConstructQuery(
          [
            'CONSTRUCT { ?subject ?predicate ?object. }',
            'WHERE {',
            '  {',
            '    SELECT DISTINCT ?entity WHERE {',
            '      ?entity ?c1 ?c2.',
            '    }',
            '    LIMIT 1',
            '  }',
            '  GRAPH ?entity { ?subject ?predicate ?object. }',
            '}',
          ].join('\n'),
        ),
      ).resolves.toEqual({
        '@graph': [
          {
            '@id': 'https://example.com/data/1',
            '@type': 'https://standardknowledge.com/ontologies/core/File',
          },
        ],
      });
      expect(select).toHaveBeenCalledTimes(1);
      expect(select.mock.calls[0][0].split('\n')).toEqual([
        'CONSTRUCT { ?subject ?predicate ?object. }',
        'WHERE {',
        '  {',
        '    SELECT DISTINCT ?entity WHERE {',
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
    it('queries for the count of entities matching an id.', async (): Promise<void> => {
      response = [{ count: { value: 1 } }];
      await expect(
        adapter.count({
          where: { id: 'https://example.com/data/1' },
        }),
      ).resolves.toBe(1);
      expect(select).toHaveBeenCalledTimes(1);
      expect(select.mock.calls[0][0].split('\n')).toEqual([
        'SELECT (COUNT(DISTINCT ?entity) AS ?count) WHERE {',
        '  VALUES ?entity {',
        '    <https://example.com/data/1>',
        '  }',
        '}',
      ]);
    });

    it('queries for the count of entities matching.', async (): Promise<void> => {
      response = [{ count: { value: 1 } }];
      await expect(
        adapter.count({
          where: { 'https://example.com/pred': 'https://example.com/data/1' },
        }),
      ).resolves.toBe(1);
      expect(select).toHaveBeenCalledTimes(1);
      expect(select.mock.calls[0][0].split('\n')).toEqual([
        'SELECT (COUNT(DISTINCT ?entity) AS ?count) WHERE {',
        '  ?entity <https://example.com/pred> <https://example.com/data/1>.',
        '  FILTER(EXISTS { GRAPH ?entity { ?entity ?c1 ?c2. } })',
        '}',
      ]);
    });

    it('throws an error when the sparql endpoint stream errors.', async (): Promise<void> => {
      error = new Error('Something bad happened');
      await expect(
        adapter.count({
          where: { id: 'https://example.com/data/1' },
        }),
      ).rejects.toThrow('Something bad happened');
      expect(select).toHaveBeenCalledTimes(1);
      expect(select.mock.calls[0][0].split('\n')).toEqual([
        'SELECT (COUNT(DISTINCT ?entity) AS ?count) WHERE {',
        '  VALUES ?entity {',
        '    <https://example.com/data/1>',
        '  }',
        '}',
      ]);
    });
  });

  describe('find', (): void => {
    it('queries for entities with a limit of 1 and returns null if there is not response.', async (): Promise<void> => {
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
        '  VALUES ?entity {',
        '    <https://example.com/data/1>',
        '  }',
        '  GRAPH ?entity { ?subject ?predicate ?object. }',
        '}',
      ]);
    });

    it('queries for entities with a limit of 1 and returns an entity if there is a response.', async (): Promise<void> => {
      response = [
        {
          subject: data1,
          predicate: rdfTypeNamedNode,
          object: file,
        },
      ];
      await expect(
        adapter.find({
          where: {
            id: 'https://example.com/data/1',
          },
        }),
      ).resolves.toEqual({
        '@id': 'https://example.com/data/1',
        '@type': 'https://standardknowledge.com/ontologies/core/File',
      });
      expect(select).toHaveBeenCalledTimes(1);
      expect(select.mock.calls[0][0].split('\n')).toEqual([
        'CONSTRUCT { ?subject ?predicate ?object. }',
        'WHERE {',
        '  VALUES ?entity {',
        '    <https://example.com/data/1>',
        '  }',
        '  GRAPH ?entity { ?subject ?predicate ?object. }',
        '}',
      ]);
    });

    it('queries for entities with a limit of 1 and returns an entity if there is a response array of one.', async (): Promise<void> => {
      response = [
        {
          subject: data1,
          predicate: rdfTypeNamedNode,
          object: file,
        },
        {
          subject: data2,
          predicate,
          object: data1,
        },
        {
          subject: data2,
          predicate: rdfTypeNamedNode,
          object: file,
        },
      ];
      await expect(
        adapter.find({
          where: {
            id: 'https://example.com/data/1',
          },
          relations: {
            'https://example.com/pred': InverseRelation({
              resolvedName: 'https://example.com/inversePred',
            }),
          },
        }),
      ).resolves.toEqual({
        '@id': 'https://example.com/data/1',
        '@type': 'https://standardknowledge.com/ontologies/core/File',
        'https://example.com/inversePred': {
          '@id': 'https://example.com/data/2',
          '@type': 'https://standardknowledge.com/ontologies/core/File',
          'https://example.com/pred': {
            '@id': 'https://example.com/data/1',
          },
        },
      });
      expect(select).toHaveBeenCalledTimes(1);
      expect(select.mock.calls[0][0].split('\n')).toEqual([
        'CONSTRUCT {',
        '  ?subject ?predicate ?object.',
        '  ?c2 ?c3 ?c4.',
        '}',
        'WHERE {',
        '  VALUES ?entity {',
        '    <https://example.com/data/1>',
        '  }',
        '  OPTIONAL {',
        '    ?entity ^<https://example.com/pred> ?c1.',
        '    GRAPH ?c1 { ?c2 ?c3 ?c4. }',
        '  }',
        '  GRAPH ?entity { ?subject ?predicate ?object. }',
        '}',
      ]);
    });

    it('returns an unframed graph if skipFraming is set to true.', async (): Promise<void> => {
      response = [
        {
          subject: data1,
          predicate: rdfTypeNamedNode,
          object: file,
        },
        {
          subject: data2,
          predicate,
          object: data1,
        },
        {
          subject: data2,
          predicate: rdfTypeNamedNode,
          object: file,
        },
      ];
      await expect(
        adapter.find({
          where: {
            id: 'https://example.com/data/1',
          },
          relations: {
            'https://example.com/pred': InverseRelation({
              resolvedName: 'https://example.com/inversePred',
            }),
          },
          skipFraming: true,
        }),
      ).resolves.toEqual([
        {
          '@id': 'https://example.com/data/1',
          '@type': 'https://standardknowledge.com/ontologies/core/File',
        },
        {
          '@id': 'https://example.com/data/2',
          '@type': 'https://standardknowledge.com/ontologies/core/File',
          'https://example.com/pred': {
            '@id': 'https://example.com/data/1',
          },
        },
      ]);
      expect(select).toHaveBeenCalledTimes(1);
      expect(select.mock.calls[0][0].split('\n')).toEqual([
        'CONSTRUCT {',
        '  ?subject ?predicate ?object.',
        '  ?c2 ?c3 ?c4.',
        '}',
        'WHERE {',
        '  VALUES ?entity {',
        '    <https://example.com/data/1>',
        '  }',
        '  OPTIONAL {',
        '    ?entity ^<https://example.com/pred> ?c1.',
        '    GRAPH ?c1 { ?c2 ?c3 ?c4. }',
        '  }',
        '  GRAPH ?entity { ?subject ?predicate ?object. }',
        '}',
      ]);
    });

    it('throws an error when the sparql endpoint stream errors.', async (): Promise<void> => {
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
        '  VALUES ?entity {',
        '    <https://example.com/data/1>',
        '  }',
        '  GRAPH ?entity { ?subject ?predicate ?object. }',
        '}',
      ]);
    });
  });

  describe('findBy', (): void => {
    it('queries for entities with a limit of 1 and returns null if there is not response.', async (): Promise<void> => {
      await expect(adapter.findBy({ id: 'https://example.com/data/1' })).resolves.toBeNull();
      expect(select).toHaveBeenCalledTimes(1);
      expect(select.mock.calls[0][0].split('\n')).toEqual([
        'CONSTRUCT { ?subject ?predicate ?object. }',
        'WHERE {',
        '  VALUES ?entity {',
        '    <https://example.com/data/1>',
        '  }',
        '  GRAPH ?entity { ?subject ?predicate ?object. }',
        '}',
      ]);
    });

    it('queries for entities with a limit of 1 and returns an entity if there is a response.', async (): Promise<void> => {
      response = [
        {
          subject: data1,
          predicate: rdfTypeNamedNode,
          object: file,
        },
      ];
      await expect(adapter.findBy({ id: 'https://example.com/data/1' })).resolves.toEqual({
        '@id': 'https://example.com/data/1',
        '@type': 'https://standardknowledge.com/ontologies/core/File',
      });
      expect(select).toHaveBeenCalledTimes(1);
      expect(select.mock.calls[0][0].split('\n')).toEqual([
        'CONSTRUCT { ?subject ?predicate ?object. }',
        'WHERE {',
        '  VALUES ?entity {',
        '    <https://example.com/data/1>',
        '  }',
        '  GRAPH ?entity { ?subject ?predicate ?object. }',
        '}',
      ]);
    });
  });

  describe('findAll', (): void => {
    it('queries for entities and returns an empty array if there are no results.', async (): Promise<void> => {
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
        '  {',
        '    SELECT DISTINCT ?entity WHERE {',
        '      ?entity (<http://www.w3.org/1999/02/22-rdf-syntax-ns#type>/(<http://www.w3.org/2000/01/rdf-schema#subClassOf>*)) <https://standardknowledge.com/ontologies/core/File>.',
        '      FILTER(EXISTS { GRAPH ?entity { ?entity ?c1 ?c2. } })',
        '    }',
        '  }',
        '  GRAPH ?entity { ?subject ?predicate ?object. }',
        '}',
      ]);
    });

    it('queries for entities and returns a list of entities if there are results.', async (): Promise<void> => {
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
          '@type': 'https://standardknowledge.com/ontologies/core/File',
        },
        {
          '@id': 'https://example.com/data/2',
          '@type': 'https://standardknowledge.com/ontologies/core/File',
        },
      ]);
      expect(select).toHaveBeenCalledTimes(1);
      expect(select.mock.calls[0][0].split('\n')).toEqual([
        'CONSTRUCT { ?subject ?predicate ?object. }',
        'WHERE {',
        '  {',
        '    SELECT DISTINCT ?entity WHERE {',
        '      ?entity (<http://www.w3.org/1999/02/22-rdf-syntax-ns#type>/(<http://www.w3.org/2000/01/rdf-schema#subClassOf>*)) <https://standardknowledge.com/ontologies/core/File>.',
        '      FILTER(EXISTS { GRAPH ?entity { ?entity ?c1 ?c2. } })',
        '    }',
        '  }',
        '  GRAPH ?entity { ?subject ?predicate ?object. }',
        '}',
      ]);
    });

    it('returns a list of one entity if there is one result.', async (): Promise<void> => {
      response = [
        {
          subject: data1,
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
          '@type': 'https://standardknowledge.com/ontologies/core/File',
        },
      ]);
      expect(select).toHaveBeenCalledTimes(1);
      expect(select.mock.calls[0][0].split('\n')).toEqual([
        'CONSTRUCT { ?subject ?predicate ?object. }',
        'WHERE {',
        '  {',
        '    SELECT DISTINCT ?entity WHERE {',
        '      ?entity (<http://www.w3.org/1999/02/22-rdf-syntax-ns#type>/(<http://www.w3.org/2000/01/rdf-schema#subClassOf>*)) <https://standardknowledge.com/ontologies/core/File>.',
        '      FILTER(EXISTS { GRAPH ?entity { ?entity ?c1 ?c2. } })',
        '    }',
        '  }',
        '  GRAPH ?entity { ?subject ?predicate ?object. }',
        '}',
      ]);
    });

    it('executes an entity selection query then queries for entities if there is an order and a limit greater than 1.', async (): Promise<void> => {
      select.mockImplementationOnce(async (): Promise<Readable> => streamFrom([{ entity: data1 }, { entity: data2 }]));
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
          '@type': 'https://standardknowledge.com/ontologies/core/File',
        },
        {
          '@id': 'https://example.com/data/2',
          '@type': 'https://standardknowledge.com/ontologies/core/File',
        },
      ]);
      expect(select).toHaveBeenCalledTimes(2);
      expect(select.mock.calls[0][0].split('\n')).toEqual([
        'SELECT DISTINCT ?entity (?c1 AS ?c4) WHERE {',
        '  GRAPH ?entity { ?entity ?c2 ?c3. }',
        '  OPTIONAL { ?entity <https://example.com/pred> ?c1. }',
        '}',
        'ORDER BY (?c4) (?entity)',
      ]);
      expect(select.mock.calls[1][0].split('\n')).toEqual([
        'CONSTRUCT { ?subject ?predicate ?object. }',
        'WHERE {',
        '  VALUES ?entity {',
        '    <https://example.com/data/1>',
        '    <https://example.com/data/2>',
        '  }',
        '  GRAPH ?entity { ?subject ?predicate ?object. }',
        '}',
      ]);
    });

    // It('xxx',
    //   async(): Promise<void> => {
    //     select.mockImplementationOnce(
    //       async(): Promise<Readable> => streamFrom([{ entity: data1 }, { entity: data2 }]),
    //     );
    //     await expect(
    //       adapter.findAll({
    //         "where": {
    //             "type": "https://schema.org/Article"
    //         },
    //         "order": {
    //             "https://skl.so/item2": {
    //                 "type": "operator",
    //                 "operator": "inverseRelationOrder",
    //                 "value": {
    //                     "order": {
    //                         "https://skl.so/score": "desc"
    //                     },
    //                     "where": {
    //                         "https://skl.so/item1": "https://acvb.standard.storage/data/db59e892-9fb0-4f7d-9535-cd3f047cf018"
    //                     }
    //                 }
    //             }
    //         },
    //         "limit": 10
    //     }),
    //     )
    //     expect(select).toHaveBeenCalledTimes(2);
    //     expect(select.mock.calls[0][0].split('\n')).toEqual([
    //       'SELECT DISTINCT ?entity (?c1 AS ?c4) WHERE {',
    //       '  GRAPH ?entity { ?entity ?c2 ?c3. }',
    //       '  OPTIONAL { ?entity <https://example.com/pred> ?c1. }',
    //       '}',
    //       'ORDER BY (?c4) (?entity)',
    //     ]);
    //     expect(select.mock.calls[1][0].split('\n')).toEqual([
    //       'CONSTRUCT { ?subject ?predicate ?object. }',
    //       'WHERE {',
    //       '  VALUES ?entity {',
    //       '    <https://example.com/data/1>',
    //       '    <https://example.com/data/2>',
    //       '  }',
    //       '  GRAPH ?entity { ?subject ?predicate ?object. }',
    //       '}',
    //     ]);
    //   });

    it('executes an entity selection query then returns en empty array if there are no selected entity results.', async (): Promise<void> => {
      select.mockImplementationOnce(async (): Promise<Readable> => streamFrom([]));
      await expect(
        adapter.findAll({
          order: {
            'https://example.com/pred': 'asc',
          },
        }),
      ).resolves.toEqual([]);
      expect(select).toHaveBeenCalledTimes(1);
      expect(select.mock.calls[0][0].split('\n')).toEqual([
        'SELECT DISTINCT ?entity (?c1 AS ?c4) WHERE {',
        '  GRAPH ?entity { ?entity ?c2 ?c3. }',
        '  OPTIONAL { ?entity <https://example.com/pred> ?c1. }',
        '}',
        'ORDER BY (?c4) (?entity)',
      ]);
    });

    it('returns unframed json-ld if skipFraming is set to true.', async (): Promise<void> => {
      const blankNode = DataFactory.blankNode('c1');
      response = [
        {
          subject: data1,
          predicate: rdfTypeNamedNode,
          object: file,
        },
        {
          subject: data1,
          predicate,
          object: blankNode,
        },
        {
          subject: blankNode,
          predicate: rdfTypeNamedNode,
          object: DataFactory.namedNode('https://example.com/OtherType'),
        },
      ];
      await expect(
        adapter.findAll({
          where: {
            type: SKL.File,
          },
          skipFraming: true,
        }),
      ).resolves.toEqual([
        {
          '@id': 'https://example.com/data/1',
          '@type': 'https://standardknowledge.com/ontologies/core/File',
          'https://example.com/pred': {
            '@id': '_:c1',
          },
        },
        {
          '@id': '_:c1',
          '@type': 'https://example.com/OtherType',
        },
      ]);
      expect(select).toHaveBeenCalledTimes(1);
      expect(select.mock.calls[0][0].split('\n')).toEqual([
        'CONSTRUCT { ?subject ?predicate ?object. }',
        'WHERE {',
        '  {',
        '    SELECT DISTINCT ?entity WHERE {',
        '      ?entity (<http://www.w3.org/1999/02/22-rdf-syntax-ns#type>/(<http://www.w3.org/2000/01/rdf-schema#subClassOf>*)) <https://standardknowledge.com/ontologies/core/File>.',
        '      FILTER(EXISTS { GRAPH ?entity { ?entity ?c1 ?c2. } })',
        '    }',
        '  }',
        '  GRAPH ?entity { ?subject ?predicate ?object. }',
        '}',
      ]);
    });

    it('executes a group by query with custom entity select variable.', async (): Promise<void> => {
      await adapter.findAll({
        where: {
          type: 'https://schema.org/Place',
          'https://standardknowledge.com/ontologies/core/deduplicationGroup': '?deduplicationGroup',
        },
        group: DataFactory.variable('deduplicationGroup'),
        entitySelectVariable: {
          variable: DataFactory.variable('entity'),
          expression: {
            type: 'aggregate',
            aggregation: 'MIN',
            expression: DataFactory.variable('entity'),
          },
        },
      });
      expect(select).toHaveBeenCalledTimes(1);
      expect(select.mock.calls[0][0].split('\n')).toEqual([
        'CONSTRUCT { ?subject ?predicate ?object. }',
        'WHERE {',
        '  {',
        '    SELECT DISTINCT (MIN(?entity) AS ?entity) WHERE {',
        '      ?entity (<http://www.w3.org/1999/02/22-rdf-syntax-ns#type>/(<http://www.w3.org/2000/01/rdf-schema#subClassOf>*)) <https://schema.org/Place>;',
        '        <https://standardknowledge.com/ontologies/core/deduplicationGroup> ?deduplicationGroup.',
        '      FILTER(EXISTS { GRAPH ?entity { ?entity ?c1 ?c2. } })',
        '    }',
        '    GROUP BY ?deduplicationGroup',
        '  }',
        '  GRAPH ?entity { ?subject ?predicate ?object. }',
        '}',
      ]);
    });
  });

  it('executes a subquery.', async (): Promise<void> => {
    await adapter.findAll({
      where: {
        type: 'https://schema.org/Place',
      },
      subQueries: [
        {
          select: [
            DataFactory.variable('deduplicationGroup'),
            {
              variable: DataFactory.variable('entity'),
              expression: {
                type: 'aggregate',
                aggregation: 'MIN',
                expression: DataFactory.variable('entity'),
              },
            },
          ],
          where: {
            'https://standardknowledge.com/ontologies/core/deduplicationGroup': '?deduplicationGroup',
          },
          groupBy: ['deduplicationGroup'],
        },
      ],
    });
    expect(select.mock.calls[0][0].split('\n')).toEqual([
      'CONSTRUCT { ?subject ?predicate ?object. }',
      'WHERE {',
      '  {',
      '    SELECT DISTINCT ?entity WHERE {',
      '      {',
      '        SELECT ?deduplicationGroup (MIN(?entity) AS ?entity) WHERE { ?entity <https://standardknowledge.com/ontologies/core/deduplicationGroup> ?deduplicationGroup. }',
      '        GROUP BY ?deduplicationGroup',
      '      }',
      '      ?entity (<http://www.w3.org/1999/02/22-rdf-syntax-ns#type>/(<http://www.w3.org/2000/01/rdf-schema#subClassOf>*)) <https://schema.org/Place>.',
      '      FILTER(EXISTS { GRAPH ?entity { ?entity ?c1 ?c2. } })',
      '    }',
      '  }',
      '  GRAPH ?entity { ?subject ?predicate ?object. }',
      '}',
    ]);
  });

  describe('findAllBy', (): void => {
    it('queries for entities and returns an empty array if there are no results.', async (): Promise<void> => {
      await expect(adapter.findAllBy({ type: SKL.File })).resolves.toEqual([]);
      expect(select).toHaveBeenCalledTimes(1);
      expect(select.mock.calls[0][0].split('\n')).toEqual([
        'CONSTRUCT { ?subject ?predicate ?object. }',
        'WHERE {',
        '  {',
        '    SELECT DISTINCT ?entity WHERE {',
        '      ?entity (<http://www.w3.org/1999/02/22-rdf-syntax-ns#type>/(<http://www.w3.org/2000/01/rdf-schema#subClassOf>*)) <https://standardknowledge.com/ontologies/core/File>.',
        '      FILTER(EXISTS { GRAPH ?entity { ?entity ?c1 ?c2. } })',
        '    }',
        '  }',
        '  GRAPH ?entity { ?subject ?predicate ?object. }',
        '}',
      ]);
    });

    it('queries for entities and returns a list of entities if there are results.', async (): Promise<void> => {
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
      await expect(adapter.findAllBy({ type: SKL.File })).resolves.toEqual([
        {
          '@id': 'https://example.com/data/1',
          '@type': 'https://standardknowledge.com/ontologies/core/File',
        },
        {
          '@id': 'https://example.com/data/2',
          '@type': 'https://standardknowledge.com/ontologies/core/File',
        },
      ]);
      expect(select).toHaveBeenCalledTimes(1);
      expect(select.mock.calls[0][0].split('\n')).toEqual([
        'CONSTRUCT { ?subject ?predicate ?object. }',
        'WHERE {',
        '  {',
        '    SELECT DISTINCT ?entity WHERE {',
        '      ?entity (<http://www.w3.org/1999/02/22-rdf-syntax-ns#type>/(<http://www.w3.org/2000/01/rdf-schema#subClassOf>*)) <https://standardknowledge.com/ontologies/core/File>.',
        '      FILTER(EXISTS { GRAPH ?entity { ?entity ?c1 ?c2. } })',
        '    }',
        '  }',
        '  GRAPH ?entity { ?subject ?predicate ?object. }',
        '}',
      ]);
    });
  });

  describe('exists', (): void => {
    it('queries for the existence of an entity matching the where parameter.', async (): Promise<void> => {
      ask.mockReturnValue(true);
      await expect(adapter.exists({ where: { type: SKL.File } })).resolves.toBe(true);
    });
  });

  describe('save', (): void => {
    it('saves a single schema.', async (): Promise<void> => {
      const entity = {
        '@id': 'https://example.com/data/1',
        '@type': 'https://standardknowledge.com/ontologies/core/File',
      };
      await expect(adapter.save(entity)).resolves.toEqual(entity);
      expect(update).toHaveBeenCalledTimes(1);
      expect(update.mock.calls[0][0].split('\n')).toEqual([
        'CLEAR SILENT GRAPH <https://example.com/data/1>;',
        'INSERT DATA { GRAPH <https://example.com/data/1> { <https://example.com/data/1> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <https://standardknowledge.com/ontologies/core/File>. } }',
      ]);
    });

    it('saves a single schema with setTimestamps on.', async (): Promise<void> => {
      adapter = new SparqlQueryAdapter({ type: 'sparql', endpointUrl, setTimestamps: true });
      const entity = {
        '@id': 'https://example.com/data/1',
        '@type': 'https://standardknowledge.com/ontologies/core/File',
      };
      await expect(adapter.save(entity)).resolves.toEqual(entity);
      expect(update).toHaveBeenCalledTimes(1);
      expect(update.mock.calls[0][0].split('\n')).toEqual([
        'CLEAR SILENT GRAPH <https://example.com/data/1>;',
        'INSERT DATA { GRAPH <https://example.com/data/1> { <https://example.com/data/1> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <https://standardknowledge.com/ontologies/core/File>. } };',
        'INSERT {',
        '  GRAPH <https://example.com/data/1> {',
        `    <https://example.com/data/1> <${SKL_V2.dateCreated}> ?now.`,
        `    <https://example.com/data/1> <${SKL_V2.dateModified}> ?now.`,
        '  }',
        '}',
        'WHERE { BIND(NOW() AS ?now) }',
      ]);
    });

    it('saves multiple schema.', async (): Promise<void> => {
      const entities = [
        {
          '@id': 'https://example.com/data/1',
          '@type': 'https://standardknowledge.com/ontologies/core/File',
        },
        {
          '@id': 'https://example.com/data/2',
          '@type': 'https://standardknowledge.com/ontologies/core/Article',
        },
      ];
      await expect(adapter.save(entities)).resolves.toEqual(entities);
      expect(update).toHaveBeenCalledTimes(1);
      expect(update.mock.calls[0][0].split('\n')).toEqual([
        'CLEAR SILENT GRAPH <https://example.com/data/1>;',
        'CLEAR SILENT GRAPH <https://example.com/data/2>;',
        'INSERT DATA {',
        '  GRAPH <https://example.com/data/1> { <https://example.com/data/1> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <https://standardknowledge.com/ontologies/core/File>. }',
        '  GRAPH <https://example.com/data/2> { <https://example.com/data/2> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <https://standardknowledge.com/ontologies/core/Article>. }',
        '}',
      ]);
    });
  });

  describe('update', (): void => {
    it('updates a schema by attribute.', async (): Promise<void> => {
      await expect(adapter.update('https://example.com/data/1', { [SKL.sourceId]: 'abc123' })).resolves.toBeUndefined();
      expect(update).toHaveBeenCalledTimes(1);
      expect(update.mock.calls[0][0].split('\n')).toEqual([
        `DELETE { GRAPH <https://example.com/data/1> { <https://example.com/data/1> <${SKL.sourceId}> ?c1. } }`,
        `INSERT { GRAPH <https://example.com/data/1> { <https://example.com/data/1> <${SKL.sourceId}> "abc123". } }`,
        'USING <https://example.com/data/1>',
        `WHERE { OPTIONAL { <https://example.com/data/1> <${SKL.sourceId}> ?c1. } }`,
      ]);
    });

    it('updates a schema with setTimestamps on.', async (): Promise<void> => {
      adapter = new SparqlQueryAdapter({ type: 'sparql', endpointUrl, setTimestamps: true });
      await expect(adapter.update('https://example.com/data/1', { [SKL.sourceId]: 'abc123' })).resolves.toBeUndefined();
      expect(update).toHaveBeenCalledTimes(1);
      expect(update.mock.calls[0][0].split('\n')).toEqual([
        `DELETE { GRAPH <https://example.com/data/1> { <https://example.com/data/1> <${SKL.sourceId}> ?c1. } }`,
        `INSERT { GRAPH <https://example.com/data/1> { <https://example.com/data/1> <${SKL.sourceId}> "abc123". } }`,
        'USING <https://example.com/data/1>',
        `WHERE { OPTIONAL { <https://example.com/data/1> <${SKL.sourceId}> ?c1. } };`,
        `DELETE { GRAPH <https://example.com/data/1> { <https://example.com/data/1> <${DCTERMS.modified}> ?c2. } }`,
        `INSERT { GRAPH <https://example.com/data/1> { <https://example.com/data/1> <${DCTERMS.modified}> ?now. } }`,
        'USING <https://example.com/data/1>',
        `WHERE {`,
        `  OPTIONAL { <https://example.com/data/1> <${DCTERMS.modified}> ?c2. }`,
        '  BIND(NOW() AS ?now)',
        '}',
      ]);
    });

    it('updates multiple schemas by attribute.', async (): Promise<void> => {
      await expect(
        adapter.update(['https://example.com/data/1', 'https://example.com/data/2'], { [SKL.sourceId]: 'abc123' }),
      ).resolves.toBeUndefined();
      expect(update).toHaveBeenCalledTimes(1);
      expect(update.mock.calls[0][0].split('\n')).toEqual([
        `DELETE { GRAPH <https://example.com/data/1> { <https://example.com/data/1> <${SKL.sourceId}> ?c1. } }`,
        `INSERT { GRAPH <https://example.com/data/1> { <https://example.com/data/1> <${SKL.sourceId}> "abc123". } }`,
        'USING <https://example.com/data/1>',
        `WHERE { OPTIONAL { <https://example.com/data/1> <${SKL.sourceId}> ?c1. } };`,
        `DELETE { GRAPH <https://example.com/data/2> { <https://example.com/data/2> <${SKL.sourceId}> ?c2. } }`,
        `INSERT { GRAPH <https://example.com/data/2> { <https://example.com/data/2> <${SKL.sourceId}> "abc123". } }`,
        'USING <https://example.com/data/2>',
        `WHERE { OPTIONAL { <https://example.com/data/2> <${SKL.sourceId}> ?c2. } }`,
      ]);
    });
  });

  describe('delete', (): void => {
    it('deletes a single schema.', async (): Promise<void> => {
      const entityId = 'https://example.com/data/1';
      await expect(adapter.delete(entityId)).resolves.toBeUndefined();
      expect(update).toHaveBeenCalledTimes(1);
      expect(update.mock.calls[0][0].split('\n')).toEqual([`DROP SILENT GRAPH <${entityId}>`]);
    });

    it('deletes multiple schema.', async (): Promise<void> => {
      const entityIds = ['https://example.com/data/1', 'https://example.com/data/2'];
      await expect(adapter.delete(entityIds)).resolves.toBeUndefined();
      expect(update).toHaveBeenCalledTimes(1);
      expect(update.mock.calls[0][0].split('\n')).toEqual([
        `DROP SILENT GRAPH <${entityIds[0]}>;`,
        `DROP SILENT GRAPH <${entityIds[1]}>`,
      ]);
    });
  });

  describe('destroy', (): void => {
    it('destroys a single schema.', async (): Promise<void> => {
      const entity = {
        '@id': 'https://example.com/data/1',
        '@type': 'https://standardknowledge.com/ontologies/core/File',
      };
      await expect(adapter.destroy(entity)).resolves.toEqual(entity);
      expect(update).toHaveBeenCalledTimes(1);
      expect(update.mock.calls[0][0].split('\n')).toEqual(['DROP SILENT GRAPH <https://example.com/data/1>']);
    });

    it('destroys multiple schema.', async (): Promise<void> => {
      const entities = [
        {
          '@id': 'https://example.com/data/1',
          '@type': 'https://standardknowledge.com/ontologies/core/File',
        },
        {
          '@id': 'https://example.com/data/2',
          '@type': 'https://standardknowledge.com/ontologies/core/Article',
        },
      ];
      await expect(adapter.destroy(entities)).resolves.toEqual(entities);
      expect(update).toHaveBeenCalledTimes(1);
      expect(update.mock.calls[0][0].split('\n')).toEqual([
        'DROP SILENT GRAPH <https://example.com/data/1>;',
        'DROP SILENT GRAPH <https://example.com/data/2>',
      ]);
    });
  });

  describe('destroyAll', (): void => {
    it('destroys all schema.', async (): Promise<void> => {
      await expect(adapter.destroyAll()).resolves.toBeUndefined();
      expect(update).toHaveBeenCalledTimes(1);
      expect(update.mock.calls[0][0].split('\n')).toEqual(['DROP SILENT ALL']);
    });
  });
});
