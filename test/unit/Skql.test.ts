/* eslint-disable @typescript-eslint/naming-convention */
import { OpenApiOperationExecutor } from '@comake/openapi-operation-executor';
import { AxiosError } from 'axios';
import type { NodeObject } from 'jsonld';
import type { SKLEngineOptions } from '../../src/sklEngine';
import { SKLEngine } from '../../src/sklEngine';
import type { QueryAdapterType } from '../../src/storage/BaseQueryAdapterOptions';
import { MemoryQueryAdapter } from '../../src/storage/memory/MemoryQueryAdapter';
import { SKL, RDFS } from '../../src/util/Vocabularies';
import simpleMapping from '../assets/schemas/simple-mapping.json';
import { frameAndCombineSchemas, expandJsonLd } from '../util/Util';

jest.mock('@comake/openapi-operation-executor');

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
    'http://semweb.mmlab.be/ns/rml#iterator': '$',
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
        } as SKLEngineOptions,
      );
    }).toThrow('No schema source found in setSchema args.');
  });

  describe('Memory', (): void => {
    it('sets the schema.', async(): Promise<void> => {
      expect(new SKLEngine({ type: 'memory', schemas: []})).toBeInstanceOf(SKLEngine);
    });
  });

  describe('Sparql', (): void => {
    it('initializes.', async(): Promise<void> => {
      const sparqlEndpoint = 'https://localhost:9999';
      expect(new SKLEngine({ type: 'sparql', endpointUrl: sparqlEndpoint })).toBeInstanceOf(SKLEngine);
    });
  });

  describe('CRUD on schemas', (): void => {
    let skql: SKLEngine;

    beforeEach(async(): Promise<void> => {
      schemas = [{
        '@id': 'https://standardknowledge.com/ontologies/core/Share',
        '@type': 'https://standardknowledge.com/ontologies/core/Verb',
      }];
      skql = new SKLEngine({ type: 'memory', schemas });
    });

    afterEach((): void => {
      jest.restoreAllMocks();
    });

    it('delegates calls to executeRawQuery to the query adapter.', async(): Promise<void> => {
      const executeRawQuerySpy = jest.spyOn(MemoryQueryAdapter.prototype, 'executeRawQuery');
      await expect(skql.executeRawQuery('')).resolves.toEqual([]);
      expect(executeRawQuerySpy).toHaveBeenCalledTimes(1);
      expect(executeRawQuerySpy).toHaveBeenCalledWith('');
    });

    it('delegates calls to executeRawEntityQuery to the query adapter.', async(): Promise<void> => {
      const executeRawEntityQuerySpy = jest.spyOn(MemoryQueryAdapter.prototype, 'executeRawEntityQuery');
      await expect(skql.executeRawEntityQuery('', {})).resolves.toEqual({ '@graph': []});
      expect(executeRawEntityQuerySpy).toHaveBeenCalledTimes(1);
      expect(executeRawEntityQuerySpy).toHaveBeenCalledWith('', {});
    });

    it('delegates calls to find to the query adapter.', async(): Promise<void> => {
      const findSpy = jest.spyOn(MemoryQueryAdapter.prototype, 'find');
      await expect(skql.find({ where: { id: 'https://standardknowledge.com/ontologies/core/Share' }})).resolves.toEqual(schemas[0]);
      expect(findSpy).toHaveBeenCalledTimes(1);
      expect(findSpy).toHaveBeenCalledWith({ where: { id: 'https://standardknowledge.com/ontologies/core/Share' }});
    });

    it('throws an error if there is no schema matching the query during find.', async(): Promise<void> => {
      const findSpy = jest.spyOn(MemoryQueryAdapter.prototype, 'find');
      await expect(skql.find({ where: { id: 'https://standardknowledge.com/ontologies/core/Send' }})).rejects.toThrow(
        'No schema found with fields matching {"where":{"id":"https://standardknowledge.com/ontologies/core/Send"}}',
      );
      expect(findSpy).toHaveBeenCalledTimes(1);
      expect(findSpy).toHaveBeenCalledWith({ where: { id: 'https://standardknowledge.com/ontologies/core/Send' }});
    });

    it('delegates calls to findBy to the query adapter.', async(): Promise<void> => {
      const findBySpy = jest.spyOn(MemoryQueryAdapter.prototype, 'findBy');
      await expect(skql.findBy({ id: 'https://standardknowledge.com/ontologies/core/Share' })).resolves.toEqual(schemas[0]);
      expect(findBySpy).toHaveBeenCalledTimes(1);
      expect(findBySpy).toHaveBeenCalledWith({ id: 'https://standardknowledge.com/ontologies/core/Share' });
    });

    it('throws an error if there is no schema matching the query during findBy.', async(): Promise<void> => {
      const findBySpy = jest.spyOn(MemoryQueryAdapter.prototype, 'findBy');
      await expect(skql.findBy({ id: 'https://standardknowledge.com/ontologies/core/Send' })).rejects.toThrow(
        'No schema found with fields matching {"id":"https://standardknowledge.com/ontologies/core/Send"}',
      );
      expect(findBySpy).toHaveBeenCalledTimes(1);
      expect(findBySpy).toHaveBeenCalledWith({ id: 'https://standardknowledge.com/ontologies/core/Send' });
    });

    it('delegates calls to findAll to the query adapter.', async(): Promise<void> => {
      const findAllSpy = jest.spyOn(MemoryQueryAdapter.prototype, 'findAll');
      await expect(skql.findAll({ where: { id: 'https://standardknowledge.com/ontologies/core/Share' }})).resolves.toEqual([ schemas[0] ]);
      expect(findAllSpy).toHaveBeenCalledTimes(1);
      expect(findAllSpy).toHaveBeenCalledWith({ where: { id: 'https://standardknowledge.com/ontologies/core/Share' }});
    });

    it('delegates calls to findAllBy to the query adapter.', async(): Promise<void> => {
      const findAllBySpy = jest.spyOn(MemoryQueryAdapter.prototype, 'findAllBy');
      await expect(skql.findAllBy({ id: 'https://standardknowledge.com/ontologies/core/Share' })).resolves.toEqual([ schemas[0] ]);
      expect(findAllBySpy).toHaveBeenCalledTimes(1);
      expect(findAllBySpy).toHaveBeenCalledWith({ id: 'https://standardknowledge.com/ontologies/core/Share' });
    });

    it('delegates calls to exists to the query adapter.', async(): Promise<void> => {
      const existsSpy = jest.spyOn(MemoryQueryAdapter.prototype, 'exists');
      await expect(skql.exists({ id: 'https://standardknowledge.com/ontologies/core/Share' })).resolves.toBe(true);
      expect(existsSpy).toHaveBeenCalledTimes(1);
      expect(existsSpy).toHaveBeenCalledWith({ id: 'https://standardknowledge.com/ontologies/core/Share' });
    });

    it('delegates calls to count to the query adapter.', async(): Promise<void> => {
      const countSpy = jest.spyOn(MemoryQueryAdapter.prototype, 'count');
      await expect(skql.count({ id: 'https://standardknowledge.com/ontologies/core/Share' })).resolves.toBe(0);
      expect(countSpy).toHaveBeenCalledTimes(1);
      expect(countSpy).toHaveBeenCalledWith({ id: 'https://standardknowledge.com/ontologies/core/Share' });
    });

    it('delegates calls to save a single entity to the query adapter.', async(): Promise<void> => {
      const saveSpy = jest.spyOn(MemoryQueryAdapter.prototype, 'save');
      const res = await skql.save({
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
      const saveSpy = jest.spyOn(MemoryQueryAdapter.prototype, 'save');
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
      const res = await skql.save(entities);
      expect(res).toEqual(entities);
      expect(saveSpy).toHaveBeenCalledTimes(1);
      expect(saveSpy).toHaveBeenCalledWith(entities);
    });

    it('delegates calls to destroy a single entity to the query adapter.', async(): Promise<void> => {
      const destroySpy = jest.spyOn(MemoryQueryAdapter.prototype, 'destroy');
      const entity = {
        '@id': 'https://standardknowledge.com/ontologies/core/Share',
        '@type': 'https://standardknowledge.com/ontologies/core/Verb',
      };
      await skql.save(entity);
      const res = await skql.destroy(entity);
      expect(res).toEqual(entity);
      expect(destroySpy).toHaveBeenCalledTimes(1);
      expect(destroySpy).toHaveBeenCalledWith(entity);
    });

    it('delegates calls to destroy miltiple entities to the query adapter.', async(): Promise<void> => {
      const destroySpy = jest.spyOn(MemoryQueryAdapter.prototype, 'destroy');
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
      await skql.save(entities);
      const res = await skql.destroy(entities);
      expect(res).toEqual(entities);
      expect(destroySpy).toHaveBeenCalledTimes(1);
      expect(destroySpy).toHaveBeenCalledWith(entities);
    });

    it('delegates calls to destroyAll to the query adapter.', async(): Promise<void> => {
      const destroyAllSpy = jest.spyOn(MemoryQueryAdapter.prototype, 'destroyAll');
      const res = await skql.destroyAll();
      expect(res).toBeUndefined();
      expect(destroyAllSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('mapping data', (): void => {
    let skql: SKLEngine;

    beforeEach(async(): Promise<void> => {
      schemas = [{
        '@id': 'https://standardknowledge.com/ontologies/core/Share',
        '@type': 'https://standardknowledge.com/ontologies/core/Verb',
      }];
      skql = new SKLEngine({ type: 'memory', schemas });
    });

    it('maps data and converts it to json without a frame.', async(): Promise<void> => {
      const data = { field: 'abc123' };
      const mapping = await expandJsonLd(simpleMapping);
      const response = await skql.performMappingAndConvertToJSON(data, mapping as NodeObject);
      expect(response).toEqual({
        'https://example.com/field': 'abc123',
      });
    });

    it('maps data and converts it to json with a frame.', async(): Promise<void> => {
      const data = { field: 'abc123' };
      const frame = {
        '@context': {
          field: 'https://example.com/field',
        },
      };
      const mapping = await expandJsonLd(simpleMapping);
      const response = await skql.performMappingAndConvertToJSON(data, mapping as NodeObject, frame);
      expect(response).toEqual({
        field: 'abc123',
      });
    });

    it('maps data without converting it to json.', async(): Promise<void> => {
      const data = { field: 'abc123' };
      const frame = {
        '@context': {
          field: 'https://example.com/field',
        },
      };
      const mapping = await expandJsonLd(simpleMapping);
      const response = await skql.performMapping(data, mapping as NodeObject, frame);
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
      executeOperation = jest.fn().mockResolvedValue({ data: mockDropboxFile });
      executeSecuritySchemeStage = jest.fn().mockResolvedValue({ data: { access_token: 'newToken' }});
      setOpenapiSpec = jest.fn();
      (OpenApiOperationExecutor as jest.Mock).mockReturnValue({
        executeOperation,
        setOpenapiSpec,
        executeSecuritySchemeStage,
      });
    });

    it('can execute an OpenApiOperationVerb.', async(): Promise<void> => {
      const skql = new SKLEngine({ type: 'memory', schemas });
      const response = await skql.verb.getFile({ account, id: '12345' });
      expect(response).toEqual(expectedGetFileResponse);
      expect(executeOperation).toHaveBeenCalledTimes(1);
      expect(executeOperation).toHaveBeenCalledWith(
        'FilesGetMetadata',
        { accessToken: 'SPOOFED_TOKEN', apiKey: undefined, basePath: undefined },
        { path: 'id:12345' },
      );
    });

    it('returns the raw response if the openapi operation mapping does not have a return value mapping.',
      async(): Promise<void> => {
        schemas = schemas.map((schemaItem: any): any => {
          if (schemaItem['@id'] === 'https://example.com/data/4') {
            // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
            delete schemaItem[SKL.returnValueMapping];
          }
          return schemaItem;
        });
        const skql = new SKLEngine({ type: 'memory', schemas });
        const response = await skql.verb.getFile({ account, id: '12345' });
        expect(response).toEqual({ data: mockDropboxFile });
        expect(executeOperation).toHaveBeenCalledTimes(1);
        expect(executeOperation).toHaveBeenCalledWith(
          'FilesGetMetadata',
          { accessToken: 'SPOOFED_TOKEN', apiKey: undefined, basePath: undefined },
          { path: 'id:12345' },
        );
      });

    it('errors if the executed verb is not defined.', async(): Promise<void> => {
      schemas = schemas.filter((schemaItem: any): boolean => schemaItem['@id'] !== 'https://example.com/getFile');
      const skql = new SKLEngine({ type: 'memory', schemas });
      await expect(skql.verb.getFile({ account, id: '12345' })).rejects.toThrow(
        'Failed to find the verb getFile in the schema',
      );
      expect(executeOperation).toHaveBeenCalledTimes(0);
    });

    it('errors if the parameters do not conform to the verb parameter schema.', async(): Promise<void> => {
      const skql = new SKLEngine({ type: 'memory', schemas });
      await expect(skql.verb.getFile({ account, ids: [ '12345' ]})).rejects.toThrow(
        'getFile parameters do not conform to the schema',
      );
      expect(executeOperation).toHaveBeenCalledTimes(0);
    });

    it('errors if the return value does not conform to the verb return value schema.', async(): Promise<void> => {
      schemas.forEach((schemaItem: any): void => {
        if (schemaItem['@id'] === 'https://example.com/data/4') {
          schemaItem['https://standardknowledge.com/ontologies/core/returnValueMapping'] = incorrectReturnValueMapping;
        }
      });
      const skql = new SKLEngine({ type: 'memory', schemas });
      await expect(skql.verb.getFile({ account, id: '12345' })).rejects.toThrow(
        'Return value https://example.com/data/abc123 does not conform to the schema',
      );
      expect(executeOperation).toHaveBeenCalledTimes(1);
      expect(executeOperation).toHaveBeenCalledWith(
        'FilesGetMetadata',
        { accessToken: 'SPOOFED_TOKEN', apiKey: undefined, basePath: undefined },
        { path: 'id:12345' },
      );
    });

    it('errors if no mapping for the verb and the integration is in the schema.', async(): Promise<void> => {
      schemas = schemas.filter((schemaItem: any): boolean => schemaItem['@id'] !== 'https://example.com/data/4');
      const skql = new SKLEngine({ type: 'memory', schemas });
      await expect(skql.verb.getFile({ account, id: '12345' })).rejects.toThrow([
        'No schema found with fields matching',
        '{"type":"https://standardknowledge.com/ontologies/core/VerbIntegrationMapping","https://standardknowledge.com/ontologies/core/verb":"https://example.com/getFile","https://standardknowledge.com/ontologies/core/integration":"https://example.com/integrations/Dropbox"}',
      ].join(' '));
      expect(executeOperation).toHaveBeenCalledTimes(0);
    });

    it('errors if no open api description for the integration is in the schema.', async(): Promise<void> => {
      schemas = schemas.filter((schemaItem: any): boolean => schemaItem['@id'] !== 'https://example.com/data/DropboxOpenApiDescription');
      const skql = new SKLEngine({ type: 'memory', schemas });
      await expect(skql.verb.getFile({ account, id: '12345' })).rejects.toThrow([
        'No schema found with fields matching',
        '{"type":"https://standardknowledge.com/ontologies/core/OpenApiDescription","https://standardknowledge.com/ontologies/core/integration":"https://example.com/integrations/Dropbox"}',
      ].join(' '));
      expect(executeOperation).toHaveBeenCalledTimes(0);
    });

    it(`sends the request with undefined security credentials if no 
    security credentials for the account are in the schema.`,
    async(): Promise<void> => {
      schemas = schemas.filter((schemaItem: any): boolean => schemaItem['@id'] !== 'https://example.com/data/DropboxAccount1SecurityCredentials');
      const skql = new SKLEngine({ type: 'memory', schemas });
      const response = await skql.verb.getFile({ account, id: '12345' });
      expect(response).toEqual(expectedGetFileResponse);
      expect(executeOperation).toHaveBeenCalledTimes(1);
      expect(executeOperation).toHaveBeenCalledWith(
        'FilesGetMetadata',
        { accessToken: undefined, apiKey: undefined, basePath: undefined },
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

      const skql = new SKLEngine({ type: 'memory', schemas });
      const response = await skql.verb.getFile({ account, id: '12345' });
      expect(response).toEqual(expectedGetFileResponse);
      expect(executeOperation).toHaveBeenCalledTimes(1);
      expect(executeOperation).toHaveBeenCalledWith(
        'FilesGetMetadata',
        { accessToken: 'SPOOFED_TOKEN', apiKey: undefined, basePath: undefined },
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
      const skql = new SKLEngine({ type: 'memory', schemas });
      const response = await skql.verb.getFile({ account, id: '12345' });
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
        { grant_type: 'refresh_token', refresh_token: 'SPOOFED_REFRESH_TOKEN' },
      );
    });

    it(`refreshes the access token and retries the operation if it fails 
    with an invalid token error matching the integration configuration with no messageRegex.`,
    async(): Promise<void> => {
      schemas = schemas.map((schemaItem: any): any => {
        if (schemaItem['@id'] === 'https://example.com/integrations/Dropbox') {
          schemaItem[SKL.invalidTokenErrorMatcher] = {
            '@type': '@json',
            '@value': { status: 400 },
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
      const skql = new SKLEngine({ type: 'memory', schemas });
      const response = await skql.verb.getFile({ account, id: '12345' });
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
        { grant_type: 'refresh_token', refresh_token: 'SPOOFED_REFRESH_TOKEN' },
      );
    });

    it('throws an error if the operation fails with an error other than invalid token.', async(): Promise<void> => {
      executeOperation.mockRejectedValueOnce(
        new AxiosError('Internal Server Error', undefined, undefined, { status: 500 }),
      );
      const skql = new SKLEngine({ type: 'memory', schemas });
      await expect(skql.verb.getFile({ account, id: '12345' })).rejects.toThrow('Internal Server Error');
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
      const skql = new SKLEngine({ type: 'memory', schemas });
      await expect(skql.verb.authorizeWithPkceOauth({ account })).resolves.toEqual({
        '@type': '@json',
        '@value': response,
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
      const skql = new SKLEngine({ type: 'memory', schemas });
      await expect(skql.verb.getFile({ account, id: '12345' })).rejects.toThrow(Error);
      await expect(skql.verb.getFile({ account, id: '12345' })).rejects.toThrow(
        'Failed to find the verb getFile in the schema',
      );
    });

    it('can execute an OpenApiSecuritySchemeVerb that maps to the tokenUrl stage.', async(): Promise<void> => {
      response = { data: { access_token: 'abc123' }};
      executeSecuritySchemeStage = jest.fn().mockResolvedValue(response);
      (OpenApiOperationExecutor as jest.Mock).mockReturnValue({ executeSecuritySchemeStage, setOpenapiSpec });
      const skql = new SKLEngine({ type: 'memory', schemas });
      const res = await skql.verb.getOauthTokens({ account, codeVerifier: 'something', code: 'dummy_code' });
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
      response = { data: { message: 'Access Denied' }};
      executeSecuritySchemeStage = jest.fn().mockResolvedValue(response);
      (OpenApiOperationExecutor as jest.Mock).mockReturnValue({ executeSecuritySchemeStage, setOpenapiSpec });
      const skql = new SKLEngine({ type: 'memory', schemas });
      const res = await skql.verb.authorizeWithPkceOauth({ account });
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
        response = { data: { access_token: 'abc123' }};
        executeSecuritySchemeStage = jest.fn().mockResolvedValue(response);
        (OpenApiOperationExecutor as jest.Mock).mockReturnValue({ executeSecuritySchemeStage, setOpenapiSpec });
        const skql = new SKLEngine({ type: 'memory', schemas });
        const res = await skql.verb.getOauthTokens({ account: 'https://example.com/data/StubhubAccount1' });
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

  describe('calling Verbs which map a Noun to another Verb', (): void => {
    let executeOperation: any;
    let setOpenapiSpec: any;

    beforeEach(async(): Promise<void> => {
      schemas = await frameAndCombineSchemas([
        './test/assets/schemas/core.json',
        './test/assets/schemas/get-dropbox-file.json',
      ]);
      executeOperation = jest.fn().mockResolvedValue({ data: mockDropboxFile });
      setOpenapiSpec = jest.fn();
      (OpenApiOperationExecutor as jest.Mock).mockReturnValue({ executeOperation, setOpenapiSpec });
    });

    it('can execute a NounMappedVerb.', async(): Promise<void> => {
      const skql = new SKLEngine({ type: 'memory', schemas });
      const response = await skql.verb.sync({
        noun: 'https://standardknowledge.com/ontologies/core/File',
        account,
        id: '12345',
      });
      expect(response).toEqual(expectedGetFileResponse);
    });

    it('can execute a NounMappedVerb with only a mapping.', async(): Promise<void> => {
      const skql = new SKLEngine({ type: 'memory', schemas });
      const response = await skql.verb.getName({
        noun: 'https://standardknowledge.com/ontologies/core/File',
        entity: { [RDFS.label]: 'final.jpg', [SKL.sourceId]: 12345 },
      });
      expect(response).toEqual({
        [RDFS.label]: 'final.jpg',
      });
    });
  });

  describe('calling Verbs which use data from a data source', (): void => {
    it('gets data from a JsonDataSource from the data field.', async(): Promise<void> => {
      schemas = await frameAndCombineSchemas([
        './test/assets/schemas/core.json',
        './test/assets/schemas/get-dropbox-file.json',
        './test/assets/schemas/json-file-data-source.json',
      ]);
      const skql = new SKLEngine({ type: 'memory', schemas });
      const response = await skql.verb.getFile({
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
      const skql = new SKLEngine({
        type: 'memory',
        schemas,
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
      const response = await skql.verb.getFile({
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
      const skql = new SKLEngine({ type: 'memory', schemas, inputFiles: {}});
      await expect(skql.verb.getFile({
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
        if (schemaItem['@id'] === 'https://example.com/data/JsonSourceDataSource') {
          schemaItem['@type'] = 'https://standardknowledge.com/ontologies/core/CsvDataSource';
        }
        return schemaItem;
      });
      const skql = new SKLEngine({ type: 'memory', schemas });
      await expect(skql.verb.getFile({
        account: 'https://example.com/data/JsonSourceAccount1',
        id: '12345',
      }))
        .rejects.toThrow('DataSource type https://standardknowledge.com/ontologies/core/CsvDataSource is not supported.');
    });
  });

  it('throws an error when a noun or account is not supplied with the Verb.', async(): Promise<void> => {
    const skql = new SKLEngine({ type: 'memory', schemas });
    await expect(skql.verb.getName({ entity: { [RDFS.label]: 'final.jpg' }}))
      .rejects.toThrow('Verb parameters must include either a noun or an account.');
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
    const skql = new SKLEngine({ type: 'memory', schemas });
    await expect(skql.verb.getFile({ account, id: '12345' }))
      .rejects.toThrow('Operation not supported.');
  });
});
