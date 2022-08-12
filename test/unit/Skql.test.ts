/* eslint-disable @typescript-eslint/naming-convention */
import { OpenApiOperationExecutor } from '@comake/openapi-operation-executor/dist/web.js';
import { Skql } from '../../src/Skql';
import { MemoryQueryAdapter } from '../../src/storage/MemoryQueryAdapter';
import { SKL } from '../../src/util/Vocabularies';
import { frameAndCombineSchemas } from '../util/Util';

jest.mock('@comake/openapi-operation-executor/dist/web.js');

const account = 'https://skl.standard.storage/data/DropboxAccount1';
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
  '@context': {
    deleted: {
      '@id': 'https://skl.standard.storage/properties/deleted',
      '@type': 'http://www.w3.org/2001/XMLSchema#boolean',
    },
    integration: {
      '@id': 'https://skl.standard.storage/properties/integration',
      '@type': '@id',
    },
    isWeblink: {
      '@id': 'https://skl.standard.storage/properties/isWeblink',
      '@type': 'http://www.w3.org/2001/XMLSchema#boolean',
    },
    mimeType: 'https://skl.standard.storage/properties/mimeType',
    name: 'https://skl.standard.storage/properties/name',
    size: 'https://skl.standard.storage/properties/size',
    sourceId: 'https://skl.standard.storage/properties/sourceId',
  },
  '@id': 'https://skl.standard.storage/data/abc123',
  '@type': [
    'https://skl.standard.storage/mappings/frameObject',
    'https://skl.standard.storage/nouns/File',
  ],
  deleted: false,
  integration: 'https://skl.standard.storage/integrations/Dropbox',
  isWeblink: false,
  mimeType: 'text/plain',
  name: 'Prime_Numbers.txt',
  size: '7212',
  sourceId: 'id:12345',
};

const unsupportedVerb = {
  '@id': 'https://skl.standard.storage/verbs/doThis',
  '@type': 'https://skl.standard.storage/nouns/Verb',
};

const incorrectReturnValueMapping = {
  '@id': 'https://skl.standard.storage/data/4/returnValueMapping/1',
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
      'http://www.w3.org/ns/r2rml#object': { '@id': 'https://skl.standard.storage/mappings/frameObject' },
      'http://www.w3.org/ns/r2rml#predicate': { '@id': 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type' },
    },
    {
      '@type': 'http://www.w3.org/ns/r2rml#PredicateObjectMap',
      'http://www.w3.org/ns/r2rml#object': { '@id': 'https://skl.standard.storage/integrations/Dropbox' },
      'http://www.w3.org/ns/r2rml#predicate': { '@id': 'https://skl.standard.storage/properties/integration' },
    },
  ],
  'http://www.w3.org/ns/r2rml#subjectMap': {
    '@type': 'http://www.w3.org/ns/r2rml#SubjectMap',
    'http://www.w3.org/ns/r2rml#template': 'https://skl.standard.storage/data/abc123',
  },
};

describe('SKQL', (): void => {
  let schema: any[];

  describe('setting schema', (): void => {
    it('can set the schema from a variable.', async(): Promise<void> => {
      schema = [];
      expect(new Skql({ schema })).toBeInstanceOf(Skql);
    });

    it('throws an error if schemas are not supplied.', async(): Promise<void> => {
      expect((): void => {
        // eslint-disable-next-line no-new
        new Skql({});
      }).toThrow('No schema source found in setSchema args.');
    });
  });

  describe('finding schemas', (): void => {
    let skql: Skql;

    beforeEach(async(): Promise<void> => {
      schema = [{
        '@id': 'https://skl.standard.storage/verbs/Share',
        '@type': 'https://skl.standard.storage/verbs/OpenApiOperationVerb',
      }];
      skql = new Skql({ schema });
    });

    afterEach((): void => {
      jest.restoreAllMocks();
    });

    it('delegates calls to find to the query adapter.', async(): Promise<void> => {
      const findSpy = jest.spyOn(MemoryQueryAdapter.prototype, 'find');
      await expect(skql.find({ id: 'https://skl.standard.storage/verbs/Share' })).resolves.toEqual(schema[0]);
      expect(findSpy).toHaveBeenCalledTimes(1);
      expect(findSpy).toHaveBeenCalledWith({ id: 'https://skl.standard.storage/verbs/Share' });
    });

    it('throws an error if there is no schema matching the query.', async(): Promise<void> => {
      const findSpy = jest.spyOn(MemoryQueryAdapter.prototype, 'find');
      await expect(skql.find({ id: 'https://skl.standard.storage/verbs/Send' })).rejects.toThrow(
        'No schema found with fields matching {"id":"https://skl.standard.storage/verbs/Send"}',
      );
      expect(findSpy).toHaveBeenCalledTimes(1);
      expect(findSpy).toHaveBeenCalledWith({ id: 'https://skl.standard.storage/verbs/Send' });
    });

    it('delegates calls to findAll to the query adapter.', async(): Promise<void> => {
      const findAllSpy = jest.spyOn(MemoryQueryAdapter.prototype, 'findAll');
      await expect(skql.findAll({ id: 'https://skl.standard.storage/verbs/Share' })).resolves.toEqual([ schema[0] ]);
      expect(findAllSpy).toHaveBeenCalledTimes(1);
      expect(findAllSpy).toHaveBeenCalledWith({ id: 'https://skl.standard.storage/verbs/Share' });
    });
  });

  describe('executing OpenApiOperationVerbs', (): void => {
    let executeOperation: any;
    let setOpenapiSpec: any;

    beforeEach(async(): Promise<void> => {
      schema = await frameAndCombineSchemas([
        './test/assets/schemas/core.jsonld',
        './test/assets/schemas/get-dropbox-file.jsonld',
      ]);
      executeOperation = jest.fn().mockResolvedValue({ data: mockDropboxFile });
      setOpenapiSpec = jest.fn();
      (OpenApiOperationExecutor as jest.Mock).mockReturnValue({ executeOperation, setOpenapiSpec });
    });

    it('can execute an OpenApiOperationVerb.', async(): Promise<void> => {
      const skql = new Skql({ schema });
      const response = await skql.do.getFile({ account, id: '12345' });
      expect(response).toEqual(expectedGetFileResponse);
    });

    it('errors if the executed verb is not defined.', async(): Promise<void> => {
      schema = schema.filter((schemaItem: any): boolean => schemaItem['@id'] !== 'https://skl.standard.storage/verbs/getFile');
      const skql = new Skql({ schema });
      await expect(skql.do.getFile({ account, id: '12345' })).rejects.toThrow(Error);
      await expect(skql.do.getFile({ account, id: '12345' })).rejects.toThrow(
        'Failed to find the verb getFile in the schema',
      );
    });

    it('errors if the parameters do not conform to the verb parameter schema.', async(): Promise<void> => {
      const skql = new Skql({ schema });
      await expect(skql.do.getFile({ id: '12345' })).rejects.toThrow(Error);
      await expect(skql.do.getFile({ id: '12345' })).rejects.toThrow(
        'getFile parameters do not conform to the schema',
      );
    });

    it('errors if the return value does not conform to the verb return value schema.', async(): Promise<void> => {
      schema.forEach((schemaItem: any): void => {
        if (schemaItem['@id'] === 'https://skl.standard.storage/data/4') {
          schemaItem['https://skl.standard.storage/properties/returnValueMapping'] = incorrectReturnValueMapping;
        }
      });
      const skql = new Skql({ schema });
      await expect(skql.do.getFile({ account, id: '12345' })).rejects.toThrow(Error);
      await expect(skql.do.getFile({ account, id: '12345' })).rejects.toThrow(
        'Return value https://skl.standard.storage/data/abc123 does not conform to the schema',
      );
    });

    it('errors if no mapping for the verb and the integration is in the schema.', async(): Promise<void> => {
      schema = schema.filter((schemaItem: any): boolean => schemaItem['@id'] !== 'https://skl.standard.storage/data/4');
      const skql = new Skql({ schema });
      await expect(skql.do.getFile({ account, id: '12345' })).rejects.toThrow(Error);
      await expect(skql.do.getFile({ account, id: '12345' })).rejects.toThrow([
        'No schema found with fields matching',
        '{"type":"https://skl.standard.storage/nouns/VerbIntegrationMapping","https://skl.standard.storage/properties/verb":"https://skl.standard.storage/verbs/getFile","https://skl.standard.storage/properties/integration":"https://skl.standard.storage/integrations/Dropbox"}',
      ].join(' '));
    });

    it('errors if no open api description for the integration is in the schema.', async(): Promise<void> => {
      schema = schema.filter((schemaItem: any): boolean => schemaItem['@id'] !== 'https://skl.standard.storage/data/DropboxOpenApiDescription');
      const skql = new Skql({ schema });
      await expect(skql.do.getFile({ account, id: '12345' })).rejects.toThrow(Error);
      await expect(skql.do.getFile({ account, id: '12345' })).rejects.toThrow([
        'No schema found with fields matching',
        '{"type":"https://skl.standard.storage/nouns/OpenApiDescription","https://skl.standard.storage/properties/integration":"https://skl.standard.storage/integrations/Dropbox"}',
      ].join(' '));
    });

    it('errors if no security credentials for the account is in the schema.', async(): Promise<void> => {
      schema = schema.filter((schemaItem: any): boolean => schemaItem['@id'] !== 'https://skl.standard.storage/data/DropboxAccount1SecurityCredentials');
      const skql = new Skql({ schema });
      await expect(skql.do.getFile({ account, id: '12345' })).rejects.toThrow(Error);
      await expect(skql.do.getFile({ account, id: '12345' })).rejects.toThrow([
        'No schema found with fields matching',
        '{"type":"https://skl.standard.storage/nouns/SecurityCredentials","https://skl.standard.storage/properties/account":"https://skl.standard.storage/data/DropboxAccount1"}',
      ].join(' '));
    });

    it('validates the verbs return value against a nested returnType schema.', async(): Promise<void> => {
      schema = schema.map((schemaItem: any): any => {
        if (schemaItem['@id'] === 'https://skl.standard.storage/verbs/getFile') {
          schemaItem[SKL.returnValueProperty] = {
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
                'http://www.w3.org/ns/shacl#path': { '@id': 'https://skl.standard.storage/properties/name' },
              },
            ],
          };
        }
        return schemaItem;
      });

      const skql = new Skql({ schema });
      const response = await skql.do.getFile({ account, id: '12345' });
      expect(response).toEqual(expectedGetFileResponse);
    });

    it('errors if the returnType schema is not properly formatted.', async(): Promise<void> => {
      schema = schema.map((schemaItem: any): any => {
        if (schemaItem['@id'] === 'https://skl.standard.storage/verbs/getFile') {
          schemaItem[SKL.returnValueProperty] = {};
        }
        return schemaItem;
      });

      const skql = new Skql({ schema });
      await expect(skql.do.getFile({ account, id: '12345' }))
        .rejects.toThrow('returnTypeSchema is not properly formatted.');
    });
  });

  describe('executing NounMappingVerbs', (): void => {
    let executeOperation: any;
    let setOpenapiSpec: any;

    beforeEach(async(): Promise<void> => {
      schema = await frameAndCombineSchemas([
        './test/assets/schemas/core.jsonld',
        './test/assets/schemas/get-dropbox-file.jsonld',
      ]);
      executeOperation = jest.fn().mockResolvedValue({ data: mockDropboxFile });
      setOpenapiSpec = jest.fn();
      (OpenApiOperationExecutor as jest.Mock).mockReturnValue({ executeOperation, setOpenapiSpec });
    });

    it('can execute a NounMappingVerb.', async(): Promise<void> => {
      const skql = new Skql({ schema });
      const response = await skql.do.sync({
        noun: 'https://skl.standard.storage/nouns/File',
        account,
        id: '12345',
      });
      expect(response).toEqual(expectedGetFileResponse);
    });
  });

  it('throws an error when trying to execute an unsupported verb type.', async(): Promise<void> => {
    const skql = new Skql({ schema: [ ...schema, unsupportedVerb ]});
    await expect(skql.do.doThis({ account }))
      .rejects.toThrow('Verb type https://skl.standard.storage/nouns/Verb not supported.');
  });
});
