/* eslint-disable @typescript-eslint/naming-convention */
import DataFactory from '@rdfjs/data-model';
import type { Quad } from '@rdfjs/types';
import { rdfTypeNamedNode, triplesToJsonld, valueToLiteral, toJSValueFromDataType } from '../../../src/util/TripleUtil';
import { RDF, SKL, XSD } from '../../../src/util/Vocabularies';

const data1 = DataFactory.namedNode('https://example.com/data/1');
const data2 = DataFactory.namedNode('https://example.com/data/2');
const file = DataFactory.namedNode(SKL.File);

describe('TripleUtil', (): void => {
  describe('#toJSValueFromDataType', (): void => {
    it('returns an float for data with datatype xsd:decimal, xsd:double, xsd:float.', (): void => {
      expect(toJSValueFromDataType('3.14', XSD.decimal)).toBe(3.14);
      expect(toJSValueFromDataType('222.333', XSD.decimal)).toBe(222.333);
      expect(toJSValueFromDataType('0.1', XSD.decimal)).toBe(0.1);
    });

    it('returns an integer for data with datatype xsd:integer, xsd:positiveInteger, xsd:negativeInteger, xsd:int.',
      (): void => {
        expect(toJSValueFromDataType('3', XSD.integer)).toBe(3);
        expect(toJSValueFromDataType('1000', XSD.integer)).toBe(1000);
        expect(toJSValueFromDataType('0', XSD.integer)).toBe(0);
        // eslint-disable-next-line unicorn/no-zero-fractions
        expect(toJSValueFromDataType('10', XSD.integer)).toBe(10.0);
      });

    it('returns a literal with datatype xsd:boolean for booleans.', (): void => {
      expect(toJSValueFromDataType('true', XSD.boolean)).toBe(true);
      expect(toJSValueFromDataType('false', XSD.boolean)).toBe(false);
      expect(toJSValueFromDataType('true', XSD.boolean)).toBe(true);
      expect(toJSValueFromDataType('false', XSD.boolean)).toBe(false);
      expect(toJSValueFromDataType('magic', XSD.boolean)).toBe('magic');
    });

    it('returns a literal with datatype xsd:string for non numbers and booleans.', (): void => {
      expect(toJSValueFromDataType('string', XSD.string)).toBe('string');
    });
  });

  describe('#triplesToJsonld', (): void => {
    let triples: Quad[];

    it('converts the rdf:type predicate to @type.', async(): Promise<void> => {
      triples = [{
        subject: data1,
        predicate: rdfTypeNamedNode,
        object: file,
      }] as Quad[];
      await expect(triplesToJsonld(triples)).resolves.toEqual({
        '@id': 'https://example.com/data/1',
        '@type': SKL.File,
      });
    });

    it('converts triples with the same predicate into an array.', async(): Promise<void> => {
      triples = [
        {
          subject: data1,
          predicate: rdfTypeNamedNode,
          object: file,
        },
        {
          subject: data1,
          predicate: rdfTypeNamedNode,
          object: DataFactory.namedNode('https://example.com/File'),
        },
        {
          subject: data1,
          predicate: rdfTypeNamedNode,
          object: DataFactory.namedNode('https://example.com/DigitalThing'),
        },
      ] as Quad[];
      await expect(triplesToJsonld(triples)).resolves.toEqual({
        '@id': 'https://example.com/data/1',
        '@type': [ SKL.File, 'https://example.com/File', 'https://example.com/DigitalThing' ],
      });
    });

    it('frames blank nodes.', async(): Promise<void> => {
      const blank = DataFactory.blankNode('c1');
      triples = [
        {
          subject: data1,
          predicate: rdfTypeNamedNode,
          object: file,
        },
        {
          subject: data1,
          predicate: DataFactory.namedNode('https://example.com/pred'),
          object: blank,
        },
        {
          subject: blank,
          predicate: DataFactory.namedNode('https://example.com/pred2'),
          object: DataFactory.literal('value'),
        },
      ] as Quad[];
      await expect(triplesToJsonld(triples)).resolves.toEqual({
        '@id': 'https://example.com/data/1',
        '@type': SKL.File,
        'https://example.com/pred': {
          'https://example.com/pred2': {
            '@value': 'value',
            '@type': XSD.string,
          },
        },
      });
    });

    it('references named nodes.', async(): Promise<void> => {
      triples = [
        {
          subject: data1,
          predicate: rdfTypeNamedNode,
          object: file,
        },
        {
          subject: data1,
          predicate: DataFactory.namedNode('https://example.com/pred'),
          object: DataFactory.namedNode('https://example.com/data/3'),
        },
      ] as Quad[];
      await expect(triplesToJsonld(triples)).resolves.toEqual({
        '@id': 'https://example.com/data/1',
        '@type': SKL.File,
        'https://example.com/pred': {
          '@id': 'https://example.com/data/3',
        },
      });
    });

    it('adds language tags.', async(): Promise<void> => {
      triples = [
        {
          subject: data1,
          predicate: rdfTypeNamedNode,
          object: file,
        },
        {
          subject: data1,
          predicate: DataFactory.namedNode('https://example.com/pred'),
          object: DataFactory.literal('adios', 'sp'),
        },
      ] as Quad[];
      await expect(triplesToJsonld(triples)).resolves.toEqual({
        '@id': 'https://example.com/data/1',
        '@type': SKL.File,
        'https://example.com/pred': {
          '@value': 'adios',
          '@language': 'sp',
        },
      });
    });

    it('parses xsd:int, xsd:positiveInteger, xsd:negativeInteger, xsd:integer.', async(): Promise<void> => {
      triples = [
        {
          subject: data1,
          predicate: rdfTypeNamedNode,
          object: file,
        },
        {
          subject: data1,
          predicate: DataFactory.namedNode('https://example.com/pred'),
          object: DataFactory.literal('1', XSD.int),
        },
        {
          subject: data1,
          predicate: DataFactory.namedNode('https://example.com/pred'),
          object: DataFactory.literal('2', XSD.integer),
        },
        {
          subject: data1,
          predicate: DataFactory.namedNode('https://example.com/pred'),
          object: DataFactory.literal('3', XSD.positiveInteger),
        },
        {
          subject: data1,
          predicate: DataFactory.namedNode('https://example.com/pred'),
          object: DataFactory.literal('-4', XSD.negativeInteger),
        },
      ] as Quad[];
      await expect(triplesToJsonld(triples)).resolves.toEqual({
        '@id': 'https://example.com/data/1',
        '@type': SKL.File,
        'https://example.com/pred': [
          { '@value': 1, '@type': XSD.int },
          { '@value': 2, '@type': XSD.integer },
          { '@value': 3, '@type': XSD.positiveInteger },
          { '@value': -4, '@type': XSD.negativeInteger },
        ],
      });
    });

    it('parses xsd:boolean.', async(): Promise<void> => {
      triples = [
        {
          subject: data1,
          predicate: rdfTypeNamedNode,
          object: file,
        },
        {
          subject: data1,
          predicate: DataFactory.namedNode('https://example.com/pred'),
          object: DataFactory.literal('false', XSD.boolean),
        },
      ] as Quad[];
      await expect(triplesToJsonld(triples)).resolves.toEqual({
        '@id': 'https://example.com/data/1',
        '@type': SKL.File,
        'https://example.com/pred': { '@value': false, '@type': XSD.boolean },
      });
    });

    it('parses xsd:double, xsd:decimal, and xsd:float.', async(): Promise<void> => {
      triples = [
        {
          subject: data1,
          predicate: rdfTypeNamedNode,
          object: file,
        },
        {
          subject: data1,
          predicate: DataFactory.namedNode('https://example.com/pred'),
          object: DataFactory.literal('3.14', XSD.decimal),
        },
        {
          subject: data1,
          predicate: DataFactory.namedNode('https://example.com/pred'),
          object: DataFactory.literal('33.11', XSD.double),
        },
        {
          subject: data1,
          predicate: DataFactory.namedNode('https://example.com/pred'),
          object: DataFactory.literal('0.1', XSD.float),
        },
      ] as Quad[];
      await expect(triplesToJsonld(triples)).resolves.toEqual({
        '@id': 'https://example.com/data/1',
        '@type': SKL.File,
        'https://example.com/pred': [
          { '@value': 3.14, '@type': XSD.decimal },
          { '@value': 33.11, '@type': XSD.double },
          { '@value': 0.1, '@type': XSD.float },
        ],
      });
    });

    it('parses rdf:json.', async(): Promise<void> => {
      triples = [
        {
          subject: data1,
          predicate: rdfTypeNamedNode,
          object: file,
        },
        {
          subject: data1,
          predicate: DataFactory.namedNode('https://example.com/pred'),
          object: DataFactory.literal('{"foo":"bar"}', RDF.JSON),
        },
      ] as Quad[];
      await expect(triplesToJsonld(triples)).resolves.toEqual({
        '@id': 'https://example.com/data/1',
        '@type': SKL.File,
        'https://example.com/pred': {
          '@value': { foo: 'bar' },
          '@type': '@json',
        },
      });
    });

    it('returns an array of node objects if there are multiple non blank nodes.', async(): Promise<void> => {
      triples = [
        {
          subject: data1,
          predicate: rdfTypeNamedNode,
          object: file,
        } as Quad,
        {
          subject: data2,
          predicate: rdfTypeNamedNode,
          object: file,
        } as Quad,
      ];
      await expect(triplesToJsonld(triples)).resolves.toEqual([
        {
          '@id': 'https://example.com/data/1',
          '@type': SKL.File,
        },
        {
          '@id': 'https://example.com/data/2',
          '@type': SKL.File,
        },
      ]);
    });

    it('maintains order of nodes in the input triples.', async(): Promise<void> => {
      triples = [
        {
          subject: DataFactory.namedNode('https://example.com/data/def'),
          predicate: rdfTypeNamedNode,
          object: file,
        } as Quad,
        {
          subject: DataFactory.namedNode('https://example.com/data/abc'),
          predicate: rdfTypeNamedNode,
          object: file,
        } as Quad,
      ];
      await expect(triplesToJsonld(triples)).resolves.toEqual([
        {
          '@id': 'https://example.com/data/def',
          '@type': SKL.File,
        },
        {
          '@id': 'https://example.com/data/abc',
          '@type': SKL.File,
        },
      ]);
    });

    it('frames the results according to the relations field.', async(): Promise<void> => {
      const predicate = DataFactory.namedNode('https://example.com/pred');
      const predicate2 = DataFactory.namedNode('https://example.com/pred2');
      const data3 = DataFactory.namedNode('https://example.com/data/3');
      const article = DataFactory.namedNode('https://example.com/Article');
      triples = [
        {
          subject: data1,
          predicate: rdfTypeNamedNode,
          object: file,
        } as Quad,
        {
          subject: data1,
          predicate,
          object: data2,
        } as Quad,
        {
          subject: data2,
          predicate: rdfTypeNamedNode,
          object: article,
        } as Quad,
        {
          subject: data2,
          predicate: predicate2,
          object: data3,
        } as Quad,
        {
          subject: data3,
          predicate: rdfTypeNamedNode,
          object: article,
        } as Quad,
      ];
      const relations = {
        'https://example.com/pred': {
          'https://example.com/pred2': true,
        },
      };
      await expect(triplesToJsonld(triples, relations)).resolves.toEqual({
        '@id': 'https://example.com/data/1',
        '@type': SKL.File,
        'https://example.com/pred': {
          '@id': 'https://example.com/data/2',
          '@type': 'https://example.com/Article',
          'https://example.com/pred2': {
            '@id': 'https://example.com/data/3',
            '@type': 'https://example.com/Article',
          },
        },
      });
    });
  });

  describe('#valueToLiteral', (): void => {
    let now: Date;

    beforeAll((): void => {
      jest.useFakeTimers('modern');
      jest.setSystemTime(new Date('2022-08-12T00:00:00.000Z'));
      now = new Date();
    });

    afterAll((): void => {
      jest.useRealTimers();
    });

    it('returns a literal with datatype xsd:decimal for decimals.', (): void => {
      expect(valueToLiteral(3.14)).toEqual(DataFactory.literal('3.14', XSD.decimal));
      expect(valueToLiteral(222.333)).toEqual(DataFactory.literal('222.333', XSD.decimal));
      expect(valueToLiteral(0.1)).toEqual(DataFactory.literal('0.1', XSD.decimal));
    });

    it('returns a literal with datatype xsd:integer for integers.', (): void => {
      expect(valueToLiteral(3)).toEqual(DataFactory.literal('3', XSD.integer));
      expect(valueToLiteral(1000)).toEqual(DataFactory.literal('1000', XSD.integer));
      expect(valueToLiteral(0)).toEqual(DataFactory.literal('0', XSD.integer));
      // eslint-disable-next-line unicorn/no-zero-fractions
      expect(valueToLiteral(10.0)).toEqual(DataFactory.literal('10', XSD.integer));
    });

    it('returns a literal with datatype xsd:boolean for booleans.', (): void => {
      expect(valueToLiteral(true)).toEqual(DataFactory.literal('true', XSD.boolean));
      expect(valueToLiteral(false)).toEqual(DataFactory.literal('false', XSD.boolean));
    });

    it('returns a literal with datatype xsd:string for non numbers and booleans.', (): void => {
      expect(valueToLiteral('string')).toEqual(DataFactory.literal('string', XSD.string));
    });

    it('returns a literal with datatype xsd:datetime for dates.', (): void => {
      expect(valueToLiteral(now)).toEqual(DataFactory.literal('2022-08-12T00:00:00.000Z', XSD.dateTime));
    });
  });
});
