/* eslint-disable @typescript-eslint/naming-convention */
import DataFactory from '@rdfjs/data-model';
import type { FindOperator } from '../../../../src/storage/FindOperator';
import { Equal } from '../../../../src/storage/operator/Equal';
import { GreaterThan } from '../../../../src/storage/operator/GreaterThan';
import { GreaterThanOrEqual } from '../../../../src/storage/operator/GreaterThanOrEqual';
import { In } from '../../../../src/storage/operator/In';
import { Inverse } from '../../../../src/storage/operator/Inverse';
import { LessThan } from '../../../../src/storage/operator/LessThan';
import { LessThanOrEqual } from '../../../../src/storage/operator/LessThanOrEqual';
import { Not } from '../../../../src/storage/operator/Not';
import { SparqlQueryBuilder } from '../../../../src/storage/sparql/SparqlQueryBuilder';
import {
  entityVariable,
  objectNode,
  predicateNode,
  rdfsSubClassOfNamedNode,
  rdfTypeNamedNode,
  subjectNode,
} from '../../../../src/util/TripleUtil';
import { RDF, SKL, XSD } from '../../../../src/util/Vocabularies';

const c1 = DataFactory.variable('c1');
const c2 = DataFactory.variable('c2');
const c3 = DataFactory.variable('c3');
const c4 = DataFactory.variable('c4');
const predicate = DataFactory.namedNode('https://example.com/pred');
const predicate2 = DataFactory.namedNode('https://example.com/pred2');
const data1 = DataFactory.namedNode('https://example.com/data/1');
const data2 = DataFactory.namedNode('https://example.com/data/2');
const file = DataFactory.namedNode(SKL.File);
const event = DataFactory.namedNode(SKL.Event);

describe('A SparqlQueryBuilder', (): void => {
  let builder: SparqlQueryBuilder;

  beforeEach(async(): Promise<void> => {
    builder = new SparqlQueryBuilder();
  });

  describe('#buildValuesForVariables', (): void => {
    it('builds an and expression between multiple in expressions.', (): void => {
      expect(builder.buildValuesForVariables({
        entity: [
          DataFactory.namedNode('https://example.com/data/1'),
          DataFactory.namedNode('https://example.com/data/2'),
        ],
      })).toEqual([{
        type: 'values',
        values: [
          { '?entity': DataFactory.namedNode('https://example.com/data/1') },
          { '?entity': DataFactory.namedNode('https://example.com/data/2') },
        ],
      }]);
    });
  });

  describe('#buildPatternsFromQueryOptions', (): void => {
    it('builds a query without any options.', (): void => {
      expect(builder.buildPatternsFromQueryOptions(entityVariable)).toEqual({
        variables: [],
        where: [{
          type: 'bgp',
          triples: [{
            subject: entityVariable,
            predicate: c1,
            object: c2,
          }],
        }],
        orders: [],
        graphWhere: [],
      });
    });

    it('builds a query with where options.', (): void => {
      expect(builder.buildPatternsFromQueryOptions(
        entityVariable,
        {
          id: 'https://example.com/data/1',
          type: SKL.File,
          'https://example.com/pred': 1,
        },
      )).toEqual({
        variables: [],
        where: [
          {
            type: 'bgp',
            triples: [
              {
                subject: entityVariable,
                predicate: {
                  type: 'path',
                  pathType: '/',
                  items: [
                    rdfTypeNamedNode,
                    {
                      type: 'path',
                      pathType: '*',
                      items: [ rdfsSubClassOfNamedNode ],
                    },
                  ],
                },
                object: file,
              },
              {
                subject: entityVariable,
                predicate,
                object: DataFactory.literal('1', XSD.integer),
              },
            ],
          },
          {
            type: 'filter',
            expression: {
              type: 'operation',
              operator: '=',
              args: [ entityVariable, data1 ],
            },
          },
        ],
        orders: [],
        graphWhere: [],
      });
    });

    it('builds a query with one where filter and no triple patterns.', (): void => {
      expect(builder.buildPatternsFromQueryOptions(
        entityVariable,
        { id: 'https://example.com/data/1' },
      )).toEqual({
        variables: [],
        where: [
          {
            type: 'bgp',
            triples: [
              {
                subject: entityVariable,
                predicate: c1,
                object: c2,
              },
            ],
          },
          {
            type: 'filter',
            expression: {
              type: 'operation',
              operator: '=',
              args: [ entityVariable, data1 ],
            },
          },
        ],
        orders: [],
        graphWhere: [],
      });
    });

    it('builds a query with more than one filter.', (): void => {
      expect(builder.buildPatternsFromQueryOptions(
        entityVariable,
        {
          id: 'https://example.com/data/1',
          'https://example.com/nested': {
            id: 'https://example.com/data/2',
          },
        },
      )).toEqual({
        variables: [],
        where: [
          {
            type: 'bgp',
            triples: [
              {
                subject: entityVariable,
                predicate: DataFactory.namedNode('https://example.com/nested'),
                object: c1,
              },
              {
                subject: c1,
                predicate: c2,
                object: c3,
              },
            ],
          },
          {
            type: 'filter',
            expression: {
              type: 'operation',
              operator: '&&',
              args: [
                {
                  type: 'operation',
                  operator: '=',
                  args: [ entityVariable, data1 ],
                },
                {
                  type: 'operation',
                  operator: '=',
                  args: [ c1, data2 ],
                },
              ],
            },
          },
        ],
        orders: [],
        graphWhere: [],
      });
    });

    it('builds a query with a literal value filter.', (): void => {
      expect(builder.buildPatternsFromQueryOptions(
        entityVariable,
        {
          'https://example.com/pred': {
            '@value': { alpha: 1 },
            '@type': '@json',
          },
          'https://example.com/pred2': {
            '@value': false,
            '@type': XSD.boolean,
          },
          'https://example.com/pred3': {
            '@value': 'hello',
            '@language': 'en',
          },
        },
      )).toEqual({
        variables: [],
        where: [
          {
            type: 'bgp',
            triples: [
              {
                subject: entityVariable,
                predicate,
                object: DataFactory.literal('{"alpha":1}', RDF.JSON),
              },
              {
                subject: entityVariable,
                predicate: predicate2,
                object: DataFactory.literal('false', XSD.boolean),
              },
              {
                subject: entityVariable,
                predicate: DataFactory.namedNode('https://example.com/pred3'),
                object: DataFactory.literal('hello', 'en'),
              },
            ],
          },
        ],
        orders: [],
        graphWhere: [],
      });
    });

    it('builds a query with a NamedNode filter.', (): void => {
      expect(builder.buildPatternsFromQueryOptions(
        entityVariable,
        {
          'https://example.com/pred': 'https://example.com/object',
        },
      )).toEqual({
        variables: [],
        where: [
          {
            type: 'bgp',
            triples: [
              {
                subject: entityVariable,
                predicate,
                object: DataFactory.namedNode('https://example.com/object'),
              },
            ],
          },
        ],
        orders: [],
        graphWhere: [],
      });
    });

    it('builds a query with an array valued filter.', (): void => {
      expect(builder.buildPatternsFromQueryOptions(
        entityVariable,
        {
          'https://example.com/pred': [ 1, 2 ],
        },
      )).toEqual({
        variables: [],
        where: [
          {
            type: 'bgp',
            triples: [
              {
                subject: entityVariable,
                predicate,
                object: DataFactory.literal('1', XSD.integer),
              },
              {
                subject: entityVariable,
                predicate,
                object: DataFactory.literal('2', XSD.integer),
              },
            ],
          },
        ],
        orders: [],
        graphWhere: [],
      });
    });

    it('builds a query with an in operator on the id field.', (): void => {
      expect(builder.buildPatternsFromQueryOptions(
        entityVariable,
        {
          id: In([ 'https://example.com/data/1' ]),
        },
      )).toEqual({
        variables: [],
        where: [
          {
            type: 'bgp',
            triples: [
              {
                subject: entityVariable,
                predicate: c1,
                object: c2,
              },
            ],
          },
          {
            type: 'filter',
            expression: {
              type: 'operation',
              operator: 'in',
              args: [ entityVariable, [ data1 ]],
            },
          },
        ],
        orders: [],
        graphWhere: [],
      });
    });

    it('builds a query with an in operator on the type field.', (): void => {
      expect(builder.buildPatternsFromQueryOptions(
        entityVariable,
        {
          type: In([ SKL.File, SKL.Event ]),
        },
      )).toEqual({
        variables: [],
        where: [
          {
            type: 'bgp',
            triples: [
              {
                subject: entityVariable,
                predicate: {
                  type: 'path',
                  pathType: '/',
                  items: [
                    rdfTypeNamedNode,
                    {
                      type: 'path',
                      pathType: '*',
                      items: [ rdfsSubClassOfNamedNode ],
                    },
                  ],
                },
                object: c1,
              },
            ],
          },
          {
            type: 'filter',
            expression: {
              type: 'operation',
              operator: 'in',
              args: [ c1, [ file, event ]],
            },
          },
        ],
        orders: [],
        graphWhere: [],
      });
    });

    it('builds a query with an in operator on a non id field.', (): void => {
      expect(builder.buildPatternsFromQueryOptions(
        entityVariable,
        {
          'https://example.com/pred': In([ 1, 2 ]),
        },
      )).toEqual({
        variables: [],
        where: [
          {
            type: 'bgp',
            triples: [
              {
                subject: entityVariable,
                predicate,
                object: c1,
              },
            ],
          },
          {
            type: 'filter',
            expression: {
              type: 'operation',
              operator: 'in',
              args: [
                c1,
                [
                  DataFactory.literal('1', XSD.integer),
                  DataFactory.literal('2', XSD.integer),
                ],
              ],
            },
          },
        ],
        orders: [],
        graphWhere: [],
      });
    });

    it('builds a query with a not operator on the id field.', (): void => {
      expect(builder.buildPatternsFromQueryOptions(
        entityVariable,
        {
          id: Not('https://example.com/data/1'),
        },
      )).toEqual({
        variables: [],
        where: [
          {
            type: 'bgp',
            triples: [
              {
                subject: entityVariable,
                predicate: c1,
                object: c2,
              },
            ],
          },
          {
            type: 'filter',
            expression: {
              type: 'operation',
              operator: '!=',
              args: [ entityVariable, data1 ],
            },
          },
        ],
        orders: [],
        graphWhere: [],
      });
    });

    it('builds a query with a nested not in operator on the id field.', (): void => {
      expect(builder.buildPatternsFromQueryOptions(
        entityVariable,
        {
          id: Not(In([ 'https://example.com/data/1', 'https://example.com/data/2' ])),
        },
      )).toEqual({
        variables: [],
        where: [
          {
            type: 'bgp',
            triples: [
              {
                subject: entityVariable,
                predicate: c1,
                object: c2,
              },
            ],
          },
          {
            type: 'filter',
            expression: {
              type: 'operation',
              operator: 'notin',
              args: [
                entityVariable,
                [ data1, data2 ],
              ],
            },
          },
        ],
        orders: [],
        graphWhere: [],
      });
    });

    it('builds a query with a nested not equal operator on the id field.', (): void => {
      expect(builder.buildPatternsFromQueryOptions(
        entityVariable,
        {
          id: Not(Equal('https://example.com/data/1')),
        },
      )).toEqual({
        variables: [],
        where: [
          {
            type: 'bgp',
            triples: [
              {
                subject: entityVariable,
                predicate: c1,
                object: c2,
              },
            ],
          },
          {
            type: 'filter',
            expression: {
              type: 'operation',
              operator: '!=',
              args: [ entityVariable, data1 ],
            },
          },
        ],
        orders: [],
        graphWhere: [],
      });
    });

    it('builds a query with an equal operator on the id field.', (): void => {
      expect(builder.buildPatternsFromQueryOptions(
        entityVariable,
        {
          id: Equal('https://example.com/data/1'),
        },
      )).toEqual({
        variables: [],
        where: [
          {
            type: 'bgp',
            triples: [
              {
                subject: entityVariable,
                predicate: c1,
                object: c2,
              },
            ],
          },
          {
            type: 'filter',
            expression: {
              type: 'operation',
              operator: '=',
              args: [ entityVariable, data1 ],
            },
          },
        ],
        orders: [],
        graphWhere: [],
      });
    });

    it('builds a query with a not operator on a non id field.', (): void => {
      expect(builder.buildPatternsFromQueryOptions(
        entityVariable,
        {
          'https://example.com/pred': Not(1),
        },
      )).toEqual({
        variables: [],
        where: [
          {
            type: 'bgp',
            triples: [
              {
                subject: entityVariable,
                predicate,
                object: c1,
              },
            ],
          },
          {
            type: 'filter',
            expression: {
              type: 'operation',
              operator: 'notexists',
              args: [{
                type: 'group',
                patterns: [
                  {
                    type: 'bgp',
                    triples: [{
                      subject: entityVariable,
                      predicate,
                      object: c1,
                    }],
                  },
                  {
                    type: 'filter',
                    expression: {
                      type: 'operation',
                      operator: '=',
                      args: [
                        c1,
                        DataFactory.literal('1', XSD.integer),
                      ],
                    },
                  },
                ],
              }],
            },
          },
        ],
        orders: [],
        graphWhere: [],
      });
    });

    it('builds a query with a nested not in operator on a non id field.', (): void => {
      expect(builder.buildPatternsFromQueryOptions(
        entityVariable,
        {
          'https://example.com/pred': Not(In([ 1, 2 ])),
        },
      )).toEqual({
        variables: [],
        where: [
          {
            type: 'bgp',
            triples: [
              {
                subject: entityVariable,
                predicate,
                object: c1,
              },
            ],
          },
          {
            type: 'filter',
            expression: {
              type: 'operation',
              operator: 'notexists',
              args: [{
                type: 'group',
                patterns: [
                  {
                    type: 'bgp',
                    triples: [{
                      subject: entityVariable,
                      predicate,
                      object: c1,
                    }],
                  },
                  {
                    type: 'filter',
                    expression: {
                      type: 'operation',
                      operator: 'in',
                      args: [
                        c1,
                        [
                          DataFactory.literal('1', XSD.integer),
                          DataFactory.literal('2', XSD.integer),
                        ],
                      ],
                    },
                  },
                ],
              }],
            },
          },
        ],
        orders: [],
        graphWhere: [],
      });
    });

    it('builds a query with a nested not equal operator on a non id field.', (): void => {
      expect(builder.buildPatternsFromQueryOptions(
        entityVariable,
        {
          'https://example.com/pred': Not(Equal(1)),
        },
      )).toEqual({
        variables: [],
        where: [
          {
            type: 'bgp',
            triples: [
              {
                subject: entityVariable,
                predicate,
                object: c1,
              },
            ],
          },
          {
            type: 'filter',
            expression: {
              type: 'operation',
              operator: 'notexists',
              args: [{
                type: 'group',
                patterns: [
                  {
                    type: 'bgp',
                    triples: [{
                      subject: entityVariable,
                      predicate,
                      object: c1,
                    }],
                  },
                  {
                    type: 'filter',
                    expression: {
                      type: 'operation',
                      operator: '=',
                      args: [
                        c1,
                        DataFactory.literal('1', XSD.integer),
                      ],
                    },
                  },
                ],
              }],
            },
          },
        ],
        orders: [],
        graphWhere: [],
      });
    });

    it('builds a query with an equal operator on a non id field.', (): void => {
      expect(builder.buildPatternsFromQueryOptions(
        entityVariable,
        {
          'https://example.com/pred': Equal(1),
        },
      )).toEqual({
        variables: [],
        where: [
          {
            type: 'bgp',
            triples: [
              {
                subject: entityVariable,
                predicate,
                object: c1,
              },
            ],
          },
          {
            type: 'filter',
            expression: {
              type: 'operation',
              operator: '=',
              args: [
                c1,
                DataFactory.literal('1', XSD.integer),
              ],
            },
          },
        ],
        orders: [],
        graphWhere: [],
      });
    });

    it('builds a query with a gt operator.', (): void => {
      expect(builder.buildPatternsFromQueryOptions(
        entityVariable,
        {
          'https://example.com/pred': GreaterThan(1),
        },
      )).toEqual({
        variables: [],
        where: [
          {
            type: 'bgp',
            triples: [
              {
                subject: entityVariable,
                predicate,
                object: c1,
              },
            ],
          },
          {
            type: 'filter',
            expression: {
              type: 'operation',
              operator: '>',
              args: [
                c1,
                DataFactory.literal('1', XSD.integer),
              ],
            },
          },
        ],
        orders: [],
        graphWhere: [],
      });
    });

    it('builds a query with a gte operator.', (): void => {
      expect(builder.buildPatternsFromQueryOptions(
        entityVariable,
        {
          'https://example.com/pred': GreaterThanOrEqual(1),
        },
      )).toEqual({
        variables: [],
        where: [
          {
            type: 'bgp',
            triples: [
              {
                subject: entityVariable,
                predicate,
                object: c1,
              },
            ],
          },
          {
            type: 'filter',
            expression: {
              type: 'operation',
              operator: '>=',
              args: [
                c1,
                DataFactory.literal('1', XSD.integer),
              ],
            },
          },
        ],
        orders: [],
        graphWhere: [],
      });
    });

    it('builds a query with a lt operator.', (): void => {
      expect(builder.buildPatternsFromQueryOptions(
        entityVariable,
        {
          'https://example.com/pred': LessThan(1),
        },
      )).toEqual({
        variables: [],
        where: [
          {
            type: 'bgp',
            triples: [
              {
                subject: entityVariable,
                predicate,
                object: c1,
              },
            ],
          },
          {
            type: 'filter',
            expression: {
              type: 'operation',
              operator: '<',
              args: [
                c1,
                DataFactory.literal('1', XSD.integer),
              ],
            },
          },
        ],
        orders: [],
        graphWhere: [],
      });
    });

    it('builds a query with a lte operator.', (): void => {
      expect(builder.buildPatternsFromQueryOptions(
        entityVariable,
        {
          'https://example.com/pred': LessThanOrEqual(1),
        },
      )).toEqual({
        variables: [],
        where: [
          {
            type: 'bgp',
            triples: [
              {
                subject: entityVariable,
                predicate,
                object: c1,
              },
            ],
          },
          {
            type: 'filter',
            expression: {
              type: 'operation',
              operator: '<=',
              args: [
                c1,
                DataFactory.literal('1', XSD.integer),
              ],
            },
          },
        ],
        orders: [],
        graphWhere: [],
      });
    });

    it('builds a query with an inverse operator.', (): void => {
      expect(builder.buildPatternsFromQueryOptions(
        entityVariable,
        {
          'https://example.com/pred': Inverse(1),
        },
      )).toEqual({
        variables: [],
        where: [{
          type: 'bgp',
          triples: [
            {
              subject: entityVariable,
              predicate: c1,
              object: c2,
            },
          ],
        }],
        orders: [],
        graphWhere: [
          {
            type: 'bgp',
            triples: [
              {
                subject: entityVariable,
                predicate: {
                  type: 'path',
                  pathType: '^',
                  items: [ predicate ],
                },
                object: DataFactory.literal('1', XSD.integer),
              },
            ],
          },
        ],
      });
    });

    it('throws an error if there is an unsupported operation on a non id field.', (): void => {
      expect((): void => {
        builder.buildPatternsFromQueryOptions(
          entityVariable,
          {
            'https://example.com/pred': {
              type: 'operator',
              operator: 'and',
            },
          },
        );
      }).toThrow('Unsupported operator "and"');
    });

    it('throws an error if there is an unsupported operation on the id field.', (): void => {
      expect((): void => {
        builder.buildPatternsFromQueryOptions(
          entityVariable,
          {
            id: {
              type: 'operator',
              operator: 'and' as any,
            } as FindOperator<string>,
          },
        );
      }).toThrow('Unsupported operator "and"');
    });

    it('throws an error if there is an unsupported operation as an argument to a Not operator.', (): void => {
      expect((): void => {
        builder.buildPatternsFromQueryOptions(
          entityVariable,
          {
            'https://example.com/pred': Not({
              type: 'operator',
              operator: 'and',
            }),
          },
        );
      }).toThrow('Unsupported Not sub operator "and"');
    });

    it('throws an error if there is an unsupported operation as an argument to a Not operator on the id field.',
      (): void => {
        expect((): void => {
          builder.buildPatternsFromQueryOptions(
            entityVariable,
            {
              id: Not({
                type: 'operator',
                operator: 'and',
              }) as unknown as FindOperator<string>,
            },
          );
        }).toThrow('Unsupported Not sub operator "and"');
      });

    it('builds a query with a with an order.', (): void => {
      expect(builder.buildPatternsFromQueryOptions(
        entityVariable,
        undefined,
        {
          'https://example.com/pred': 'desc',
        },
      )).toEqual({
        variables: [],
        where: [
          {
            type: 'bgp',
            triples: [{
              subject: entityVariable,
              predicate: c1,
              object: c2,
            }],
          },
          {
            type: 'optional',
            patterns: [{
              type: 'bgp',
              triples: [{
                subject: entityVariable,
                predicate,
                object: c3,
              }],
            }],
          },
        ],
        orders: [{
          expression: c3,
          descending: true,
        }],
        graphWhere: [],
      });
    });

    it('builds a query with a with an order on id.', (): void => {
      expect(builder.buildPatternsFromQueryOptions(
        entityVariable,
        undefined,
        { id: 'desc' },
      )).toEqual({
        variables: [],
        where: [
          {
            type: 'bgp',
            triples: [{
              subject: entityVariable,
              predicate: c1,
              object: c2,
            }],
          },
        ],
        orders: [{
          expression: entityVariable,
          descending: true,
        }],
        graphWhere: [],
      });
    });

    it('builds a query with selected relations.', (): void => {
      expect(builder.buildPatternsFromQueryOptions(
        entityVariable,
        undefined,
        undefined,
        {
          'https://example.com/pred': {
            'https://example.com/pred2': true,
          },
        },
      )).toEqual({
        variables: [ c3, c4 ],
        where: [
          {
            type: 'bgp',
            triples: [{
              subject: entityVariable,
              predicate: c1,
              object: c2,
            }],
          },
          {
            type: 'optional',
            patterns: [
              {
                triples: [
                  {
                    subject: entityVariable,
                    predicate,
                    object: c3,
                  },
                ],
                type: 'bgp',
              },
            ],
          },
        ],
        orders: [],
        graphWhere: [
          {
            patterns: [
              {
                triples: [
                  {
                    object: c4,
                    predicate: predicate2,
                    subject: c3,
                  },
                ],
                type: 'bgp',
              },
            ],
            type: 'optional',
          },
        ],
      });
    });
  });

  describe('#buildConstructFromEntitySelectQuery', (): void => {
    it('builds a construct query without a select clause.', (): void => {
      const foo = DataFactory.variable('foo');
      const selectPattern = [
        { subject: subjectNode, predicate: predicateNode, object: objectNode },
        { subject: c1, predicate: c2, object: c3 },
      ];
      expect(builder.buildConstructFromEntitySelectQuery(
        [],
        [ foo ],
      )).toEqual({
        type: 'query',
        prefixes: {},
        queryType: 'CONSTRUCT',
        template: selectPattern,
        where: [
          {
            type: 'graph',
            name: entityVariable,
            patterns: [{
              type: 'bgp',
              triples: [{ subject: subjectNode, predicate: predicateNode, object: objectNode }],
            }],
          },
          {
            type: 'graph',
            name: foo,
            patterns: [{
              type: 'bgp',
              triples: [{ subject: c1, predicate: c2, object: c3 }],
            }],
          },
        ],
      });
    });

    it('builds a construct query with a select clause.', (): void => {
      const selectPattern = [
        { subject: entityVariable, predicate, object: c1 },
        { subject: c1, predicate: predicate2, object: c2 },
      ];
      expect(builder.buildConstructFromEntitySelectQuery(
        [],
        [],
        {
          'https://example.com/pred': {
            'https://example.com/pred2': true,
          },
        },
      )).toEqual({
        type: 'query',
        prefixes: {},
        queryType: 'CONSTRUCT',
        template: selectPattern,
        where: [
          {
            type: 'graph',
            name: entityVariable,
            patterns: [{
              type: 'optional',
              patterns: [{ type: 'bgp', triples: selectPattern }],
            }],
          },
        ],
      });
    });

    it('builds a query with an array of selections.', (): void => {
      const selectPattern = [
        { subject: entityVariable, predicate, object: c1 },
        { subject: entityVariable, predicate: predicate2, object: c2 },
      ];
      expect(builder.buildConstructFromEntitySelectQuery(
        [],
        [],
        [
          'https://example.com/pred',
          'https://example.com/pred2',
        ],
      )).toEqual({
        type: 'query',
        prefixes: {},
        queryType: 'CONSTRUCT',
        template: selectPattern,
        where: [
          {
            type: 'graph',
            name: entityVariable,
            patterns: [{
              type: 'optional',
              patterns: [{ type: 'bgp', triples: selectPattern }],
            }],
          },
        ],
      });
    });
  });
});
