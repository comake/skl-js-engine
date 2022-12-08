/* eslint-disable @typescript-eslint/naming-convention */
import type { Readable } from 'stream';
import DataFactory from '@rdfjs/data-model';
import SparqlClient from 'sparql-http-client';
import { SparqlQueryAdapter } from '../../../../src/storage/sparql/SparqlQueryAdapter';
import { rdfTypeNamedNode } from '../../../../src/util/TripleUtil';
import { SKL } from '../../../../src/util/Vocabularies';
import { streamFrom } from '../../../util/Util';

const sparqlEndpointUrl = 'https://example.com/sparql';
const file = DataFactory.namedNode(SKL.File);
const data1 = DataFactory.namedNode('https://example.com/data/1');
const data2 = DataFactory.namedNode('https://example.com/data/2');

jest.mock('sparql-http-client');

describe('a SparqlQueryAdapter', (): void => {
  let response: any[] = [];
  let select: any;
  let update: any;
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
    (SparqlClient as unknown as jest.Mock).mockReturnValue({
      query: { select, update },
    });
    adapter = new SparqlQueryAdapter({ endpointUrl: sparqlEndpointUrl });
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
          '  GRAPH ?entity { ?subject ?predicate ?object. }',
          '  {',
          '    SELECT ?entity WHERE {',
          '      ?entity ?c1 ?c2.',
          '      FILTER(?entity = <https://example.com/data/1>)',
          '    }',
          '    LIMIT 1',
          '  }',
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
          '@type': 'https://skl.standard.storage/nouns/File',
        });
        expect(select).toHaveBeenCalledTimes(1);
        expect(select.mock.calls[0][0].split('\n')).toEqual([
          'CONSTRUCT { ?subject ?predicate ?object. }',
          'WHERE {',
          '  GRAPH ?entity { ?subject ?predicate ?object. }',
          '  {',
          '    SELECT ?entity WHERE {',
          '      ?entity ?c1 ?c2.',
          '      FILTER(?entity = <https://example.com/data/1>)',
          '    }',
          '    LIMIT 1',
          '  }',
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
        '  GRAPH ?entity { ?subject ?predicate ?object. }',
        '  {',
        '    SELECT ?entity WHERE {',
        '      ?entity ?c1 ?c2.',
        '      FILTER(?entity = <https://example.com/data/1>)',
        '    }',
        '    LIMIT 1',
        '  }',
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
          '  GRAPH ?entity { ?subject ?predicate ?object. }',
          '  {',
          '    SELECT ?entity WHERE {',
          '      ?entity ?c1 ?c2.',
          '      FILTER(?entity = <https://example.com/data/1>)',
          '    }',
          '    LIMIT 1',
          '  }',
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
          '@type': 'https://skl.standard.storage/nouns/File',
        });
        expect(select).toHaveBeenCalledTimes(1);
        expect(select.mock.calls[0][0].split('\n')).toEqual([
          'CONSTRUCT { ?subject ?predicate ?object. }',
          'WHERE {',
          '  GRAPH ?entity { ?subject ?predicate ?object. }',
          '  {',
          '    SELECT ?entity WHERE {',
          '      ?entity ?c1 ?c2.',
          '      FILTER(?entity = <https://example.com/data/1>)',
          '    }',
          '    LIMIT 1',
          '  }',
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
          '  GRAPH ?entity { ?subject ?predicate ?object. }',
          '  { SELECT ?entity WHERE { ?entity (<http://www.w3.org/1999/02/22-rdf-syntax-ns#type>/(<http://www.w3.org/2000/01/rdf-schema#subClassOf>*)) <https://skl.standard.storage/nouns/File>. } }',
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
            '@type': 'https://skl.standard.storage/nouns/File',
          },
          {
            '@id': 'https://example.com/data/2',
            '@type': 'https://skl.standard.storage/nouns/File',
          },
        ]);
        expect(select).toHaveBeenCalledTimes(1);
        expect(select.mock.calls[0][0].split('\n')).toEqual([
          'CONSTRUCT { ?subject ?predicate ?object. }',
          'WHERE {',
          '  GRAPH ?entity { ?subject ?predicate ?object. }',
          '  { SELECT ?entity WHERE { ?entity (<http://www.w3.org/1999/02/22-rdf-syntax-ns#type>/(<http://www.w3.org/2000/01/rdf-schema#subClassOf>*)) <https://skl.standard.storage/nouns/File>. } }',
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
          '  GRAPH ?entity { ?subject ?predicate ?object. }',
          '  { SELECT ?entity WHERE { ?entity (<http://www.w3.org/1999/02/22-rdf-syntax-ns#type>/(<http://www.w3.org/2000/01/rdf-schema#subClassOf>*)) <https://skl.standard.storage/nouns/File>. } }',
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
            '@type': 'https://skl.standard.storage/nouns/File',
          },
          {
            '@id': 'https://example.com/data/2',
            '@type': 'https://skl.standard.storage/nouns/File',
          },
        ]);
        expect(select).toHaveBeenCalledTimes(1);
        expect(select.mock.calls[0][0].split('\n')).toEqual([
          'CONSTRUCT { ?subject ?predicate ?object. }',
          'WHERE {',
          '  GRAPH ?entity { ?subject ?predicate ?object. }',
          '  { SELECT ?entity WHERE { ?entity (<http://www.w3.org/1999/02/22-rdf-syntax-ns#type>/(<http://www.w3.org/2000/01/rdf-schema#subClassOf>*)) <https://skl.standard.storage/nouns/File>. } }',
          '}',
        ]);
      });
  });

  describe('save', (): void => {
    it('saves a single schema.', async(): Promise<void> => {
      const entity = {
        '@id': 'https://example.com/data/1',
        '@type': 'https://skl.standard.storage/nouns/File',
      };
      await expect(adapter.save(entity)).resolves.toEqual(entity);
      expect(update).toHaveBeenCalledTimes(1);
      expect(update.mock.calls[0][0].split('\n')).toEqual([
        'DELETE WHERE { GRAPH <https://example.com/data/1> { ?c1 ?c2 ?c3. } };',
        'INSERT DATA { GRAPH <https://example.com/data/1> { <https://example.com/data/1> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <https://skl.standard.storage/nouns/File>. } }',
      ]);
    });
    it('saves multiple schema.', async(): Promise<void> => {
      const entities = [
        {
          '@id': 'https://example.com/data/1',
          '@type': 'https://skl.standard.storage/nouns/File',
        },
        {
          '@id': 'https://example.com/data/2',
          '@type': 'https://skl.standard.storage/nouns/Article',
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
        '  GRAPH <https://example.com/data/1> { <https://example.com/data/1> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <https://skl.standard.storage/nouns/File>. }',
        '  GRAPH <https://example.com/data/2> { <https://example.com/data/2> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <https://skl.standard.storage/nouns/Article>. }',
        '}',
      ]);
    });
  });

  describe('destroy', (): void => {
    it('destroys a single schema.', async(): Promise<void> => {
      const entity = {
        '@id': 'https://example.com/data/1',
        '@type': 'https://skl.standard.storage/nouns/File',
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
          '@type': 'https://skl.standard.storage/nouns/File',
        },
        {
          '@id': 'https://example.com/data/2',
          '@type': 'https://skl.standard.storage/nouns/Article',
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
});
