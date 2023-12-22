/* eslint-disable @typescript-eslint/naming-convention */
import { OpenApiOperationExecutor } from '@comake/openapi-operation-executor';
import { RR } from '@comake/rmlmapper-js';
import { AxiosError } from 'axios';
import type { NodeObject } from 'jsonld';
import { SKLEngine } from '../../src/SklEngine';
import type { SklEngineOptions } from '../../src/SklEngineOptions';
import { SparqlQueryAdapter } from '../../src/storage/query-adapter/sparql/SparqlQueryAdapter';
import type { QueryAdapterType } from '../../src/storage/query-adapter/sparql/SparqlQueryAdapterOptions';
import type { Callbacks } from '../../src/util/Types';
import { SKL, RDFS, XSD, SKL_ENGINE } from '../../src/util/Vocabularies';
import simpleMapping from '../assets/schemas/simple-mapping.json';
import { frameAndCombineSchemas, expandJsonLd } from '../util/Util';

jest.mock('@comake/openapi-operation-executor');

// eslint-disable-next-line max-len
const URI_REGEXP = /(?:(?:[^:/?#\s]+:)?(?:\/\/)?[^/?#\s]*\.(?:com|org|net|edu|gov|int|xyz|io|cn|tk|de|top|info|icu|online|site|co|club|shop|biz|ch|vip|loan|store|work|live|buzz|af|ax|al|dz|as|ad|ao|ai|aq|ag|ar|am|aw|ac|au|at|az|bs|bh|bd|bb|eus|by|be|bz|bj|bm|bt|bo|bq|an|ba|bw|bv|br|io|vg|bn|bg|bf|mm|bi|kh|cm|ca|cv|cat|ky|cf|td|cl|cn|cx|cc|co|km|cd|cg|ck|cr|ci|hr|cu|cw|cy|cz|dk|dj|dm|do|tl|tp|ec|eg|sv|gq|er|ee|et|eu|fk|fo|fm|fj|fi|fr|gf|pf|tf|ga|gal|gm|ps|ge|de|gh|gi|gr|gl|gd|gp|gu|gt|gg|gn|gw|gy|ht|hm|hn|hk|hu|is|in|id|ir|iq|ie|im|il|it|jm|jp|je|jo|kz|ke|ki|kw|kg|la|lv|lb|ls|lr|ly|li|lt|lu|mo|mk|mg|mw|my|mv|ml|mt|mh|mq|mr|mu|yt|mx|md|mc|mn|me|ms|ma|mz|mm|na|nr|np|nl|nc|nz|ni|ne|ng|nu|nf|nc|tr|kp|mp|no|om|pk|pw|ps|pa|pg|py|pe|ph|pn|pl|pt|pr|qa|ro|ru|rw|re|bq|an|bl|gp|fr|sh|kn|lc|mf|gp|fr|pm|vc|ws|sm|st|sa|sn|rs|sc|sl|sg|bq|an|sx|an|sk|si|sb|so|so|za|gs|kr|ss|es|lk|sd|sr|sj|sz|se|ch|sy|tw|tj|tz|th|tg|tk|to|tt|tn|tr|tm|tc|tv|ug|ua|ae|uk|us|vi|uy|uz|vu|va|ve|vn|wf|eh|ma|ye|zm|zw)[^?#\s]*(?:\?[^#\s]*)?(?:#[^\s]*)?)|(?:(?:[^:/?#\s]+:)(?:\/\/)[^/?#\s]*\.[^?#\s]*(?:\?[^#\s]*)?(?:#[^\s]*)?)/gu;
const account = 'https://example.com/data/DropboxAccount1';
const mockDropboxFile = {
  '.tag': 'file',
  client_modified: '2015-05-12T15:50:38Z',
  content_hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  has_explicit_shared_members: false,
  id: 'id:12345',
  is_downloadable: true,
  name: 'Prime_Numbers.txt',
  path_display: '/Homework/math/Prime_Numbers.txt',
  path_lower: '/homework/math/prime_numbers.txt',
  server_modified: '2015-05-12T15:50:38Z',
  size: 7212,
};

const expectedGetFileResponse = {
  '@id': 'https://example.com/data/abc123',
  '@type': 'https://standardknowledge.com/ontologies/core/File',
  'https://standardknowledge.com/ontologies/core/deleted': {
    '@type': 'http://www.w3.org/2001/XMLSchema#boolean',
    '@value': false,
  },
  'https://standardknowledge.com/ontologies/core/integration': {
    '@id': 'https://example.com/integrations/Dropbox',
  },
  'https://standardknowledge.com/ontologies/core/isWeblink': {
    '@type': 'http://www.w3.org/2001/XMLSchema#boolean',
    '@value': false,
  },
  'https://standardknowledge.com/ontologies/core/mimeType': 'text/plain',
  'http://www.w3.org/2000/01/rdf-schema#label': 'Prime_Numbers.txt',
  'https://standardknowledge.com/ontologies/core/size': {
    '@type': 'http://www.w3.org/2001/XMLSchema#integer',
    '@value': 7212,
  },
  'https://standardknowledge.com/ontologies/core/sourceId': 'id:12345',
};

const incorrectReturnValueMapping = {
  '@type': 'http://www.w3.org/ns/r2rml#TriplesMap',
  'http://semweb.mmlab.be/ns/rml#logicalSource': {
    '@type': 'http://semweb.mmlab.be/ns/rml#LogicalSource',
    'http://semweb.mmlab.be/ns/rml#iterator': '$.data',
    'http://semweb.mmlab.be/ns/rml#referenceFormulation': { '@id': 'http://semweb.mmlab.be/ns/ql#JSONPath' },
    'http://semweb.mmlab.be/ns/rml#source': 'input.json',
  },
  'http://www.w3.org/ns/r2rml#predicateObjectMap': [
    {
      '@type': 'http://www.w3.org/ns/r2rml#PredicateObjectMap',
      'http://www.w3.org/ns/r2rml#object': { '@id': 'https://example.com/integrations/Dropbox' },
      'http://www.w3.org/ns/r2rml#predicate': { '@id': 'https://standardknowledge.com/ontologies/core/Integration' },
    },
  ],
  'http://www.w3.org/ns/r2rml#subjectMap': {
    '@type': 'http://www.w3.org/ns/r2rml#SubjectMap',
    'http://www.w3.org/ns/r2rml#template': 'https://example.com/data/abc123',
    'http://www.w3.org/ns/r2rml#class': { '@id': 'https://standardknowledge.com/ontologies/core/File' },
  },
};

describe('SKLEngine', (): void => {
  let schemas: any[];

  it('throws an error if schemas or a sparql endpoint are not supplied.', async(): Promise<void> => {
    expect((): void => {
      // eslint-disable-next-line no-new
      new SKLEngine(
        {
          type: 'postgres' as QueryAdapterType,
        } as SklEngineOptions,
      );
    }).toThrow('No schema source found in setSchema args.');
  });

  describe('Memory', (): void => {
    it('initializes.', async(): Promise<void> => {
      expect(new SKLEngine({ type: 'memory' })).toBeInstanceOf(SKLEngine);
    });
  });

  describe('Sparql', (): void => {
    it('initializes.', async(): Promise<void> => {
      const sparqlEndpoint = 'https://localhost:9999';
      expect(new SKLEngine({ type: 'sparql', endpointUrl: sparqlEndpoint })).toBeInstanceOf(SKLEngine);
    });
  });

  describe('CRUD on schemas', (): void => {
    let sklEngine: SKLEngine;

    beforeEach(async(): Promise<void> => {
      schemas = [{
        '@id': 'https://standardknowledge.com/ontologies/core/Share',
        '@type': 'https://standardknowledge.com/ontologies/core/Verb',
      }];
      sklEngine = new SKLEngine({ type: 'memory' });
      await sklEngine.save(schemas);
    });

    afterEach((): void => {
      jest.restoreAllMocks();
    });

    describe('executeRawQuery', (): void => {
      it('delegates calls to executeRawQuery to the query adapter.', async(): Promise<void> => {
        const executeRawQuerySpy = jest.spyOn(SparqlQueryAdapter.prototype, 'executeRawQuery');
        await expect(sklEngine.executeRawQuery('')).resolves.toEqual([]);
        expect(executeRawQuerySpy).toHaveBeenCalledTimes(1);
        expect(executeRawQuerySpy).toHaveBeenCalledWith('');
      });
    });

    describe('executeRawUpdate', (): void => {
      it('delegates calls to executeRawUpdate to the query adapter.', async(): Promise<void> => {
        const executeRawUpdateSpy = jest.spyOn(SparqlQueryAdapter.prototype, 'executeRawUpdate');
        await expect(
          sklEngine.executeRawUpdate(`DELETE { ?s ?p ?o } WHERE { ?s ?p ?o }`),
        ).resolves.toBeUndefined();
        expect(executeRawUpdateSpy).toHaveBeenCalledTimes(1);
        expect(executeRawUpdateSpy).toHaveBeenCalledWith(`DELETE { ?s ?p ?o } WHERE { ?s ?p ?o }`);
      });
    });

    describe('executeRawConstructQuery', (): void => {
      it('delegates calls to executeRawConstructQuery to the query adapter.', async(): Promise<void> => {
        const executeRawConstructQuerySpy = jest.spyOn(SparqlQueryAdapter.prototype, 'executeRawConstructQuery');
        await expect(sklEngine.executeRawConstructQuery(
          'CONSTRUCT { ?s ?p ?o } WHERE { ?s ?p ?o}',
          {},
        )).resolves.toEqual({ '@graph': schemas });
        expect(executeRawConstructQuerySpy).toHaveBeenCalledTimes(1);
        expect(executeRawConstructQuerySpy).toHaveBeenCalledWith('CONSTRUCT { ?s ?p ?o } WHERE { ?s ?p ?o}', {});
      });
    });

    describe('find', (): void => {
      it('delegates calls to find to the query adapter.', async(): Promise<void> => {
        const findSpy = jest.spyOn(SparqlQueryAdapter.prototype, 'find');
        await expect(sklEngine.find({ where: { id: 'https://standardknowledge.com/ontologies/core/Share' }})).resolves.toEqual(schemas[0]);
        expect(findSpy).toHaveBeenCalledTimes(1);
        expect(findSpy).toHaveBeenCalledWith({ where: { id: 'https://standardknowledge.com/ontologies/core/Share' }});
      });

      it('throws an error if there is no schema matching the query during find.', async(): Promise<void> => {
        const findSpy = jest.spyOn(SparqlQueryAdapter.prototype, 'find');
        await expect(sklEngine.find({ where: { id: 'https://standardknowledge.com/ontologies/core/Send' }})).rejects.toThrow(
          'No schema found with fields matching {"where":{"id":"https://standardknowledge.com/ontologies/core/Send"}}',
        );
        expect(findSpy).toHaveBeenCalledTimes(1);
        expect(findSpy).toHaveBeenCalledWith({ where: { id: 'https://standardknowledge.com/ontologies/core/Send' }});
      });
    });

    describe('findBy', (): void => {
      it('delegates calls to findBy to the query adapter.', async(): Promise<void> => {
        const findBySpy = jest.spyOn(SparqlQueryAdapter.prototype, 'findBy');
        await expect(sklEngine.findBy({ id: 'https://standardknowledge.com/ontologies/core/Share' })).resolves.toEqual(schemas[0]);
        expect(findBySpy).toHaveBeenCalledTimes(1);
        expect(findBySpy).toHaveBeenCalledWith({ id: 'https://standardknowledge.com/ontologies/core/Share' });
      });

      it('throws an error if there is no schema matching the query during findBy.', async(): Promise<void> => {
        const findBySpy = jest.spyOn(SparqlQueryAdapter.prototype, 'findBy');
        await expect(sklEngine.findBy({ id: 'https://standardknowledge.com/ontologies/core/Send' })).rejects.toThrow(
          'No schema found with fields matching {"id":"https://standardknowledge.com/ontologies/core/Send"}',
        );
        expect(findBySpy).toHaveBeenCalledTimes(1);
        expect(findBySpy).toHaveBeenCalledWith({ id: 'https://standardknowledge.com/ontologies/core/Send' });
      });
    });

    describe('findAll', (): void => {
      it('delegates calls to findAll to the query adapter.', async(): Promise<void> => {
        const findAllSpy = jest.spyOn(SparqlQueryAdapter.prototype, 'findAll');
        await expect(sklEngine.findAll({ where: { id: 'https://standardknowledge.com/ontologies/core/Share' }})).resolves.toEqual([ schemas[0] ]);
        expect(findAllSpy).toHaveBeenCalledTimes(1);
        expect(findAllSpy).toHaveBeenCalledWith({ where: { id: 'https://standardknowledge.com/ontologies/core/Share' }});
      });
    });

    describe('findAllBy', (): void => {
      it('delegates calls to findAllBy to the query adapter.', async(): Promise<void> => {
        const findAllBySpy = jest.spyOn(SparqlQueryAdapter.prototype, 'findAllBy');
        await expect(sklEngine.findAllBy({ id: 'https://standardknowledge.com/ontologies/core/Share' })).resolves.toEqual([ schemas[0] ]);
        expect(findAllBySpy).toHaveBeenCalledTimes(1);
        expect(findAllBySpy).toHaveBeenCalledWith({ id: 'https://standardknowledge.com/ontologies/core/Share' });
      });
    });

    describe('exists', (): void => {
      it('delegates calls to exists to the query adapter.', async(): Promise<void> => {
        const existsSpy = jest.spyOn(SparqlQueryAdapter.prototype, 'exists');
        await expect(sklEngine.exists({ where: { id: 'https://standardknowledge.com/ontologies/core/Share' }})).resolves.toBe(true);
        expect(existsSpy).toHaveBeenCalledTimes(1);
        expect(existsSpy).toHaveBeenCalledWith({ where: { id: 'https://standardknowledge.com/ontologies/core/Share' }});
      });
    });

    describe('count', (): void => {
      it('delegates calls to count to the query adapter.', async(): Promise<void> => {
        const countSpy = jest.spyOn(SparqlQueryAdapter.prototype, 'count');
        await expect(sklEngine.count({ where: { id: 'https://standardknowledge.com/ontologies/core/Share' }})).resolves.toBe(1);
        expect(countSpy).toHaveBeenCalledTimes(1);
        expect(countSpy).toHaveBeenCalledWith({ where: { id: 'https://standardknowledge.com/ontologies/core/Share' }});
      });
    });

    describe('save', (): void => {
      beforeEach(async(): Promise<void> => {
        schemas = await frameAndCombineSchemas([ './test/assets/schemas/core.json' ]);
        await sklEngine.save(schemas);
      });

      it('delegates calls to save a single entity to the query adapter.', async(): Promise<void> => {
        const saveSpy = jest.spyOn(SparqlQueryAdapter.prototype, 'save');
        const res = await sklEngine.save({
          '@id': 'https://standardknowledge.com/ontologies/core/Share',
          '@type': 'https://standardknowledge.com/ontologies/core/Verb',
          [RDFS.label]: 'Share',
        });
        expect(res).toEqual({
          '@id': 'https://standardknowledge.com/ontologies/core/Share',
          '@type': 'https://standardknowledge.com/ontologies/core/Verb',
          [RDFS.label]: 'Share',
        });
        expect(saveSpy).toHaveBeenCalledTimes(1);
        expect(saveSpy).toHaveBeenCalledWith({
          '@id': 'https://standardknowledge.com/ontologies/core/Share',
          '@type': 'https://standardknowledge.com/ontologies/core/Verb',
          [RDFS.label]: 'Share',
        });
      });

      it('delegates calls to save multiple entities to the query adapter.', async(): Promise<void> => {
        const saveSpy = jest.spyOn(SparqlQueryAdapter.prototype, 'save');
        const entities = [
          {
            '@id': 'https://standardknowledge.com/ontologies/core/Share',
            '@type': 'https://standardknowledge.com/ontologies/core/Verb',
            [RDFS.label]: 'Share',
          },
          {
            '@id': 'https://standardknowledge.com/ontologies/core/Send',
            '@type': 'https://standardknowledge.com/ontologies/core/Verb',
            [RDFS.label]: 'Send',
          },
        ];
        const res = await sklEngine.save(entities);
        expect(res).toEqual(entities);
        expect(saveSpy).toHaveBeenCalledTimes(1);
        expect(saveSpy).toHaveBeenCalledWith(entities);
      });

      it('throws an error if the entity does not conform to the schema.', async(): Promise<void> => {
        const saveSpy = jest.spyOn(SparqlQueryAdapter.prototype, 'save');
        const entity = {
          '@id': 'https://example.com/data/1',
          '@type': 'https://standardknowledge.com/ontologies/core/File',
        };
        await expect(sklEngine.save(entity)).rejects.toThrow(
          'Entity https://example.com/data/1 does not conform to the https://standardknowledge.com/ontologies/core/File schema',
        );
        expect(saveSpy).toHaveBeenCalledTimes(0);
      });

      it('throws an error if the entity does not conform to the parent schema.', async(): Promise<void> => {
        const saveSpy = jest.spyOn(SparqlQueryAdapter.prototype, 'save');
        const entity = {
          '@id': 'https://example.com/data/1',
          '@type': 'https://standardknowledge.com/ontologies/core/Folder',
        };
        await expect(sklEngine.save(entity)).rejects.toThrow(
          'Entity https://example.com/data/1 does not conform to the https://standardknowledge.com/ontologies/core/File schema',
        );
        expect(saveSpy).toHaveBeenCalledTimes(0);
      });

      it('throws an error if one of the entities does not conform to the schema.', async(): Promise<void> => {
        const saveSpy = jest.spyOn(SparqlQueryAdapter.prototype, 'save');
        const entities = [
          {
            '@id': 'https://example.com/data/1',
            '@type': 'https://standardknowledge.com/ontologies/core/File',
          },
          {
            '@id': 'https://example.com/data/2',
            '@type': 'https://standardknowledge.com/ontologies/core/File',
          },
        ];
        await expect(sklEngine.save(entities)).rejects.toThrow(
          'An entity does not conform to the https://standardknowledge.com/ontologies/core/File schema',
        );
        expect(saveSpy).toHaveBeenCalledTimes(0);
      });

      it('throws an error if one of the entities does not conform to the parent schema.', async(): Promise<void> => {
        const saveSpy = jest.spyOn(SparqlQueryAdapter.prototype, 'save');
        const entities = [
          {
            '@id': 'https://example.com/data/1',
            '@type': 'https://standardknowledge.com/ontologies/core/Folder',
          },
          {
            '@id': 'https://example.com/data/2',
            '@type': 'https://standardknowledge.com/ontologies/core/Folder',
          },
        ];
        await expect(sklEngine.save(entities)).rejects.toThrow(
          'An entity does not conform to the https://standardknowledge.com/ontologies/core/File schema',
        );
        expect(saveSpy).toHaveBeenCalledTimes(0);
      });
    });

    describe('update', (): void => {
      let entities = [
        {
          '@id': 'https://example.com/data/1',
          '@type': 'https://standardknowledge.com/ontologies/core/File',
          [RDFS.label]: {
            '@type': XSD.string,
            '@value': 'fileA',
          },
          [SKL.sourceId]: {
            '@type': XSD.string,
            '@value': '12345',
          },
          [SKL.integration]: {
            '@id': 'https://example.com/integrations/Dropbox',
          },
        },
        {
          '@id': 'https://example.com/data/2',
          '@type': 'https://standardknowledge.com/ontologies/core/File',
          [RDFS.label]: {
            '@type': XSD.string,
            '@value': 'fileB',
          },
          [SKL.sourceId]: {
            '@type': XSD.string,
            '@value': '12346',
          },
          [SKL.integration]: {
            '@id': 'https://example.com/integrations/Dropbox',
          },
        },
      ];
      const entityIds = entities.map((entity): string => entity['@id']);
      const badAttributes = {
        [RDFS.label]: [
          'file1',
          'file2',
        ],
      };

      beforeEach(async(): Promise<void> => {
        schemas = await frameAndCombineSchemas([ './test/assets/schemas/core.json' ]);
        await sklEngine.save(schemas);
        await sklEngine.save(entities);
      });

      it('delegates calls to update a single entity to the query adapter.', async(): Promise<void> => {
        const updateSpy = jest.spyOn(SparqlQueryAdapter.prototype, 'update');
        const res = await sklEngine.update(
          entities[0]['@id'],
          { [RDFS.label]: 'file1' },
        );
        expect(res).toBeUndefined();
        expect(updateSpy).toHaveBeenCalledTimes(1);
        expect(updateSpy).toHaveBeenCalledWith(
          entities[0]['@id'],
          { [RDFS.label]: 'file1' },
        );
      });

      it('delegates calls to update multiple entities to the query adapter.', async(): Promise<void> => {
        const updateSpy = jest.spyOn(SparqlQueryAdapter.prototype, 'update');
        const res = await sklEngine.update(
          entityIds,
          { [RDFS.label]: 'file1' },
        );
        expect(res).toBeUndefined();
        expect(updateSpy).toHaveBeenCalledTimes(1);
        expect(updateSpy).toHaveBeenCalledWith(
          entityIds,
          { [RDFS.label]: 'file1' },
        );
      });

      it('throws an error if the entity does not conform to the schema.', async(): Promise<void> => {
        const updateSpy = jest.spyOn(SparqlQueryAdapter.prototype, 'update');
        await expect(sklEngine.update(entities[0]['@id'], badAttributes)).rejects.toThrow(
          'Entity https://example.com/data/1 does not conform to the https://standardknowledge.com/ontologies/core/File schema',
        );
        expect(updateSpy).toHaveBeenCalledTimes(0);
      });

      it('throws an error if the entity does not conform to the parent schema.', async(): Promise<void> => {
        const updateSpy = jest.spyOn(SparqlQueryAdapter.prototype, 'update');
        const entity = {
          ...entities[0],
          '@type': 'https://standardknowledge.com/ontologies/core/Folder',
        };
        await sklEngine.save(entity);
        await expect(sklEngine.update(entity['@id'], badAttributes)).rejects.toThrow(
          'Entity https://example.com/data/1 does not conform to the https://standardknowledge.com/ontologies/core/File schema',
        );
        expect(updateSpy).toHaveBeenCalledTimes(0);
      });

      it('throws an error if one of the entities does not conform to the schema.', async(): Promise<void> => {
        const updateSpy = jest.spyOn(SparqlQueryAdapter.prototype, 'update');
        await expect(sklEngine.update(entityIds, badAttributes)).rejects.toThrow(
          'Entity https://example.com/data/1 does not conform to the https://standardknowledge.com/ontologies/core/File schema',
        );
        expect(updateSpy).toHaveBeenCalledTimes(0);
      });

      it('throws an error if one of the entities does not conform to the parent schema.', async(): Promise<void> => {
        const updateSpy = jest.spyOn(SparqlQueryAdapter.prototype, 'update');
        entities = [
          {
            ...entities[0],
            '@type': 'https://standardknowledge.com/ontologies/core/Folder',
          },
          {
            ...entities[0],
            '@type': 'https://standardknowledge.com/ontologies/core/Folder',
          },
        ];
        await sklEngine.save(entities);
        await expect(sklEngine.update(entityIds, badAttributes)).rejects.toThrow(
          'Entity https://example.com/data/1 does not conform to the https://standardknowledge.com/ontologies/core/File schema',
        );
        expect(updateSpy).toHaveBeenCalledTimes(0);
      });
    });

    describe('delete', (): void => {
      it('delegates calls to delete a single entity to the query adapter.', async(): Promise<void> => {
        const deleteSpy = jest.spyOn(SparqlQueryAdapter.prototype, 'delete');
        const entity = {
          '@id': 'https://standardknowledge.com/ontologies/core/Share',
          '@type': 'https://standardknowledge.com/ontologies/core/Verb',
        };
        await sklEngine.save(entity);
        const res = await sklEngine.delete(entity['@id']);
        expect(res).toBeUndefined();
        expect(deleteSpy).toHaveBeenCalledTimes(1);
        expect(deleteSpy).toHaveBeenCalledWith(entity['@id']);
      });

      it('delegates calls to delete miltiple entities to the query adapter.', async(): Promise<void> => {
        const deleteSpy = jest.spyOn(SparqlQueryAdapter.prototype, 'delete');
        const entities = [
          {
            '@id': 'https://standardknowledge.com/ontologies/core/Share',
            '@type': 'https://standardknowledge.com/ontologies/core/Verb',
            [RDFS.label]: 'Share',
          },
          {
            '@id': 'https://standardknowledge.com/ontologies/core/Send',
            '@type': 'https://standardknowledge.com/ontologies/core/Verb',
            [RDFS.label]: 'Send',
          },
        ];
        const entityIds = entities.map((entity): string => entity['@id']);
        await sklEngine.save(entities);
        const res = await sklEngine.delete(entityIds);
        expect(res).toBeUndefined();
        expect(deleteSpy).toHaveBeenCalledTimes(1);
        expect(deleteSpy).toHaveBeenCalledWith(entityIds);
      });
    });

    describe('destroy', (): void => {
      it('delegates calls to destroy a single entity to the query adapter.', async(): Promise<void> => {
        const destroySpy = jest.spyOn(SparqlQueryAdapter.prototype, 'destroy');
        const entity = {
          '@id': 'https://standardknowledge.com/ontologies/core/Share',
          '@type': 'https://standardknowledge.com/ontologies/core/Verb',
        };
        await sklEngine.save(entity);
        const res = await sklEngine.destroy(entity);
        expect(res).toEqual(entity);
        expect(destroySpy).toHaveBeenCalledTimes(1);
        expect(destroySpy).toHaveBeenCalledWith(entity);
      });

      it('delegates calls to destroy miltiple entities to the query adapter.', async(): Promise<void> => {
        const destroySpy = jest.spyOn(SparqlQueryAdapter.prototype, 'destroy');
        const entities = [
          {
            '@id': 'https://standardknowledge.com/ontologies/core/Share',
            '@type': 'https://standardknowledge.com/ontologies/core/Verb',
            [RDFS.label]: 'Share',
          },
          {
            '@id': 'https://standardknowledge.com/ontologies/core/Send',
            '@type': 'https://standardknowledge.com/ontologies/core/Verb',
            [RDFS.label]: 'Send',
          },
        ];
        await sklEngine.save(entities);
        const res = await sklEngine.destroy(entities);
        expect(res).toEqual(entities);
        expect(destroySpy).toHaveBeenCalledTimes(1);
        expect(destroySpy).toHaveBeenCalledWith(entities);
      });
    });

    describe('destroyAll', (): void => {
      it('delegates calls to destroyAll to the query adapter.', async(): Promise<void> => {
        const destroyAllSpy = jest.spyOn(SparqlQueryAdapter.prototype, 'destroyAll');
        const res = await sklEngine.destroyAll();
        expect(res).toBeUndefined();
        expect(destroyAllSpy).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('mapping data', (): void => {
    let sklEngine: SKLEngine;

    beforeEach(async(): Promise<void> => {
      schemas = [{
        '@id': 'https://standardknowledge.com/ontologies/core/Share',
        '@type': 'https://standardknowledge.com/ontologies/core/Verb',
      }];
      sklEngine = new SKLEngine({ type: 'memory' });
      await sklEngine.save(schemas);
    });

    it('maps data with a frame.', async(): Promise<void> => {
      const data = { field: 'abc123' };
      const frame = {
        '@context': {
          field: 'https://example.com/field',
        },
      };
      const mapping = await expandJsonLd(simpleMapping);
      const response = await sklEngine.performMapping(data, mapping as NodeObject, frame);
      expect(response).toEqual({
        '@context': {
          field: 'https://example.com/field',
        },
        field: 'abc123',
      });
    });
  });

  describe('calling Verbs which execute OpenApi operations', (): void => {
    let executeOperation: any;
    let setOpenapiSpec: any;
    let executeSecuritySchemeStage: any;

    beforeEach(async(): Promise<void> => {
      schemas = await frameAndCombineSchemas([
        './test/assets/schemas/core.json',
        './test/assets/schemas/get-dropbox-file.json',
      ]);
      executeOperation = jest.fn().mockResolvedValue({ data: mockDropboxFile, config: {}});
      executeSecuritySchemeStage = jest.fn().mockResolvedValue({ data: { access_token: 'newToken' }, config: {}});
      setOpenapiSpec = jest.fn();
      (OpenApiOperationExecutor as jest.Mock).mockReturnValue({
        executeOperation,
        setOpenapiSpec,
        executeSecuritySchemeStage,
      });
    });

    it('can execute an OpenApi operation defined via an operationMapping.', async(): Promise<void> => {
      const sklEngine = new SKLEngine({ type: 'memory' });
      await sklEngine.save(schemas);
      const response = await sklEngine.verb.getFile({ account, id: '12345' });
      expect(response).toEqual(expectedGetFileResponse);
      expect(executeOperation).toHaveBeenCalledTimes(1);
      expect(executeOperation).toHaveBeenCalledWith(
        'FilesGetMetadata',
        { accessToken: 'SPOOFED_TOKEN', bearerToken: undefined, apiKey: undefined, basePath: undefined },
        { path: 'id:12345' },
      );
    });

    it('can execute an OpenApi operation defined via a constant operationId.', async(): Promise<void> => {
      schemas = schemas.map((schemaItem: any): any => {
        if (schemaItem['@id'] === 'https://example.com/data/4') {
          schemaItem[SKL.operationId] = {
            '@type': XSD.string,
            '@value': 'FilesGetMetadata',
          };
          // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
          delete schemaItem[SKL.operationMapping];
        }
        return schemaItem;
      });
      const sklEngine = new SKLEngine({ type: 'memory' });
      await sklEngine.save(schemas);
      const response = await sklEngine.verb.getFile({ account, id: '12345' });
      expect(response).toEqual(expectedGetFileResponse);
      expect(executeOperation).toHaveBeenCalledTimes(1);
      expect(executeOperation).toHaveBeenCalledWith(
        'FilesGetMetadata',
        { accessToken: 'SPOOFED_TOKEN', bearerToken: undefined, apiKey: undefined, basePath: undefined },
        { path: 'id:12345' },
      );
    });

    it('returns the raw operation response if the verb integration mapping does not have a return value mapping.',
      async(): Promise<void> => {
        schemas = schemas.map((schemaItem: any): any => {
          if (schemaItem['@id'] === 'https://example.com/data/4') {
            // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
            delete schemaItem[SKL.returnValueMapping];
          }
          return schemaItem;
        });
        const sklEngine = new SKLEngine({ type: 'memory' });
        await sklEngine.save(schemas);
        const response = await sklEngine.verb.getFile({ account, id: '12345' });
        expect(response).toEqual(
          expect.objectContaining({
            data: mockDropboxFile,
            operationParameters: {
              path: 'id:12345',
            },
          }),
        );
        expect(executeOperation).toHaveBeenCalledTimes(1);
        expect(executeOperation).toHaveBeenCalledWith(
          'FilesGetMetadata',
          { accessToken: 'SPOOFED_TOKEN', bearerToken: undefined, apiKey: undefined, basePath: undefined },
          { path: 'id:12345' },
        );
      });

    it('errors if the executed verb is not defined.', async(): Promise<void> => {
      schemas = schemas.filter((schemaItem: any): boolean => schemaItem['@id'] !== 'https://example.com/getFile');
      const sklEngine = new SKLEngine({ type: 'memory' });
      await sklEngine.save(schemas);
      await expect(sklEngine.verb.getFile({ account, id: '12345' })).rejects.toThrow(
        'Failed to find the verb getFile in the schema',
      );
      expect(executeOperation).toHaveBeenCalledTimes(0);
    });

    it('errors if the parameters do not conform to the verb parameter schema.', async(): Promise<void> => {
      const sklEngine = new SKLEngine({ type: 'memory' });
      await sklEngine.save(schemas);
      await expect(sklEngine.verb.getFile({ account, ids: [ '12345' ]})).rejects.toThrow(
        'getFile parameters do not conform to the schema',
      );
      expect(executeOperation).toHaveBeenCalledTimes(0);
    });

    it('validates using the return value\'s type if it does not have an id.', async(): Promise<void> => {
      schemas.forEach((schemaItem: any): void => {
        if (schemaItem['@id'] === 'https://example.com/data/4') {
          // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
          delete schemaItem[SKL.returnValueMapping][RR.subject];
          schemaItem[SKL.returnValueMapping][RR.subjectMap] = {
            '@type': 'rr:SubjectMap',
            [RR.termType]: { '@id': RR.BlankNode },
            [RR.class]: { '@id': 'https://standardknowledge.com/ontologies/core/File' },
          };
        }
      });
      const sklEngine = new SKLEngine({ type: 'memory' });
      await sklEngine.save(schemas);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { '@id': id, ...getFileResponseWithoutId } = expectedGetFileResponse;
      await expect(sklEngine.verb.getFile({ account, id: '12345' })).resolves.toEqual(getFileResponseWithoutId);
      expect(executeOperation).toHaveBeenCalledTimes(1);
      expect(executeOperation).toHaveBeenCalledWith(
        'FilesGetMetadata',
        { accessToken: 'SPOOFED_TOKEN', bearerToken: undefined, apiKey: undefined, basePath: undefined },
        { path: 'id:12345' },
      );
    });

    it('errors if the return value does not conform to the verb return value schema.', async(): Promise<void> => {
      schemas.forEach((schemaItem: any): void => {
        if (schemaItem['@id'] === 'https://example.com/data/4') {
          schemaItem[SKL.returnValueMapping] = incorrectReturnValueMapping;
        }
      });
      const sklEngine = new SKLEngine({ type: 'memory' });
      await sklEngine.save(schemas);
      await expect(sklEngine.verb.getFile({ account, id: '12345' })).rejects.toThrow(
        'Return value https://example.com/data/abc123 does not conform to the schema',
      );
      expect(executeOperation).toHaveBeenCalledTimes(1);
      expect(executeOperation).toHaveBeenCalledWith(
        'FilesGetMetadata',
        { accessToken: 'SPOOFED_TOKEN', bearerToken: undefined, apiKey: undefined, basePath: undefined },
        { path: 'id:12345' },
      );
    });

    it('errors if no mapping for the verb and the integration is in the schema.', async(): Promise<void> => {
      schemas = schemas.filter((schemaItem: any): boolean => schemaItem['@id'] !== 'https://example.com/data/4');
      const sklEngine = new SKLEngine({ type: 'memory' });
      await sklEngine.save(schemas);
      await expect(sklEngine.verb.getFile({ account, id: '12345' })).rejects.toThrow(
        'Mapping between account https://example.com/data/DropboxAccount1 and verb https://example.com/getFile not found.',
      );
      expect(executeOperation).toHaveBeenCalledTimes(0);
    });

    it('errors if no open api description for the integration is in the schema.', async(): Promise<void> => {
      schemas = schemas.filter((schemaItem: any): boolean => schemaItem['@id'] !== 'https://example.com/data/DropboxOpenApiDescription');
      const sklEngine = new SKLEngine({ type: 'memory' });
      await sklEngine.save(schemas);
      await expect(sklEngine.verb.getFile({ account, id: '12345' })).rejects.toThrow([
        'No schema found with fields matching',
        '{"type":"https://standardknowledge.com/ontologies/core/OpenApiDescription","https://standardknowledge.com/ontologies/core/integration":"https://example.com/integrations/Dropbox"}',
      ].join(' '));
      expect(executeOperation).toHaveBeenCalledTimes(0);
    });

    it(`sends the request with undefined security credentials if no 
    security credentials for the account are in the schema.`,
    async(): Promise<void> => {
      schemas = schemas.filter((schemaItem: any): boolean => schemaItem['@id'] !== 'https://example.com/data/DropboxAccount1SecurityCredentials');
      const sklEngine = new SKLEngine({ type: 'memory' });
      await sklEngine.save(schemas);
      const response = await sklEngine.verb.getFile({ account, id: '12345' });
      expect(response).toEqual(expectedGetFileResponse);
      expect(executeOperation).toHaveBeenCalledTimes(1);
      expect(executeOperation).toHaveBeenCalledWith(
        'FilesGetMetadata',
        { accessToken: undefined, bearerToken: undefined, apiKey: undefined, basePath: undefined },
        { path: 'id:12345' },
      );
    });

    it('validates the verbs return value against a nested returnType schema.', async(): Promise<void> => {
      schemas = schemas.map((schemaItem: any): any => {
        if (schemaItem['@id'] === 'https://example.com/getFile') {
          schemaItem[SKL.returnValue] = {
            '@type': 'shacl:NodeShape',
            'http://www.w3.org/ns/shacl#closed': false,
            'http://www.w3.org/ns/shacl#property': [
              {
                'http://www.w3.org/ns/shacl#maxCount': {
                  '@type': 'http://www.w3.org/2001/XMLSchema#integer',
                  '@value': '1',
                },
                'http://www.w3.org/ns/shacl#minCount': {
                  '@type': 'http://www.w3.org/2001/XMLSchema#integer',
                  '@value': '1',
                },
                'http://www.w3.org/ns/shacl#path': { '@id': 'http://www.w3.org/2000/01/rdf-schema#label' },
              },
            ],
          };
        }
        return schemaItem;
      });

      const sklEngine = new SKLEngine({ type: 'memory' });
      await sklEngine.save(schemas);
      const response = await sklEngine.verb.getFile({ account, id: '12345' });
      expect(response).toEqual(expectedGetFileResponse);
      expect(executeOperation).toHaveBeenCalledTimes(1);
      expect(executeOperation).toHaveBeenCalledWith(
        'FilesGetMetadata',
        { accessToken: 'SPOOFED_TOKEN', bearerToken: undefined, apiKey: undefined, basePath: undefined },
        { path: 'id:12345' },
      );
    });

    it(`refreshes the access token and retries the operation if it fails 
    with an invalid token error matching the integration configuration.`,
    async(): Promise<void> => {
      executeOperation.mockRejectedValueOnce({
        isAxiosError: true,
        response: {
          status: 401,
          statusText: 'Unauthorized',
        },
      });
      const sklEngine = new SKLEngine({ type: 'memory' });
      await sklEngine.save(schemas);
      const response = await sklEngine.verb.getFile({ account, id: '12345' });
      expect(response).toEqual(expectedGetFileResponse);
      expect(executeOperation).toHaveBeenCalledTimes(2);
      expect(executeOperation).toHaveBeenNthCalledWith(
        1,
        'FilesGetMetadata',
        { accessToken: 'SPOOFED_TOKEN', apiKey: undefined },
        { path: 'id:12345' },
      );
      expect(executeOperation).toHaveBeenNthCalledWith(
        2,
        'FilesGetMetadata',
        { accessToken: 'newToken', apiKey: undefined },
        { path: 'id:12345' },
      );
      expect(executeSecuritySchemeStage).toHaveBeenCalledTimes(1);
      expect(executeSecuritySchemeStage).toHaveBeenCalledWith(
        'oAuth',
        'authorizationCode',
        'tokenUrl',
        { username: 'adlerfaulkner', password: 'abc123', accessToken: 'SPOOFED_TOKEN' },
        { client_id: 'adlerfaulkner', grant_type: 'refresh_token', refresh_token: 'SPOOFED_REFRESH_TOKEN' },
      );
    });

    it(`refreshes the access token and retries the operation if it fails 
    with an invalid token error matching the integration configuration with no messageRegex.`,
    async(): Promise<void> => {
      schemas = schemas.map((schemaItem: any): any => {
        if (schemaItem['@id'] === 'https://example.com/integrations/Dropbox') {
          schemaItem[SKL.invalidTokenErrorMatcher] = {
            '@type': SKL.InvalidTokenErrorMatcher,
            [SKL.invalidTokenErrorMatcherStatus]: 400,
          };
        }
        return schemaItem;
      });
      executeOperation.mockRejectedValueOnce({
        isAxiosError: true,
        response: {
          status: 400,
          statusText: 'Some other error',
        },
      });
      const sklEngine = new SKLEngine({ type: 'memory' });
      await sklEngine.save(schemas);
      const response = await sklEngine.verb.getFile({ account, id: '12345' });
      expect(response).toEqual(expectedGetFileResponse);
      expect(executeOperation).toHaveBeenCalledTimes(2);
      expect(executeOperation).toHaveBeenNthCalledWith(
        1,
        'FilesGetMetadata',
        { accessToken: 'SPOOFED_TOKEN', apiKey: undefined },
        { path: 'id:12345' },
      );
      expect(executeOperation).toHaveBeenNthCalledWith(
        2,
        'FilesGetMetadata',
        { accessToken: 'newToken', apiKey: undefined },
        { path: 'id:12345' },
      );
      expect(executeSecuritySchemeStage).toHaveBeenCalledTimes(1);
      expect(executeSecuritySchemeStage).toHaveBeenCalledWith(
        'oAuth',
        'authorizationCode',
        'tokenUrl',
        { username: 'adlerfaulkner', password: 'abc123', accessToken: 'SPOOFED_TOKEN' },
        { client_id: 'adlerfaulkner', grant_type: 'refresh_token', refresh_token: 'SPOOFED_REFRESH_TOKEN' },
      );
    });

    it('throws an error if the operation fails with an error other than invalid token.', async(): Promise<void> => {
      executeOperation.mockRejectedValueOnce(
        new AxiosError('Internal Server Error', undefined, undefined, { status: 500 }),
      );
      const sklEngine = new SKLEngine({ type: 'memory' });
      await sklEngine.save(schemas);
      await expect(sklEngine.verb.getFile({ account, id: '12345' })).rejects.toThrow('Internal Server Error');
      expect(executeOperation).toHaveBeenCalledTimes(1);
      expect(executeOperation).toHaveBeenNthCalledWith(
        1,
        'FilesGetMetadata',
        { accessToken: 'SPOOFED_TOKEN', apiKey: undefined },
        { path: 'id:12345' },
      );
    });
  });

  describe('calling Verbs which execute OpenApi security schemes', (): void => {
    let executeSecuritySchemeStage: any;
    let setOpenapiSpec: any;
    let response: any;

    beforeEach(async(): Promise<void> => {
      schemas = await frameAndCombineSchemas([
        './test/assets/schemas/core.json',
        './test/assets/schemas/get-dropbox-file.json',
      ]);
      response = { authorizationUrl: 'https://example.com/auth', codeVerifier: 'something' };
      executeSecuritySchemeStage = jest.fn().mockResolvedValue(response);
      setOpenapiSpec = jest.fn();
      (OpenApiOperationExecutor as jest.Mock).mockReturnValue({ executeSecuritySchemeStage, setOpenapiSpec });
    });

    it('can execute an OpenApiSecuritySchemeVerb that maps to the authorizationUrl stage.', async(): Promise<void> => {
      const sklEngine = new SKLEngine({ type: 'memory' });
      await sklEngine.save(schemas);
      await expect(sklEngine.verb.authorizeWithPkceOauth({ account })).resolves.toEqual({
        data: response,
        operationParameters: {
          account,
          client_id: 'adlerfaulkner',
        },
      });
      expect(executeSecuritySchemeStage).toHaveBeenCalledTimes(1);
      expect(executeSecuritySchemeStage).toHaveBeenCalledWith(
        'oAuth',
        'authorizationCode',
        'authorizationUrl',
        { username: 'adlerfaulkner', password: 'abc123', accessToken: 'SPOOFED_TOKEN' },
        { client_id: 'adlerfaulkner', account },
      );
    });

    it('errors if the executed verb is not defined.', async(): Promise<void> => {
      schemas = schemas.filter((schemaItem: any): boolean => schemaItem['@id'] !== 'https://example.com/getFile');
      const sklEngine = new SKLEngine({ type: 'memory' });
      await sklEngine.save(schemas);
      await expect(sklEngine.verb.getFile({ account, id: '12345' })).rejects.toThrow(Error);
      await expect(sklEngine.verb.getFile({ account, id: '12345' })).rejects.toThrow(
        'Failed to find the verb getFile in the schema',
      );
    });

    it('can execute an OpenApiSecuritySchemeVerb that maps to the tokenUrl stage.', async(): Promise<void> => {
      response = { data: { access_token: 'abc123' }, config: {}};
      executeSecuritySchemeStage = jest.fn().mockResolvedValue(response);
      (OpenApiOperationExecutor as jest.Mock).mockReturnValue({ executeSecuritySchemeStage, setOpenapiSpec });
      const sklEngine = new SKLEngine({ type: 'memory' });
      await sklEngine.save(schemas);
      const res = await sklEngine.verb.getOauthTokens<NodeObject>({
        account,
        codeVerifier: 'something',
        code: 'dummy_code',
      });
      expect(res[SKL.accessToken]).toBe('abc123');
      expect(executeSecuritySchemeStage).toHaveBeenCalledTimes(1);
      expect(executeSecuritySchemeStage).toHaveBeenCalledWith(
        'oAuth',
        'authorizationCode',
        'tokenUrl',
        { username: 'adlerfaulkner', password: 'abc123', accessToken: 'SPOOFED_TOKEN' },
        {
          client_id: 'adlerfaulkner',
          code: 'dummy_code',
          grant_type: 'authorization_code',
          code_verifier: 'something',
        },
      );
    });

    it(`can execute an OpenApiSecuritySchemeVerb with empty configuration 
    if no SecurityCredentialsSchema exists for the account.`,
    async(): Promise<void> => {
      schemas = schemas.filter((schemaItem: any): boolean => schemaItem['@id'] !== 'https://example.com/data/DropboxAccount1SecurityCredentials');
      response = { data: { message: 'Access Denied' }, config: {}};
      executeSecuritySchemeStage = jest.fn().mockResolvedValue(response);
      (OpenApiOperationExecutor as jest.Mock).mockReturnValue({ executeSecuritySchemeStage, setOpenapiSpec });
      const sklEngine = new SKLEngine({ type: 'memory' });
      await sklEngine.save(schemas);
      const res = await sklEngine.verb.authorizeWithPkceOauth<NodeObject>({ account });
      expect(res[SKL.accessToken]).toBeUndefined();
      expect(executeSecuritySchemeStage).toHaveBeenCalledTimes(1);
      expect(executeSecuritySchemeStage).toHaveBeenCalledWith(
        'oAuth',
        'authorizationCode',
        'authorizationUrl',
        {},
        { account },
      );
    });

    it('can execute an OpenApiSecuritySchemeVerb that maps to the tokenUrl stage with credentials.',
      async(): Promise<void> => {
        schemas = await frameAndCombineSchemas([
          './test/assets/schemas/core.json',
          './test/assets/schemas/get-stubhub-events.json',
        ]);
        response = { data: { access_token: 'abc123' }, config: {}};
        executeSecuritySchemeStage = jest.fn().mockResolvedValue(response);
        (OpenApiOperationExecutor as jest.Mock).mockReturnValue({ executeSecuritySchemeStage, setOpenapiSpec });
        const sklEngine = new SKLEngine({ type: 'memory' });
        await sklEngine.save(schemas);
        const res = await sklEngine.verb.getOauthTokens<NodeObject>({ account: 'https://example.com/data/StubhubAccount1' });
        expect(res[SKL.accessToken]).toBe('abc123');
        expect(executeSecuritySchemeStage).toHaveBeenCalledTimes(1);
        expect(executeSecuritySchemeStage).toHaveBeenCalledWith(
          'OAuth2',
          'clientCredentials',
          'tokenUrl',
          { username: 'adlerfaulkner', password: 'abc123' },
          { grant_type: 'client_credentials', scope: 'read:events', client_id: 'adlerfaulkner' },
        );
      });
  });

  describe('calling Verbs with a specific mapping', (): void => {
    it('can execute the verb with the mapping.', async(): Promise<void> => {
      schemas = await frameAndCombineSchemas([
        './test/assets/schemas/core.json',
        './test/assets/schemas/series-verb.json',
      ]);
      const functions = {
        'https://example.com/functions/parseLinksFromText'(data: any): string[] {
          const text = data['https://example.com/functions/text'];
          const res = text.match(URI_REGEXP);
          return res;
        },
      };
      const sklEngine = new SKLEngine({ type: 'memory', functions });
      await sklEngine.save(schemas);
      const entity = {
        '@id': 'https://example.com/data/1',
        '@type': 'https://schema.org/BlogPosting',
        'https://schema.org/articleBody': {
          '@value': 'Hello world https://example.com/test',
          '@type': XSD.string,
        },
      };
      const response = await sklEngine.verb.parseAndSaveLinksFromEntity({
        entity,
        mapping: 'https://example.com/parseAndSaveLinksFromEntityMapping',
      });
      expect(response).toEqual({});
    });
  });

  describe('calling Verbs which map a Noun to another Verb', (): void => {
    let executeOperation: any;
    let setOpenapiSpec: any;

    beforeEach(async(): Promise<void> => {
      schemas = await frameAndCombineSchemas([
        './test/assets/schemas/core.json',
        './test/assets/schemas/get-dropbox-file.json',
      ]);
      executeOperation = jest.fn().mockResolvedValue({ data: mockDropboxFile, config: {}});
      setOpenapiSpec = jest.fn();
      (OpenApiOperationExecutor as jest.Mock).mockReturnValue({ executeOperation, setOpenapiSpec });
    });

    it('can execute a Noun mapped Verb defined via a verbMapping.', async(): Promise<void> => {
      const sklEngine = new SKLEngine({ type: 'memory' });
      await sklEngine.save(schemas);
      const response = await sklEngine.verb.sync({
        noun: 'https://standardknowledge.com/ontologies/core/File',
        account,
        id: '12345',
      });
      expect(response).toEqual(expectedGetFileResponse);
    });

    it('can execute a Noun mapped Verb with only a mapping.', async(): Promise<void> => {
      const sklEngine = new SKLEngine({ type: 'memory' });
      await sklEngine.save(schemas);
      const response = await sklEngine.verb.getName({
        noun: 'https://standardknowledge.com/ontologies/core/File',
        entity: { [RDFS.label]: 'final.jpg', [SKL.sourceId]: 12345 },
      });
      expect(response).toEqual({
        [RDFS.label]: 'final.jpg',
      });
    });

    it('can execute a Noun mapped Verb through a mapping that defines a constant verbId.',
      async(): Promise<void> => {
        schemas = schemas.map((schemaItem: any): any => {
          if (schemaItem['@id'] === 'https://example.com/data/34') {
            schemaItem[SKL.verbId] = {
              '@type': XSD.string,
              '@value': 'https://example.com/getFile',
            };
            // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
            delete schemaItem[SKL.verbMapping];
          }
          return schemaItem;
        });
        const sklEngine = new SKLEngine({ type: 'memory' });
        await sklEngine.save(schemas);
        const response = await sklEngine.verb.sync({
          noun: 'https://standardknowledge.com/ontologies/core/File',
          account,
          id: '12345',
        });
        expect(response).toEqual(expectedGetFileResponse);
      });
  });

  describe('calling Verbs which use data from a data source', (): void => {
    it('gets data from a JsonDataSource from the data field.', async(): Promise<void> => {
      schemas = await frameAndCombineSchemas([
        './test/assets/schemas/core.json',
        './test/assets/schemas/get-dropbox-file.json',
        './test/assets/schemas/json-file-data-source.json',
      ]);
      const sklEngine = new SKLEngine({ type: 'memory' });
      await sklEngine.save(schemas);
      const response = await sklEngine.verb.getFile({
        account: 'https://example.com/data/JsonSourceAccount1',
        id: '12345',
      });
      expect(response).toEqual({
        ...expectedGetFileResponse,
        [SKL.integration]: { '@id': 'https://example.com/integrations/JsonSource' },
      });
    });

    it('gets data from a JsonDataSource from the source field.', async(): Promise<void> => {
      schemas = await frameAndCombineSchemas([
        './test/assets/schemas/core.json',
        './test/assets/schemas/get-dropbox-file.json',
        './test/assets/schemas/json-source-data-source.json',
      ]);
      const sklEngine = new SKLEngine({
        type: 'memory',
        inputFiles: {
          'data.json': `{
            ".tag": "file",
            "client_modified": "2015-05-12T15:50:38Z",
            "content_hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
            "has_explicit_shared_members": false,
            "id": "id:12345",
            "is_downloadable": true,
            "name": "Prime_Numbers.txt",
            "path_display": "/Homework/math/Prime_Numbers.txt",
            "path_lower": "/homework/math/prime_numbers.txt",
            "server_modified": "2015-05-12T15:50:38Z",
            "size": 7212
          }`,
        },
      });
      await sklEngine.save(schemas);
      const response = await sklEngine.verb.getFile({
        account: 'https://example.com/data/JsonSourceAccount1',
        id: '12345',
      });
      expect(response).toEqual({
        ...expectedGetFileResponse,
        [SKL.integration]: { '@id': 'https://example.com/integrations/JsonSource' },
      });
    });

    it('throws an error if a json data source was not provided.', async(): Promise<void> => {
      schemas = await frameAndCombineSchemas([
        './test/assets/schemas/core.json',
        './test/assets/schemas/get-dropbox-file.json',
        './test/assets/schemas/json-source-data-source.json',
      ]);
      const sklEngine = new SKLEngine({ type: 'memory', inputFiles: {}});
      await sklEngine.save(schemas);
      await expect(sklEngine.verb.getFile({
        account: 'https://example.com/data/JsonSourceAccount1',
        id: '12345',
      }))
        .rejects.toThrow('Failed to get data from source data.json');
    });

    it('throws an error for an invalid DataSource.', async(): Promise<void> => {
      schemas = await frameAndCombineSchemas([
        './test/assets/schemas/core.json',
        './test/assets/schemas/get-dropbox-file.json',
        './test/assets/schemas/json-file-data-source.json',
      ]);
      schemas = schemas.map((schemaItem: any): any => {
        if (schemaItem['@id'] === 'https://example.com/data/JsonFileDataSource') {
          schemaItem['@type'] = 'https://standardknowledge.com/ontologies/core/CsvDataSource';
        }
        return schemaItem;
      });
      const sklEngine = new SKLEngine({ type: 'memory' });
      await sklEngine.save(schemas);
      await expect(sklEngine.verb.getFile({
        account: 'https://example.com/data/JsonSourceAccount1',
        id: '12345',
      }))
        .rejects.toThrow('DataSource type https://standardknowledge.com/ontologies/core/CsvDataSource is not supported.');
    });
  });

  describe('calling Verbs which specify series composite mapping', (): void => {
    it('can execute multiple Verbs in series.', async(): Promise<void> => {
      schemas = await frameAndCombineSchemas([
        './test/assets/schemas/core.json',
        './test/assets/schemas/series-verb.json',
      ]);
      const functions = {
        'https://example.com/functions/parseLinksFromText'(data: any): string[] {
          const text = data['https://example.com/functions/text'];
          const res = text.match(URI_REGEXP);
          return res;
        },
      };
      const sklEngine = new SKLEngine({ type: 'memory', functions });
      await sklEngine.save(schemas);
      const entity = {
        '@id': 'https://example.com/data/1',
        '@type': 'https://schema.org/BlogPosting',
        'https://schema.org/articleBody': {
          '@value': 'Hello world https://example.com/test',
          '@type': XSD.string,
        },
      };
      const response = await sklEngine.verb.parseAndSaveLinksFromEntity({ entity });
      expect(response).toEqual({});
    });

    it('runs a preProcessingMapping and adds preProcessedParameters to the series mapping arguments.',
      async(): Promise<void> => {
        schemas = await frameAndCombineSchemas([
          './test/assets/schemas/core.json',
          './test/assets/schemas/series-verb-with-pre-processing.json',
        ]);
        const functions = {
          'https://example.com/functions/parseLinksFromText'(data: any): string[] {
            const text = data['https://example.com/functions/text'];
            const res = text.match(URI_REGEXP);
            return res;
          },
        };
        const sklEngine = new SKLEngine({ type: 'memory', functions });
        await sklEngine.save(schemas);
        const entity = {
          '@id': 'https://example.com/data/1',
          '@type': 'https://schema.org/BlogPosting',
          'https://schema.org/articleBody': {
            '@value': 'Hello world https://example.com/test',
            '@type': XSD.string,
          },
        };
        const response = await sklEngine.verb.parseAndSaveLinksFromEntity({ entity });
        expect(response).toEqual({});
      });

    it('does not run a verb from a series mapping if its verbMapping does not return a verbId.',
      async(): Promise<void> => {
        schemas = await frameAndCombineSchemas([
          './test/assets/schemas/core.json',
          './test/assets/schemas/series-verb-no-verbId.json',
        ]);
        const sklEngine = new SKLEngine({ type: 'memory' });
        await sklEngine.save(schemas);
        const response = await sklEngine.verb.transformText({ text: 'Hello' });
        expect(response).toEqual(
          expect.objectContaining({
            text: 'Hello',
          }),
        );
      });
  });

  describe('calling Verbs which use a parallel composite mapping', (): void => {
    beforeEach(async(): Promise<void> => {
      schemas = await frameAndCombineSchemas([
        './test/assets/schemas/core.json',
        './test/assets/schemas/parallel-verb.json',
      ]);
    });

    it('can execute multiple Verbs in parallel.', async(): Promise<void> => {
      const functions = {
        'https://example.com/functions/parseLinksFromText'(data: any): string[] {
          const text = data['https://example.com/functions/text'];
          const res = text.match(URI_REGEXP);
          return res;
        },
      };
      const sklEngine = new SKLEngine({ type: 'memory', functions });
      await sklEngine.save(schemas);
      const entity = {
        '@id': 'https://example.com/data/1',
        '@type': 'https://schema.org/BlogPosting',
        'https://schema.org/articleBody': {
          '@value': 'Hello world https://example.com/test',
          '@type': XSD.string,
        },
      };
      const response = await sklEngine.verb.parseLinksAndCountCharactersFromEntity({ entity });
      expect(response).toEqual([
        {
          '@context': {
            links: {
              '@container': '@set',
              '@id': 'https://example.com/links',
              '@type': 'http://www.w3.org/2001/XMLSchema#string',
            },
          },
          '@type': 'https://example.com/LinksObject',
          links: [
            'https://example.com/test',
          ],
        },
        {
          '@context': {
            length: {
              '@id': 'https://example.com/length',
              '@type': 'http://www.w3.org/2001/XMLSchema#integer',
            },
          },
          '@type': 'https://example.com/MeasurementObject',
          length: 36,
        },
      ]);
    });

    it('can execute multiple Verbs in with return values that have ids.', async(): Promise<void> => {
      const functions = {
        'https://example.com/functions/parseLinksFromText'(data: any): string[] {
          const text = data['https://example.com/functions/text'];
          const res = text.match(URI_REGEXP);
          return res;
        },
      };
      schemas = schemas.map((schemaItem: any): any => {
        if (schemaItem['@id'] === 'https://example.com/parseLinksAndCountCharactersFromEntityMapping') {
          // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
          delete schemaItem[SKL.parallel][0][SKL.returnValueMapping][RR.subjectMap][RR.class];
          schemaItem[SKL.parallel][0][SKL.returnValueMapping][RR.subjectMap][RR.constant] = 'https://example.com/res/1';
          // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
          delete schemaItem[SKL.parallel][1][SKL.returnValueMapping][RR.subjectMap][RR.class];
          schemaItem[SKL.parallel][1][SKL.returnValueMapping][RR.subjectMap][RR.constant] = 'https://example.com/res/2';
        }
        return schemaItem;
      });
      const sklEngine = new SKLEngine({ type: 'memory', functions });
      await sklEngine.save(schemas);
      const entity = {
        '@id': 'https://example.com/data/1',
        '@type': 'https://schema.org/BlogPosting',
        'https://schema.org/articleBody': {
          '@value': 'Hello world https://example.com/test',
          '@type': XSD.string,
        },
      };
      const response = await sklEngine.verb.parseLinksAndCountCharactersFromEntity({ entity });
      expect(response).toEqual([
        {
          '@context': {
            links: {
              '@container': '@set',
              '@id': 'https://example.com/links',
              '@type': 'http://www.w3.org/2001/XMLSchema#string',
            },
          },
          '@id': 'https://example.com/res/1',
          links: [
            'https://example.com/test',
          ],
        },
        {
          '@context': {
            length: {
              '@id': 'https://example.com/length',
              '@type': 'http://www.w3.org/2001/XMLSchema#integer',
            },
          },
          '@id': 'https://example.com/res/2',
          length: 36,
        },
      ]);
    });
  });

  describe('calling Verbs which execute operations on entities', (): void => {
    it('counts entities.', async(): Promise<void> => {
      schemas = await frameAndCombineSchemas([
        './test/assets/schemas/core.json',
        './test/assets/schemas/count-in-series-verb.json',
      ]);
      const sklEngine = new SKLEngine({ type: 'memory' });
      await sklEngine.save(schemas);
      const response = await sklEngine.verb.countEntities({ where: { type: SKL.Verb }});
      expect(response).toEqual(
        expect.objectContaining({
          [SKL_ENGINE.countResult]: {
            '@type': XSD.integer,
            '@value': 1,
          },
        }),
      );
    });

    it('finds if entities exist.', async(): Promise<void> => {
      schemas = await frameAndCombineSchemas([
        './test/assets/schemas/core.json',
        './test/assets/schemas/exists-in-series-verb.json',
      ]);
      const sklEngine = new SKLEngine({ type: 'memory' });
      await sklEngine.save(schemas);
      const response = await sklEngine.verb.entitiesExist({ where: { type: SKL.Verb }});
      expect(response).toEqual(
        expect.objectContaining({
          [SKL_ENGINE.existsResult]: {
            '@type': XSD.boolean,
            '@value': true,
          },
        }),
      );
    });

    it('saves entities.', async(): Promise<void> => {
      const entities = [{
        '@id': 'https://example.com/data/1',
        '@type': 'https://schema.org/BlogPosting',
        'https://schema.org/articleBody': {
          '@value': 'Hello world https://example.com/test',
          '@type': XSD.string,
        },
      }];
      schemas = await frameAndCombineSchemas([
        './test/assets/schemas/core.json',
        './test/assets/schemas/save-in-series-verb.json',
      ]);
      const sklEngine = new SKLEngine({ type: 'memory' });
      await sklEngine.save(schemas);
      const response = await sklEngine.verb.saveEntities({ entities });
      expect(response).toEqual(entities[0]);
    });

    it('destroy entities.', async(): Promise<void> => {
      const entities = [{
        '@id': 'https://example.com/data/1',
        '@type': 'https://schema.org/BlogPosting',
        'https://schema.org/articleBody': {
          '@value': 'Hello world https://example.com/test',
          '@type': XSD.string,
        },
      }];
      schemas = await frameAndCombineSchemas([
        './test/assets/schemas/core.json',
        './test/assets/schemas/destroy-in-series-verb.json',
      ]);
      const sklEngine = new SKLEngine({ type: 'memory' });
      await sklEngine.save(schemas);
      await sklEngine.save(entities);
      const response = await sklEngine.verb.destroyEntities({ entities });
      expect(response).toEqual(entities[0]);
    });

    it('finds an entity.', async(): Promise<void> => {
      const entity = {
        '@id': 'https://example.com/data/1',
        '@type': 'https://schema.org/BlogPosting',
        'https://schema.org/articleBody': {
          '@value': 'Hello world https://example.com/test',
          '@type': XSD.string,
        },
      };
      schemas = await frameAndCombineSchemas([
        './test/assets/schemas/core.json',
        './test/assets/schemas/find-in-series-verb.json',
      ]);
      const sklEngine = new SKLEngine({ type: 'memory' });
      await sklEngine.save(schemas);
      await sklEngine.save(entity);
      const response = await sklEngine.verb.findEntity({ where: { id: entity['@id'] }});
      expect(response).toEqual(entity);
    });

    it('finds multiple entities.', async(): Promise<void> => {
      const entities = [
        {
          '@id': 'https://example.com/data/1',
          '@type': 'https://schema.org/BlogPosting',
        },
        {
          '@id': 'https://example.com/data/2',
          '@type': 'https://schema.org/BlogPosting',
        },
      ];
      schemas = await frameAndCombineSchemas([
        './test/assets/schemas/core.json',
        './test/assets/schemas/findAll-in-series-verb.json',
      ]);
      const sklEngine = new SKLEngine({ type: 'memory' });
      await sklEngine.save(schemas);
      await sklEngine.save(entities);
      const response = await sklEngine.verb.findAllEntities({ where: { type: 'https://schema.org/BlogPosting' }});
      expect(response).toEqual(entities);
    });
  });

  describe('calling Verbs which have a parameter reference in their mappings', (): void => {
    it('gets data using the parameter reference.', async(): Promise<void> => {
      schemas = await frameAndCombineSchemas([
        './test/assets/schemas/core.json',
        './test/assets/schemas/exists-with-parameter-reference.json',
      ]);
      const sklEngine = new SKLEngine({ type: 'memory' });
      await sklEngine.save(schemas);
      const response = await sklEngine.verb.entitiesExist({ where: { type: SKL.Verb }});
      expect(response).toEqual(
        expect.objectContaining({
          [SKL_ENGINE.existsResult]: {
            '@type': XSD.boolean,
            '@value': true,
          },
        }),
      );
    });
  });

  describe('calling Triggers', (): void => {
    let executeOperation: any;
    let setOpenapiSpec: any;

    beforeEach(async(): Promise<void> => {
      schemas = await frameAndCombineSchemas([
        './test/assets/schemas/core.json',
        './test/assets/schemas/get-dropbox-file.json',
        './test/assets/schemas/trigger.json',
      ]);
    });

    it('can execute a Verb as result of a trigger.', async(): Promise<void> => {
      executeOperation = jest.fn().mockResolvedValue({ data: { cursor: 'abc123' }, config: {}});
      setOpenapiSpec = jest.fn();
      (OpenApiOperationExecutor as jest.Mock).mockReturnValue({
        executeOperation,
        setOpenapiSpec,
      });
      const sklEngine = new SKLEngine({ type: 'memory' });
      await sklEngine.save(schemas);
      await sklEngine.executeTrigger(
        'https://example.com/integrations/Dropbox',
        {},
      );
      expect(setOpenapiSpec).toHaveBeenCalledTimes(1);
      expect(executeOperation).toHaveBeenCalledTimes(1);
      expect(executeOperation).toHaveBeenCalledWith(
        'FilesListFolderGetLatestCursor',
        { accessToken: 'SPOOFED_TOKEN', bearerToken: undefined, apiKey: undefined, basePath: undefined },
        { path: '' },
      );
    });

    it('throws an error when no Trigger Verb Mapping exists for the integration.', async(): Promise<void> => {
      executeOperation = jest.fn();
      setOpenapiSpec = jest.fn();
      (OpenApiOperationExecutor as jest.Mock).mockReturnValue({
        executeOperation,
        setOpenapiSpec,
      });
      const sklEngine = new SKLEngine({ type: 'memory' });
      await sklEngine.save(schemas);
      await expect(sklEngine.executeTrigger(
        'https://example.com/integrations/GoogleDrive',
        {},
      )).rejects.toThrow('Failed to find a Trigger Verb mapping for integration https://example.com/integrations/GoogleDrive');
      expect(setOpenapiSpec).toHaveBeenCalledTimes(0);
      expect(executeOperation).toHaveBeenCalledTimes(0);
    });
  });

  describe('callbacks', (): void => {
    let executeOperation: any;
    let setOpenapiSpec: any;
    let executeSecuritySchemeStage: any;
    let callbacks: Callbacks;
    let onVerbEnd: any;
    let onVerbStart: any;

    beforeEach(async(): Promise<void> => {
      schemas = await frameAndCombineSchemas([
        './test/assets/schemas/core.json',
        './test/assets/schemas/get-dropbox-file.json',
      ]);
      executeOperation = jest.fn().mockResolvedValue({ data: mockDropboxFile, config: {}});
      executeSecuritySchemeStage = jest.fn().mockResolvedValue({ data: { access_token: 'newToken' }, config: {}});
      setOpenapiSpec = jest.fn();
      (OpenApiOperationExecutor as jest.Mock).mockReturnValue({
        executeOperation,
        setOpenapiSpec,
        executeSecuritySchemeStage,
      });
      onVerbEnd = jest.fn();
      onVerbStart = jest.fn();
      callbacks = {
        onVerbEnd,
        onVerbStart,
      };
    });

    it('calls the onVerbStart and onVerbEnd callbacks if they are defined.', async(): Promise<void> => {
      const sklEngine = new SKLEngine({ type: 'memory', callbacks });
      await sklEngine.save(schemas);
      const response = await sklEngine.verb.getFile({ account, id: '12345' });
      expect(response).toEqual(expectedGetFileResponse);
      expect(executeOperation).toHaveBeenCalledTimes(1);
      expect(executeOperation).toHaveBeenCalledWith(
        'FilesGetMetadata',
        { accessToken: 'SPOOFED_TOKEN', bearerToken: undefined, apiKey: undefined, basePath: undefined },
        { path: 'id:12345' },
      );
      expect(onVerbStart).toHaveBeenCalledTimes(1);
      expect(onVerbStart).toHaveBeenCalledWith('https://example.com/getFile', { account, id: '12345' });
      expect(onVerbEnd).toHaveBeenCalledTimes(1);
      expect(onVerbEnd).toHaveBeenCalledWith('https://example.com/getFile', expectedGetFileResponse);
    });

    it('calls the onVerbStart and onVerbEnd callbacks if they are defined in the verb\'s configuration.',
      async(): Promise<void> => {
        const sklEngine = new SKLEngine({ type: 'memory' });
        await sklEngine.save(schemas);
        const response = await sklEngine.verb.getFile({ account, id: '12345' }, { callbacks });
        expect(response).toEqual(expectedGetFileResponse);
        expect(executeOperation).toHaveBeenCalledTimes(1);
        expect(executeOperation).toHaveBeenCalledWith(
          'FilesGetMetadata',
          { accessToken: 'SPOOFED_TOKEN', bearerToken: undefined, apiKey: undefined, basePath: undefined },
          { path: 'id:12345' },
        );
        expect(onVerbStart).toHaveBeenCalledTimes(1);
        expect(onVerbStart).toHaveBeenCalledWith('https://example.com/getFile', { account, id: '12345' });
        expect(onVerbEnd).toHaveBeenCalledTimes(1);
        expect(onVerbEnd).toHaveBeenCalledWith('https://example.com/getFile', expectedGetFileResponse);
      });
  });

  it('throws an error when a valid mapping cannot be found.', async(): Promise<void> => {
    schemas = await frameAndCombineSchemas([
      './test/assets/schemas/core.json',
      './test/assets/schemas/get-dropbox-file.json',
    ]);
    const sklEngine = new SKLEngine({ type: 'memory' });
    await sklEngine.save(schemas);
    await expect(sklEngine.verb.getName({ entity: { [RDFS.label]: 'final.jpg' }}))
      .rejects.toThrow('No mapping found.');
  });

  it('throws an error if the operation is not supported.', async(): Promise<void> => {
    schemas = await frameAndCombineSchemas([
      './test/assets/schemas/core.json',
      './test/assets/schemas/get-dropbox-file.json',
    ]);
    schemas = schemas.map((schemaItem: any): any => {
      if (schemaItem['@id'] === 'https://example.com/data/4') {
        schemaItem['https://standardknowledge.com/ontologies/core/operationMapping']['http://www.w3.org/ns/r2rml#predicateObjectMap'] = [
          {
            '@type': 'http://www.w3.org/ns/r2rml#PredicateObjectMap',
            'http://www.w3.org/ns/r2rml#objectMap': {
              '@type': 'http://www.w3.org/ns/r2rml#ObjectMap',
              'http://www.w3.org/ns/r2rml#constant': 'GetFileFunction',
            },
            'http://www.w3.org/ns/r2rml#predicate': { '@id': 'https://example.com/function' },
          },
        ];
      }
      return schemaItem;
    });
    const sklEngine = new SKLEngine({ type: 'memory' });
    await sklEngine.save(schemas);
    await expect(sklEngine.verb.getFile({ account, id: '12345' }))
      .rejects.toThrow('Operation not supported.');
  });
});
