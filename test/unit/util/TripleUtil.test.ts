/* eslint-disable @typescript-eslint/naming-convention */
import DataFactory from '@rdfjs/data-model';
import type { Quad } from '@rdfjs/types';
import { rdfTypeNamedNode, triplesToJsonld, valueToLiteral } from '../../../src/util/TripleUtil';
import { RDF, SKL, XSD } from '../../../src/util/Vocabularies';

const data1 = DataFactory.namedNode('https://example.com/data/1');
const data2 = DataFactory.namedNode('https://example.com/data/2');
const file = DataFactory.namedNode(SKL.File);

describe('TripleUtil', (): void => {
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
  });

  describe('#valueToLiteral', (): void => {
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
  });
});
