/* eslint-disable @typescript-eslint/naming-convention */
import { Mapper } from '../../../src/mapping/Mapper';
import arrayOfIris from '../../assets/schemas/array-of-iris.json';
import booleanDataType from '../../assets/schemas/boolean-datatype.json';
import doubleDataType from '../../assets/schemas/double-datatype.json';
import integerDatatype from '../../assets/schemas/integer-datatype.json';
import multipleRdfTypeObjectMaps from '../../assets/schemas/multiple-rdf-type-objectmaps.json';
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
      const response = await mapper.apply(data, mapping, { '@id': 'https://example.com/mapping/subject' });
      expect(response).toEqual({
        '@id': 'https://example.com/mapping/subject',
        'https://skl.standard.storage/properties/field': 'abc123',
      });
    });

  it('adds a single rdf:type key into @type and unnests values to top level in returned json.',
    async(): Promise<void> => {
      data = { field: 'abc123' };
      mapping = await expandJsonLd(singleRdfTypeObject);
      const response = await mapper.apply(data, mapping, { '@id': 'https://example.com/mapping/subject' });
      expect(response).toEqual({
        '@id': 'https://example.com/mapping/subject',
        '@type': 'https://skl.standard.storage/MappingSubject',
        'https://skl.standard.storage/properties/field': 'abc123',
      });
    });

  it('adds multiple rdf:type keys into @type and unnests values to top level in returned json.',
    async(): Promise<void> => {
      data = { field: 'abc123' };
      mapping = await expandJsonLd(multipleRdfTypeObjectMaps);
      const response = await mapper.apply(data, mapping, { '@id': 'https://example.com/mapping/subject' });
      expect(response).toEqual({
        '@id': 'https://example.com/mapping/subject',
        '@type': [
          'https://example.com/person',
          'https://example.com/thing',
        ],
        'https://skl.standard.storage/properties/field': 'abc123',
      });
    });

  it('frames and converts booleans to native type in the return value.', async(): Promise<void> => {
    data = { field: true };
    mapping = await expandJsonLd(booleanDataType);
    const response = await mapper.apply(data, mapping, { '@id': 'https://example.com/mapping/subject' });
    expect(response).toEqual({
      '@context': {
        'https://skl.standard.storage/properties/field': {
          '@type': 'http://www.w3.org/2001/XMLSchema#boolean',
        },
      },
      '@id': 'https://example.com/mapping/subject',
      'https://skl.standard.storage/properties/field': true,
    });
  });

  describe('without framing SKL properties', (): void => {
    it('frames and converts integers to native type in the return value.', async(): Promise<void> => {
      data = { field: [ 1, 2, 3 ]};
      mapping = await expandJsonLd(integerDatatype);
      const response = await mapper.apply(data, mapping, { '@id': 'https://example.com/mapping/subject' });
      expect(response).toEqual({
        '@context': {
          'https://skl.standard.storage/properties/field': {
            '@type': 'http://www.w3.org/2001/XMLSchema#integer',
            '@container': '@set',
          },
        },
        '@id': 'https://example.com/mapping/subject',
        'https://skl.standard.storage/properties/field': [ 1, 2, 3 ],
      });
    });

    it('frames and converts doubles to native type in the return value.', async(): Promise<void> => {
      data = { field: 3.14159 };
      mapping = await expandJsonLd(doubleDataType);
      const response = await mapper.apply(data, mapping, { '@id': 'https://example.com/mapping/subject' });
      expect(response).toEqual({
        '@context': {
          'https://skl.standard.storage/properties/field': {
            '@type': 'http://www.w3.org/2001/XMLSchema#double',
          },
        },
        '@id': 'https://example.com/mapping/subject',
        'https://skl.standard.storage/properties/field': 3.14159,
      });
    });

    it('frames and converts an IRI termType.', async(): Promise<void> => {
      data = {};
      mapping = await expandJsonLd(nonArrayIri);
      const response = await mapper.apply(data, mapping, { '@id': 'https://example.com/mapping/subject' });
      expect(response).toEqual({
        '@context': {
          'https://skl.standard.storage/properties/integration': { '@type': '@id' },
        },
        '@id': 'https://example.com/mapping/subject',
        'https://skl.standard.storage/properties/integration': 'https://skl.standard.storage/integrations/Dropbox',
      });
    });

    it('frames converts an array of IRIs.', async(): Promise<void> => {
      data = {};
      mapping = await expandJsonLd(arrayOfIris);
      const response = await mapper.apply(data, mapping, { '@id': 'https://example.com/mapping/subject' });
      expect(response).toEqual({
        '@context': {
          'https://skl.standard.storage/properties/integration': {
            '@container': '@set',
            '@type': '@id',
          },
        },
        '@id': 'https://example.com/mapping/subject',
        'https://skl.standard.storage/properties/integration': [
          'https://skl.standard.storage/integrations/Dropbox',
          'https://skl.standard.storage/integrations/AirTable',
        ],
      });
    });
  });

  describe('framing SKL properties', (): void => {
    it('frames and converts integers to native type in the return value.', async(): Promise<void> => {
      data = { field: [ 1, 2, 3 ]};
      mapping = await expandJsonLd(integerDatatype);
      const response = await mapper.applyAndFrameSklProperties(data, mapping, { '@id': 'https://example.com/mapping/subject' });
      expect(response).toEqual({
        '@context': {
          field: {
            '@id': 'https://skl.standard.storage/properties/field',
            '@type': 'http://www.w3.org/2001/XMLSchema#integer',
            '@container': '@set',
          },
        },
        '@id': 'https://example.com/mapping/subject',
        field: [ 1, 2, 3 ],
      });
    });

    it('frames and converts doubles to native type in the return value.', async(): Promise<void> => {
      data = { field: 3.14159 };
      mapping = await expandJsonLd(doubleDataType);
      const response = await mapper.applyAndFrameSklProperties(data, mapping, { '@id': 'https://example.com/mapping/subject' });
      expect(response).toEqual({
        '@context': {
          field: {
            '@id': 'https://skl.standard.storage/properties/field',
            '@type': 'http://www.w3.org/2001/XMLSchema#double',
          },
        },
        '@id': 'https://example.com/mapping/subject',
        field: 3.14159,
      });
    });

    it('frames and converts an IRI termType.', async(): Promise<void> => {
      data = {};
      mapping = await expandJsonLd(nonArrayIri);
      const response = await mapper.applyAndFrameSklProperties(data, mapping, { '@id': 'https://example.com/mapping/subject' });
      expect(response).toEqual({
        '@context': {
          integration: {
            '@id': 'https://skl.standard.storage/properties/integration',
            '@type': '@id',
          },
        },
        '@id': 'https://example.com/mapping/subject',
        integration: 'https://skl.standard.storage/integrations/Dropbox',
      });
    });

    it('frames converts an array of IRIs.', async(): Promise<void> => {
      data = {};
      mapping = await expandJsonLd(arrayOfIris);
      const response = await mapper.applyAndFrameSklProperties(data, mapping, { '@id': 'https://example.com/mapping/subject' });
      expect(response).toEqual({
        '@context': {
          integration: {
            '@id': 'https://skl.standard.storage/properties/integration',
            '@container': '@set',
            '@type': '@id',
          },
        },
        '@id': 'https://example.com/mapping/subject',
        integration: [
          'https://skl.standard.storage/integrations/Dropbox',
          'https://skl.standard.storage/integrations/AirTable',
        ],
      });
    });
  });
});
