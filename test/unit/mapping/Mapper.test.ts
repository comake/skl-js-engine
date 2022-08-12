/* eslint-disable @typescript-eslint/naming-convention */
import { promises as fsPromises } from 'fs';
import * as path from 'path';
import * as jsonld from 'jsonld';
import { Mapper } from '../../../src/mapping/Mapper';

async function filePathToExpandedJson(filePath: string): Promise<jsonld.JsonLdDocument> {
  const framedMapping = await fsPromises.readFile(
    path.resolve(__dirname, filePath),
    { encoding: 'utf-8' },
  );
  return await jsonld.expand(JSON.parse(framedMapping));
}

describe('A Mapper', (): void => {
  let mapper: any;
  let data: any;
  let mapping: any;

  beforeEach(async(): Promise<void> => {
    mapper = new Mapper();
  });

  it(`applies an RML mapping to data and returns the frameObjects with
    all keys in context and json native values.`,
  async(): Promise<void> => {
    data = { field: 'abc123' };
    mapping = await filePathToExpandedJson('../../assets/schemas/simple-mapping.jsonld');
    const response = await mapper.apply(data, mapping);
    expect(response).toEqual({
      '@context': {
        field: 'https://skl.standard.storage/properties/field',
      },
      '@id': 'https://example.com/mapping/subject',
      '@type': 'https://skl.standard.storage/mappings/frameObject',
      field: 'abc123',
    });
  });

  it('adds a single rdf:type key into @type and unnests values to top level in returned json.',
    async(): Promise<void> => {
      data = { field: 'abc123' };
      mapping = await filePathToExpandedJson('../../assets/schemas/single-rdf-type-objectmap.jsonld');
      const response = await mapper.apply(data, mapping);
      expect(response).toEqual({
        '@context': {
          field: 'https://skl.standard.storage/properties/field',
        },
        '@id': 'https://example.com/mapping/subject',
        '@type': 'https://skl.standard.storage/mappings/frameObject',
        field: 'abc123',
      });
    });

  it('adds multiple rdf:type keys into @type and unnests values to top level in returned json.',
    async(): Promise<void> => {
      data = { field: 'abc123' };
      mapping = await filePathToExpandedJson('../../assets/schemas/multiple-rdf-type-objectmaps.jsonld');
      const response = await mapper.apply(data, mapping);
      expect(response).toEqual({
        '@context': {
          field: 'https://skl.standard.storage/properties/field',
        },
        '@id': 'https://example.com/mapping/subject',
        '@type': [
          'https://skl.standard.storage/mappings/frameObject',
          'https://example.com/person',
          'https://example.com/thing',
        ],
        field: 'abc123',
      });
    });

  it('frames and converts booleans to native type in the return value.', async(): Promise<void> => {
    data = { field: true };
    mapping = await filePathToExpandedJson('../../assets/schemas/boolean-datatype.jsonld');
    const response = await mapper.apply(data, mapping);
    expect(response).toEqual({
      '@context': {
        field: {
          '@id': 'https://skl.standard.storage/properties/field',
          '@type': 'http://www.w3.org/2001/XMLSchema#boolean',
        },
      },
      '@id': 'https://example.com/mapping/subject',
      '@type': 'https://skl.standard.storage/mappings/frameObject',
      field: true,
    });
  });

  it('frames and converts integers to native type in the return value.', async(): Promise<void> => {
    data = { field: [ 1, 2, 3 ]};
    mapping = await filePathToExpandedJson('../../assets/schemas/integer-datatype.jsonld');
    const response = await mapper.apply(data, mapping);
    expect(response).toEqual({
      '@context': {
        field: {
          '@id': 'https://skl.standard.storage/properties/field',
          '@type': 'http://www.w3.org/2001/XMLSchema#integer',
          '@container': '@set',
        },
      },
      '@id': 'https://example.com/mapping/subject',
      '@type': 'https://skl.standard.storage/mappings/frameObject',
      field: [ 1, 2, 3 ],
    });
  });

  it('frames and converts doubles to native type in the return value.', async(): Promise<void> => {
    data = { field: 3.14159 };
    mapping = await filePathToExpandedJson('../../assets/schemas/double-datatype.jsonld');
    const response = await mapper.apply(data, mapping);
    expect(response).toEqual({
      '@context': {
        field: {
          '@id': 'https://skl.standard.storage/properties/field',
          '@type': 'http://www.w3.org/2001/XMLSchema#double',
        },
      },
      '@id': 'https://example.com/mapping/subject',
      '@type': 'https://skl.standard.storage/mappings/frameObject',
      field: 3.14159,
    });
  });

  it('frames and converts an IRI termType.', async(): Promise<void> => {
    data = {};
    mapping = await filePathToExpandedJson('../../assets/schemas/non-array-iri.jsonld');
    const response = await mapper.apply(data, mapping);
    expect(response).toEqual({
      '@context': {
        integration: {
          '@id': 'https://skl.standard.storage/properties/integration',
          '@type': '@id',
        },
      },
      '@id': 'https://example.com/mapping/subject',
      '@type': 'https://skl.standard.storage/mappings/frameObject',
      integration: 'https://skl.standard.storage/integrations/Dropbox',
    });
  });

  it('frames converts an array of IRIs.', async(): Promise<void> => {
    data = {};
    mapping = await filePathToExpandedJson('../../assets/schemas/array-of-iris.jsonld');
    const response = await mapper.apply(data, mapping);
    expect(response).toEqual({
      '@context': {
        integration: {
          '@container': '@set',
          '@id': 'https://skl.standard.storage/properties/integration',
          '@type': '@id',
        },
      },
      '@id': 'https://example.com/mapping/subject',
      '@type': 'https://skl.standard.storage/mappings/frameObject',
      integration: [
        'https://skl.standard.storage/integrations/Dropbox',
        'https://skl.standard.storage/integrations/AirTable',
      ],
    });
  });
});
