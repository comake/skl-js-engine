/* eslint-disable @typescript-eslint/naming-convention */
import { RDF } from '@comake/rmlmapper-js';
import DataFactory from '@rdfjs/data-model';
import { SparqlUpdateBuilder } from '../../../../src/storage/sparql/SparqlUpdateBuilder';
import {
  created,
  modified,
  now,
  rdfTypeNamedNode,
} from '../../../../src/util/SparqlUtil';
import { DCTERMS, SKL, XSD } from '../../../../src/util/Vocabularies';

const c1 = DataFactory.variable('c1');
const c2 = DataFactory.variable('c2');
const data1 = DataFactory.namedNode('https://example.com/data/1');
const data2 = DataFactory.namedNode('https://example.com/data/2');
const file = DataFactory.namedNode(SKL.File);
const blank = DataFactory.blankNode('c1');

describe('A SparqlUpdateBuilder', (): void => {
  let builder: SparqlUpdateBuilder;

  beforeEach(async(): Promise<void> => {
    builder = new SparqlUpdateBuilder();
  });

  it('build a partial entity update query.', (): void => {
    const predicate = DataFactory.namedNode('https://example.com/predicate');
    const query = {
      type: 'update',
      prefixes: {},
      updates: [
        {
          updateType: 'insertdelete',
          delete: [
            {
              type: 'graph',
              name: data1,
              triples: [{ subject: data1, predicate, object: c1 }],
            },
          ],
          insert: [
            {
              type: 'graph',
              name: data1,
              triples: [
                {
                  subject: data1,
                  predicate,
                  object: DataFactory.literal('marshmellow'),
                },
              ],
            },
          ],
          using: {
            default: [ data1 ],
          },
          where: [{
            type: 'optional',
            patterns: [{
              type: 'bgp',
              triples: [{ subject: data1, predicate, object: c1 }],
            }],
          }],
        },
      ],
    };
    expect(builder.buildPartialUpdate(
      'https://example.com/data/1',
      {
        'https://example.com/predicate': 'marshmellow',
      },
    )).toEqual(query);
  });

  it('build a partial entity update query when setTimestamps is on.', (): void => {
    builder = new SparqlUpdateBuilder({ setTimestamps: true });
    const predicate = DataFactory.namedNode('https://example.com/predicate');
    const query = {
      type: 'update',
      prefixes: {},
      updates: [
        {
          updateType: 'insertdelete',
          delete: [
            {
              type: 'graph',
              name: data1,
              triples: [
                { subject: data1, predicate, object: c1 },
                { subject: data1, predicate: modified, object: c2 },
              ],
            },
          ],
          insert: [
            {
              type: 'graph',
              name: data1,
              triples: [
                {
                  subject: data1,
                  predicate,
                  object: DataFactory.literal('marshmellow'),
                },
                { subject: data1, predicate: modified, object: now },
              ],
            },
          ],
          using: {
            default: [ data1 ],
          },
          where: [
            {
              type: 'optional',
              patterns: [{
                type: 'bgp',
                triples: [{ subject: data1, predicate, object: c1 }],
              }],
            },
            {
              type: 'optional',
              patterns: [{
                type: 'bgp',
                triples: [{ subject: data1, predicate: modified, object: c2 }],
              }],
            },
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
    expect(builder.buildPartialUpdate(
      'https://example.com/data/1',
      {
        'https://example.com/predicate': 'marshmellow',
      },
    )).toEqual(query);
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
          type: 'clear',
          silent: true,
          graph: {
            type: 'graph',
            name: data1,
          },
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
          type: 'clear',
          silent: true,
          graph: {
            type: 'graph',
            name: data1,
          },
        },
        {
          type: 'clear',
          silent: true,
          graph: {
            type: 'graph',
            name: data2,
          },
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
          type: 'clear',
          silent: true,
          graph: {
            type: 'graph',
            name: data1,
          },
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
          where: [{
            type: 'bind',
            variable: now,
            expression: {
              type: 'operation',
              operator: 'now',
              args: [],
            },
          }],
        },
      ],
    };
    expect(builder.buildUpdate(entity)).toEqual(query);
  });

  it(`resets the modified timestamp in an update query if the entity was 
  already created and setTimestamps is turned on.`,
  (): void => {
    builder = new SparqlUpdateBuilder({ setTimestamps: true });
    const entity = {
      '@id': 'https://example.com/data/1',
      '@type': SKL.File,
      [DCTERMS.created]: {
        '@type': XSD.dateTime,
        '@value': '2022-10-12T00:00:00.000Z',
      },
      [DCTERMS.modified]: {
        '@type': XSD.dateTime,
        '@value': '2022-10-12T00:00:00.000Z',
      },
    };
    const query = {
      type: 'update',
      prefixes: {},
      updates: [
        {
          type: 'clear',
          silent: true,
          graph: {
            type: 'graph',
            name: data1,
          },
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
                {
                  subject: data1,
                  predicate: created,
                  object: DataFactory.literal('2022-10-12T00:00:00.000Z', XSD.dateTime),
                },
                { subject: data1, predicate: modified, object: now },
              ],
            },
          ],
          where: [{
            type: 'bind',
            variable: now,
            expression: {
              type: 'operation',
              operator: 'now',
              args: [],
            },
          }],
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
      updates: [{
        type: 'drop',
        silent: true,
        graph: {
          type: 'graph',
          name: data1,
        },
      }],
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
          type: 'drop',
          silent: true,
          graph: {
            type: 'graph',
            name: data1,
          },
        },
        {
          type: 'drop',
          silent: true,
          graph: {
            type: 'graph',
            name: data2,
          },
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
          type: 'drop',
          silent: true,
          graph: {
            type: 'graph',
            all: true,
          },
        },
      ],
    };
    expect(builder.buildDeleteAll()).toEqual(query);
  });
});
