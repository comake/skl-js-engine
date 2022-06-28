/* eslint-disable @typescript-eslint/naming-convention */
import { OpenApiOperationExecutor } from '../../src/openapi/OpenApiOperationExecutor';
import { SKQL } from '../../src/Skql';
import { frameAndCombineSchemas } from '../../src/util/Util';

jest.mock('../../src/openapi/OpenApiOperationExecutor');

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

const incorrectReturnValueMapping = {
  '@id': 'https://skl.standard.storage/data/4/returnValueMappings/1',
  '@type': 'http://www.w3.org/ns/r2rml#TriplesMap',
  'http://semweb.mmlab.be/ns/rml#logicalSource': {
    '@type': 'http://semweb.mmlab.be/ns/rml#LogicalSource',
    'http://semweb.mmlab.be/ns/rml#iterator': '$',
    'http://semweb.mmlab.be/ns/rml#referenceFormulation': 'http://semweb.mmlab.be/ns/ql#JSONPath',
    'http://semweb.mmlab.be/ns/rml#source': 'input.json',
  },
  'http://www.w3.org/ns/r2rml#predicateObjectMap': [
    {
      '@type': 'http://www.w3.org/ns/r2rml#PredicateObjectMap',
      'http://www.w3.org/ns/r2rml#object': 'https://skl.standard.storage/mappings/frameObject',
      'http://www.w3.org/ns/r2rml#predicate': 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
    },
    {
      '@type': 'http://www.w3.org/ns/r2rml#PredicateObjectMap',
      'http://www.w3.org/ns/r2rml#object': 'https://skl.standard.storage/integrations/Dropbox',
      'http://www.w3.org/ns/r2rml#predicate': 'https://skl.standard.storage/properties/integration',
    },
  ],
  'http://www.w3.org/ns/r2rml#subjectMap': {
    '@type': 'http://www.w3.org/ns/r2rml#SubjectMap',
    'http://www.w3.org/ns/r2rml#constant': 'https://skl.standard.storage/data/abc123',
  },
};

describe('SKQL', (): void => {
  describe('setting schema', (): void => {
    it('can set the schema from a variable.', async(): Promise<void> => {
      const schema = [{}];
      await expect(SKQL.setSchema({ schema })).resolves.toBeUndefined();
    });
    it('can set the schema from a file.', async(): Promise<void> => {
      const file = './test/assets/schemas/simple-mapping.jsonld';
      await expect(SKQL.setSchema({ file })).resolves.toBeUndefined();
    });
    it('errors if it cannot read schemas from the supplied file.', async(): Promise<void> => {
      const file = './test/assets/schemas/mapping-file-that-does-not-exist.jsonld';
      await expect(SKQL.setSchema({ file })).rejects.toThrow(Error);
      await expect(SKQL.setSchema({ file })).rejects.toThrow(
        'Failed to parse schemas from the supplied file.',
      );
    });
    it('errors if schemas are not specified via a file or variable.', async(): Promise<void> => {
      await expect(SKQL.setSchema({})).rejects.toThrow(Error);
      await expect(SKQL.setSchema({})).rejects.toThrow('No schema source found in setSchema args.');
    });
  });

  describe('executing verbs', (): void => {
    const account = 'https://skl.standard.storage/data/DropboxAccount1';
    let schema: any;
    let executeOperation: any;

    beforeEach(async(): Promise<void> => {
      schema = await frameAndCombineSchemas([
        './test/assets/schemas/core.jsonld',
        './test/assets/schemas/get-dropbox-file.jsonld',
      ]);
      executeOperation = jest.fn().mockResolvedValue({ data: mockDropboxFile });
      (OpenApiOperationExecutor as jest.Mock).mockReturnValue({ executeOperation });
    });

    it('can execute a verb.', async(): Promise<void> => {
      await SKQL.setSchema({ schema });
      const response = await SKQL.getFile({ account, id: '12345' });
      expect(response).toEqual({
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
        name: 'Prime_Numbers.txt',
        size: '7212',
        sourceId: 'id:12345',
      });
    });
    it('errors if the executed verb is not defined.', async(): Promise<void> => {
      schema = schema.filter((schemaItem: any): boolean => schemaItem['@id'] !== 'https://skl.standard.storage/verbs/getFile');
      await SKQL.setSchema({ schema });
      await expect(SKQL.getFile({ account, id: '12345' })).rejects.toThrow(Error);
      await expect(SKQL.getFile({ account, id: '12345' })).rejects.toThrow(
        'Failed to find the verb getFile in the schema',
      );
    });
    it('errors if the parameters do not conform to the verb parameter schema.', async(): Promise<void> => {
      await SKQL.setSchema({ schema });
      await expect(SKQL.getFile({ id: '12345' })).rejects.toThrow(Error);
      await expect(SKQL.getFile({ id: '12345' })).rejects.toThrow(
        'getFile parameters do not conform to the schema',
      );
    });
    it('errors if the return value does not conform to the verb return value schema.', async(): Promise<void> => {
      schema.forEach((schemaItem: any): void => {
        if (schemaItem['@id'] === 'https://skl.standard.storage/data/4') {
          schemaItem['https://skl.standard.storage/properties/returnValueMappings'] = incorrectReturnValueMapping;
        }
      });
      await SKQL.setSchema({ schema });
      await expect(SKQL.getFile({ account, id: '12345' })).rejects.toThrow(Error);
      await expect(SKQL.getFile({ account, id: '12345' })).rejects.toThrow(
        'Return value https://skl.standard.storage/data/abc123 does not conform to the schema',
      );
    });
    it('errors if no mapping for the verb and the integration is in the schema.', async(): Promise<void> => {
      schema = schema.filter((schemaItem: any): boolean => schemaItem['@id'] !== 'https://skl.standard.storage/data/4');
      await SKQL.setSchema({ schema });
      await expect(SKQL.getFile({ account, id: '12345' })).rejects.toThrow(Error);
      await expect(SKQL.getFile({ account, id: '12345' })).rejects.toThrow([
        'No schema found with fields matching',
        '{"@type":"https://skl.standard.storage/nouns/VerbIntegrationMapping","https://skl.standard.storage/properties/verb":"https://skl.standard.storage/verbs/getFile","https://skl.standard.storage/properties/integration":"https://skl.standard.storage/integrations/Dropbox"}',
      ].join(' '));
    });
    it('errors if no open api description for the integration is in the schema.', async(): Promise<void> => {
      schema = schema.filter((schemaItem: any): boolean => schemaItem['@id'] !== 'https://skl.standard.storage/data/DropboxOpenApiDescription');
      await SKQL.setSchema({ schema });
      await expect(SKQL.getFile({ account, id: '12345' })).rejects.toThrow(Error);
      await expect(SKQL.getFile({ account, id: '12345' })).rejects.toThrow([
        'No schema found with fields matching',
        '{"@type":"https://skl.standard.storage/nouns/OpenApiDescription","https://skl.standard.storage/properties/integration":"https://skl.standard.storage/integrations/Dropbox"}',
      ].join(' '));
    });
    it('errors if no oauth token for the account is in the schema.', async(): Promise<void> => {
      schema = schema.filter((schemaItem: any): boolean => schemaItem['@id'] !== 'https://skl.standard.storage/data/DropboxAccount1OauthTokens');
      await SKQL.setSchema({ schema });
      await expect(SKQL.getFile({ account, id: '12345' })).rejects.toThrow(Error);
      await expect(SKQL.getFile({ account, id: '12345' })).rejects.toThrow([
        'No schema found with fields matching',
        '{"@type":"https://skl.standard.storage/nouns/OauthToken","https://skl.standard.storage/properties/account":"https://skl.standard.storage/data/DropboxAccount1"}',
      ].join(' '));
    });
  });
});
