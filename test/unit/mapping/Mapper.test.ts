/* eslint-disable @typescript-eslint/naming-convention */
import { Mapper } from '../../../src/mapping/Mapper';
import arrayOfIris from '../../assets/schemas/array-of-iris.json';
import booleanDataType from '../../assets/schemas/boolean-datatype.json';
import doubleDataType from '../../assets/schemas/double-datatype.json';
import integerDatatype from '../../assets/schemas/integer-datatype.json';
import multipleRdfTypeObjectMaps from '../../assets/schemas/multiple-rdf-type-objectmaps.json';
import nestedField from '../../assets/schemas/nested-field.json';
import nonArrayIri from '../../assets/schemas/non-array-iri.json';
import simpleMapping from '../../assets/schemas/simple-mapping.json';
import singleRdfTypeObject from '../../assets/schemas/single-rdf-type-objectmap.json';
import { expandJsonLd } from '../../util/Util';

describe('A Mapper', (): void => {
  let mapper: any;
  let data: any;
  let mapping: any;

  beforeEach(async(): Promise<void> => {
    mapper = new Mapper();
  });

  it('applies an RML mapping to data and returns the framed return value with json native values.',
    async(): Promise<void> => {
      data = { field: 'abc123' };
      mapping = await expandJsonLd(simpleMapping);
      const response = await mapper.apply(data, mapping);
      expect(response).toEqual({
        'https://example.com/field': 'abc123',
      });
    });

  it('adds a single rdf:type key into @type and unnests values to top level in returned json.',
    async(): Promise<void> => {
      data = { field: 'abc123' };
      mapping = await expandJsonLd(singleRdfTypeObject);
      const response = await mapper.apply(data, mapping);
      expect(response).toEqual({
        '@type': 'https://example.com/MappingSubject',
        'https://example.com/field': 'abc123',
      });
    });

  it('adds multiple rdf:type keys into @type and unnests values to top level in returned json.',
    async(): Promise<void> => {
      data = { field: 'abc123' };
      mapping = await expandJsonLd(multipleRdfTypeObjectMaps);
      const response = await mapper.apply(data, mapping);
      expect(response).toEqual({
        '@type': [
          'https://example.com/person',
          'https://example.com/thing',
        ],
        'https://example.com/field': 'abc123',
      });
    });

  it('frames and converts booleans to native type in the return value.', async(): Promise<void> => {
    data = { field: true };
    mapping = await expandJsonLd(booleanDataType);
    const response = await mapper.apply(data, mapping);
    expect(response).toEqual({
      'https://example.com/field': {
        '@type': 'http://www.w3.org/2001/XMLSchema#boolean',
        '@value': true,
      },
    });
  });

  it('frames an array of integers.', async(): Promise<void> => {
    data = { field: [ 1, 2, 3 ]};
    const frame = {
      '@context': {
        field: {
          '@id': 'https://example.com/field',
          '@type': 'http://www.w3.org/2001/XMLSchema#integer',
        },
      },
    };
    mapping = await expandJsonLd(integerDatatype);
    const response = await mapper.apply(data, mapping, frame);
    expect(response).toEqual({
      '@context': {
        field: {
          '@id': 'https://example.com/field',
          '@type': 'http://www.w3.org/2001/XMLSchema#integer',
        },
      },
      field: [ 1, 2, 3 ],
    });
  });

  it('frames and converts doubles to native type in the return value.', async(): Promise<void> => {
    data = { field: 3.14159 };
    const frame = {
      '@context': {
        field: {
          '@id': 'https://example.com/field',
          '@type': 'http://www.w3.org/2001/XMLSchema#double',
        },
      },
    };
    mapping = await expandJsonLd(doubleDataType);
    const response = await mapper.apply(data, mapping, frame);
    expect(response).toEqual({
      '@context': {
        field: {
          '@id': 'https://example.com/field',
          '@type': 'http://www.w3.org/2001/XMLSchema#double',
        },
      },
      field: 3.14159,
    });
  });

  it('frames an IRI termType.', async(): Promise<void> => {
    data = {};
    const frame = {
      '@context': {
        integration: {
          '@type': '@id',
          '@id': 'https://example.com/integration',
        },
      },
      '@id': 'https://example.com/mappingSubject',
    };
    mapping = await expandJsonLd(nonArrayIri);
    const response = await mapper.apply(data, mapping, frame);
    expect(response).toEqual({
      '@context': {
        integration: {
          '@id': 'https://example.com/integration',
          '@type': '@id',
        },
      },
      '@id': 'https://example.com/mappingSubject',
      integration: 'https://example.com/integrations/Dropbox',
    });
  });

  it('frames an array of IRIs.', async(): Promise<void> => {
    data = {};
    const frame = {
      '@context': {
        integration: {
          '@type': '@id',
          '@id': 'https://example.com/integration',
        },
      },
      '@id': 'https://example.com/mappingSubject',
    };
    mapping = await expandJsonLd(arrayOfIris);
    const response = await mapper.apply(data, mapping, frame);
    expect(response).toEqual({
      '@context': {
        integration: {
          '@id': 'https://example.com/integration',
          '@type': '@id',
        },
      },
      '@id': 'https://example.com/mappingSubject',
      integration: [
        'https://example.com/integrations/Dropbox',
        'https://example.com/integrations/AirTable',
      ],
    });
  });

  it('frames a nested field.', async(): Promise<void> => {
    data = { field: 'abc123' };
    const frame = {
      '@context': {
        field: {
          '@id': 'https://example.com/field',
        },
        nestedField: {
          '@id': 'https://example.com/nestedField',
        },
      },
      '@id': 'https://example.com/mappingSubject',
    };
    mapping = await expandJsonLd(nestedField);
    const response = await mapper.apply(data, mapping, frame);
    expect(response).toEqual({
      '@context': {
        field: {
          '@id': 'https://example.com/field',
        },
        nestedField: {
          '@id': 'https://example.com/nestedField',
        },
      },
      '@id': 'https://example.com/mappingSubject',
      nestedField: {
        field: 'abc123',
      },
    });
  });

  it('frames a nested field as an array.', async(): Promise<void> => {
    data = { field: 'abc123' };
    const frame = {
      '@context': {
        field: {
          '@id': 'https://example.com/field',
        },
        nestedField: {
          '@container': '@set',
          '@id': 'https://example.com/nestedField',
        },
      },
      '@id': 'https://example.com/mappingSubject',
    };
    mapping = await expandJsonLd(nestedField);
    const response = await mapper.apply(data, mapping, frame);
    expect(response).toEqual({
      '@context': {
        field: {
          '@id': 'https://example.com/field',
        },
        nestedField: {
          '@container': '@set',
          '@id': 'https://example.com/nestedField',
        },
      },
      '@id': 'https://example.com/mappingSubject',
      nestedField: [{
        field: 'abc123',
      }],
    });
  });
});
