/* eslint-disable @typescript-eslint/naming-convention */
import { RDF, XSD } from '@comake/rmlmapper-js';
import DataFactory from '@rdfjs/data-model';
import { SparqlUpdateBuilder } from '../../../../src/storage/sparql/SparqlUpdateBuilder';
import {
  created,
  modified,
  now,
  objectNode,
  predicateNode,
  rdfTypeNamedNode,
  subjectNode,
} from '../../../../src/util/TripleUtil';
import { SKL } from '../../../../src/util/Vocabularies';

const c1 = DataFactory.variable('c1');
const c2 = DataFactory.variable('c2');
const c3 = DataFactory.variable('c3');
const c4 = DataFactory.variable('c4');
const c5 = DataFactory.variable('c5');
const c6 = DataFactory.variable('c6');

const data1 = DataFactory.namedNode('https://example.com/data/1');
const data2 = DataFactory.namedNode('https://example.com/data/2');
const file = DataFactory.namedNode(SKL.File);
const blank = DataFactory.blankNode('c4');

describe('A SparqlUpdateBuilder', (): void => {
  let builder: SparqlUpdateBuilder;

  beforeEach(async(): Promise<void> => {
    builder = new SparqlUpdateBuilder();
  });

  it('builds an update query for an entity.', (): void => {
    const entity = {
      '@id': 'https://example.com/data/1',
      '@type': SKL.File,
      'https://example.com/jsonLiteral': {
        '@value': { foo: 'bar' },
        '@type': '@json',
      },
      'https://example.com/languageLiteral': {
        '@value': 'hello',
        '@language': '@en',
      },
      'https://example.com/numberLiteral': {
        '@value': 1,
        '@type': XSD.integer,
      },
      'https://example.com/stringLiteral': 'marshmellow',
      'https://example.com/objectStringLiteral': {
        '@value': 'puffin',
      },
      'https://example.com/nested': {
        '@type': 'https://example.com/Comment',
        'https://example.com/body': 'What an aweful file',
      },
      'https://example.com/reference': {
        '@id': 'https://example.com/data/3',
      },
    };
    const query = {
      type: 'update',
      prefixes: {},
      updates: [
        {
          updateType: 'deletewhere',
          delete: [
            {
              type: 'graph',
              name: data1,
              triples: [{ subject: c1, predicate: c2, object: c3 }],
            },
          ],
        },
        {
          updateType: 'insert',
          insert: [
            {
              type: 'graph',
              name: data1,
              triples: [
                { subject: data1, predicate: rdfTypeNamedNode, object: file },
                {
                  subject: data1,
                  predicate: DataFactory.namedNode('https://example.com/jsonLiteral'),
                  object: DataFactory.literal('{"foo":"bar"}', RDF.JSON),
                },
                {
                  subject: data1,
                  predicate: DataFactory.namedNode('https://example.com/languageLiteral'),
                  object: DataFactory.literal('hello', '@en'),
                },
                {
                  subject: data1,
                  predicate: DataFactory.namedNode('https://example.com/numberLiteral'),
                  object: DataFactory.literal('1', XSD.integer),
                },
                {
                  subject: data1,
                  predicate: DataFactory.namedNode('https://example.com/stringLiteral'),
                  object: DataFactory.literal('marshmellow'),
                },
                {
                  subject: data1,
                  predicate: DataFactory.namedNode('https://example.com/objectStringLiteral'),
                  object: DataFactory.literal('puffin'),
                },
                {
                  subject: data1,
                  predicate: DataFactory.namedNode('https://example.com/nested'),
                  object: blank,
                },
                {
                  subject: blank,
                  predicate: rdfTypeNamedNode,
                  object: DataFactory.namedNode('https://example.com/Comment'),
                },
                {
                  subject: blank,
                  predicate: DataFactory.namedNode('https://example.com/body'),
                  object: DataFactory.literal('What an aweful file'),
                },
                {
                  subject: data1,
                  predicate: DataFactory.namedNode('https://example.com/reference'),
                  object: DataFactory.namedNode('https://example.com/data/3'),
                },
              ],
            },
          ],
        },
      ],
    };
    expect(builder.buildUpdate(entity)).toEqual(query);
  });

  it('builds an update query for multiple entities.', (): void => {
    const entity = [
      {
        '@id': 'https://example.com/data/1',
        '@type': SKL.File,
      },
      {
        '@id': 'https://example.com/data/2',
        '@type': SKL.File,
      },
    ];
    const query = {
      type: 'update',
      prefixes: {},
      updates: [
        {
          updateType: 'deletewhere',
          delete: [
            {
              type: 'graph',
              name: data1,
              triples: [{ subject: c1, predicate: c2, object: c3 }],
            },
            {
              type: 'graph',
              name: data2,
              triples: [{ subject: c4, predicate: c5, object: c6 }],
            },
          ],
        },
        {
          updateType: 'insert',
          insert: [
            {
              type: 'graph',
              name: data1,
              triples: [{ subject: data1, predicate: rdfTypeNamedNode, object: file }],
            },
            {
              type: 'graph',
              name: data2,
              triples: [{ subject: data2, predicate: rdfTypeNamedNode, object: file }],
            },
          ],
        },
      ],
    };
    expect(builder.buildUpdate(entity)).toEqual(query);
  });

  it('builds an update query with created and modified timestamps if setTimestamps is turned on.', (): void => {
    builder = new SparqlUpdateBuilder({ setTimestamps: true });
    const entity = {
      '@id': 'https://example.com/data/1',
      '@type': SKL.File,
    };
    const query = {
      type: 'update',
      prefixes: {},
      updates: [
        {
          updateType: 'deletewhere',
          delete: [{
            type: 'graph',
            name: data1,
            triples: [{ subject: c1, predicate: c2, object: c3 }],
          }],
        },
        {
          updateType: 'insertdelete',
          delete: [],
          insert: [
            {
              type: 'graph',
              name: data1,
              triples: [
                { subject: data1, predicate: rdfTypeNamedNode, object: file },
                { subject: data1, predicate: created, object: now },
                { subject: data1, predicate: modified, object: now },
              ],
            },
          ],
          where: [
            {
              type: 'bind',
              variable: now,
              expression: {
                type: 'operation',
                operator: 'now',
                args: [],
              },
            },
          ],
        },
      ],
    };
    expect(builder.buildUpdate(entity)).toEqual(query);
  });

  it('builds a delete query for an entity.', (): void => {
    const entity = {
      '@id': 'https://example.com/data/1',
      '@type': SKL.File,
    };
    const query = {
      type: 'update',
      prefixes: {},
      updates: [
        {
          updateType: 'deletewhere',
          delete: [
            {
              type: 'graph',
              name: data1,
              triples: [{ subject: c1, predicate: c2, object: c3 }],
            },
          ],
        },
      ],
    };
    expect(builder.buildDelete(entity)).toEqual(query);
  });

  it('builds a delete query for multiple entities.', (): void => {
    const entities = [
      {
        '@id': 'https://example.com/data/1',
        '@type': SKL.File,
      },
      {
        '@id': 'https://example.com/data/2',
        '@type': SKL.File,
      },
    ];
    const query = {
      type: 'update',
      prefixes: {},
      updates: [
        {
          updateType: 'deletewhere',
          delete: [
            {
              type: 'graph',
              name: data1,
              triples: [{ subject: c1, predicate: c2, object: c3 }],
            },
            {
              type: 'graph',
              name: data2,
              triples: [{ subject: c4, predicate: c5, object: c6 }],
            },
          ],
        },
      ],
    };
    expect(builder.buildDelete(entities)).toEqual(query);
  });

  it('builds a delete query for all triples.', (): void => {
    const query = {
      type: 'update',
      prefixes: {},
      updates: [
        {
          updateType: 'deletewhere',
          delete: [
            {
              type: 'bgp',
              triples: [{ subject: subjectNode, predicate: predicateNode, object: objectNode }],
            },
          ],
        },
      ],
    };
    expect(builder.buildDeleteAll()).toEqual(query);
  });
});
