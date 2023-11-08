/* eslint-disable @typescript-eslint/naming-convention */
import DataFactory from '@rdfjs/data-model';
import type { FindOperatorType } from '../../../../../src/storage/FindOperator';
import { Equal } from '../../../../../src/storage/operator/Equal';
import { GreaterThan } from '../../../../../src/storage/operator/GreaterThan';
import { GreaterThanOrEqual } from '../../../../../src/storage/operator/GreaterThanOrEqual';
import { In } from '../../../../../src/storage/operator/In';
import { Inverse } from '../../../../../src/storage/operator/Inverse';
import { InversePath } from '../../../../../src/storage/operator/InversePath';
import { InverseRelation } from '../../../../../src/storage/operator/InverseRelation';
import { InverseRelationOrder } from '../../../../../src/storage/operator/InverseRelationOrder';
import { LessThan } from '../../../../../src/storage/operator/LessThan';
import { LessThanOrEqual } from '../../../../../src/storage/operator/LessThanOrEqual';
import { Not } from '../../../../../src/storage/operator/Not';
import { ZeroOrMorePath } from '../../../../../src/storage/operator/ZeroOrMorePath';
import {
  SparqlQueryBuilder,
} from '../../../../../src/storage/query-adapter/sparql/SparqlQueryBuilder';
import {
  entityVariable,
  objectNode,
  predicateNode,
  rdfsSubClassOfNamedNode,
  rdfTypeNamedNode,
  subjectNode,
} from '../../../../../src/util/SparqlUtil';
import { RDF, RDFS, SKL, XSD } from '../../../../../src/util/Vocabularies';

const c1 = DataFactory.variable('c1');
const c2 = DataFactory.variable('c2');
const c3 = DataFactory.variable('c3');
const c4 = DataFactory.variable('c4');
const c5 = DataFactory.variable('c5');
const c6 = DataFactory.variable('c6');
const c7 = DataFactory.variable('c7');
const c8 = DataFactory.variable('c8');
const c9 = DataFactory.variable('c9');
const c10 = DataFactory.variable('c10');
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

  describe('#buildEntitySelectPatternsFromOptions', (): void => {
    it('builds a query without any options.', (): void => {
      expect(builder.buildEntitySelectPatternsFromOptions(entityVariable)).toEqual({
        graphSelectionTriples: [],
        where: [
          {
            type: 'graph',
            name: entityVariable,
            patterns: [{
              type: 'bgp',
              triples: [{
                subject: entityVariable,
                predicate: c1,
                object: c2,
              }],
            }],
          },
        ],
        orders: [],
        graphWhere: [],
      });
    });

    it('builds a query with where options.', (): void => {
      expect(builder.buildEntitySelectPatternsFromOptions(
        entityVariable,
        {
          where: {
            id: 'https://example.com/data/1',
            type: SKL.File,
            'https://example.com/pred': 1,
          },
        },
      )).toEqual({
        graphSelectionTriples: [],
        where: [
          {
            type: 'values',
            values: [
              { '?entity': data1 },
            ],
          },
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
        ],
        orders: [],
        graphWhere: [],
      });
    });

    it('builds a query with one where filter and no triple patterns.', (): void => {
      expect(builder.buildEntitySelectPatternsFromOptions(
        entityVariable,
        {
          where: { id: 'https://example.com/data/1' },
        },
      )).toEqual({
        graphSelectionTriples: [],
        where: [],
        orders: [],
        graphWhere: [
          {
            type: 'values',
            values: [
              { '?entity': data1 },
            ],
          },
        ],
      });
    });

    it('builds a query with more than one filter.', (): void => {
      expect(builder.buildEntitySelectPatternsFromOptions(
        entityVariable,
        {
          where: {
            'https://example.com/pred': GreaterThan(1),
            'https://example.com/pred2': LessThan(1),
          },
        },
      )).toEqual({
        graphSelectionTriples: [],
        where: [
          {
            type: 'bgp',
            triples: [
              {
                subject: entityVariable,
                predicate,
                object: c1,
              },
              {
                subject: entityVariable,
                predicate: predicate2,
                object: c2,
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
                  operator: '&&',
                  args: [
                    {
                      type: 'operation',
                      operator: '>',
                      args: [ c1, DataFactory.literal('1', XSD.integer) ],
                    },
                    {
                      type: 'operation',
                      operator: '<',
                      args: [ c2, DataFactory.literal('1', XSD.integer) ],
                    },
                  ],
                },
                {
                  type: 'operation',
                  operator: 'exists',
                  args: [{
                    type: 'graph',
                    name: entityVariable,
                    patterns: [{
                      type: 'bgp',
                      triples: [{
                        subject: entityVariable,
                        predicate: c3,
                        object: c4,
                      }],
                    }],
                  }],
                },
              ],
            },
          },
        ],
        orders: [],
        graphWhere: [],
      });
    });

    it('builds a query with more than one filter on a single property.', (): void => {
      expect(builder.buildEntitySelectPatternsFromOptions(
        entityVariable,
        {
          where: {
            'https://example.com/pred': [ GreaterThan(1), LessThan(5) ],
          },
        },
      )).toEqual({
        graphSelectionTriples: [],
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
              operator: '&&',
              args: [
                {
                  type: 'operation',
                  operator: '&&',
                  args: [
                    {
                      type: 'operation',
                      operator: '>',
                      args: [ c1, DataFactory.literal('1', XSD.integer) ],
                    },
                    {
                      type: 'operation',
                      operator: '<',
                      args: [ c1, DataFactory.literal('5', XSD.integer) ],
                    },
                  ],
                },
                {
                  type: 'operation',
                  operator: 'exists',
                  args: [{
                    type: 'graph',
                    name: entityVariable,
                    patterns: [{
                      type: 'bgp',
                      triples: [{
                        subject: entityVariable,
                        predicate: c2,
                        object: c3,
                      }],
                    }],
                  }],
                },
              ],
            },
          },
        ],
        orders: [],
        graphWhere: [],
      });
    });

    it('builds a query with a nested value filter.', (): void => {
      expect(builder.buildEntitySelectPatternsFromOptions(
        entityVariable,
        {
          where: {
            id: 'https://example.com/data/1',
            'https://example.com/nested': {
              id: 'https://example.com/data/2',
            },
          },
        },
      )).toEqual({
        graphSelectionTriples: [],
        where: [
          {
            type: 'values',
            values: [
              { '?entity': data1 },
            ],
          },
          {
            type: 'values',
            values: [
              { '?c1': data2 },
            ],
          },
          {
            type: 'bgp',
            triples: [
              {
                subject: entityVariable,
                predicate: DataFactory.namedNode('https://example.com/nested'),
                object: c1,
              },
            ],
          },
        ],
        orders: [],
        graphWhere: [],
      });
    });

    it('builds a query with a literal value filter.', (): void => {
      expect(builder.buildEntitySelectPatternsFromOptions(
        entityVariable,
        {
          where: {
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
        },
      )).toEqual({
        graphSelectionTriples: [],
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
          {
            type: 'filter',
            expression: {
              type: 'operation',
              operator: 'exists',
              args: [{
                type: 'graph',
                name: entityVariable,
                patterns: [{
                  type: 'bgp',
                  triples: [{
                    subject: entityVariable,
                    predicate: c1,
                    object: c2,
                  }],
                }],
              }],
            },
          },
        ],
        orders: [],
        graphWhere: [],
      });
    });

    it('builds a query with a NamedNode filter.', (): void => {
      expect(builder.buildEntitySelectPatternsFromOptions(
        entityVariable,
        {
          where: {
            'https://example.com/pred': 'https://example.com/object',
          },
        },
      )).toEqual({
        graphSelectionTriples: [],
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
          {
            type: 'filter',
            expression: {
              type: 'operation',
              operator: 'exists',
              args: [{
                type: 'graph',
                name: entityVariable,
                patterns: [{
                  type: 'bgp',
                  triples: [{
                    subject: entityVariable,
                    predicate: c1,
                    object: c2,
                  }],
                }],
              }],
            },
          },
        ],
        orders: [],
        graphWhere: [],
      });
    });

    it('builds a query with an array valued filter.', (): void => {
      expect(builder.buildEntitySelectPatternsFromOptions(
        entityVariable,
        {
          where: {
            'https://example.com/pred': [ 1, 2 ],
          },
        },
      )).toEqual({
        graphSelectionTriples: [],
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
          {
            type: 'filter',
            expression: {
              type: 'operation',
              operator: 'exists',
              args: [{
                type: 'graph',
                name: entityVariable,
                patterns: [{
                  type: 'bgp',
                  triples: [{
                    subject: entityVariable,
                    predicate: c1,
                    object: c2,
                  }],
                }],
              }],
            },
          },
        ],
        orders: [],
        graphWhere: [],
      });
    });

    it('builds a query with an in operator on the id field.', (): void => {
      expect(builder.buildEntitySelectPatternsFromOptions(
        entityVariable,
        {
          where: {
            id: In([ 'https://example.com/data/1' ]),
          },
        },
      )).toEqual({
        graphSelectionTriples: [],
        where: [],
        orders: [],
        graphWhere: [
          {
            type: 'values',
            values: [
              { '?entity': data1 },
            ],
          },
        ],
      });
    });

    it('builds a query with an inverse operator on the type field.', (): void => {
      expect(builder.buildEntitySelectPatternsFromOptions(
        entityVariable,
        {
          where: {
            type: Inverse({
              'https://example.com/pred': 'hello world',
            }),
          },
        },
      )).toEqual({
        graphSelectionTriples: [],
        where: [
          {
            type: 'bgp',
            triples: [
              {
                subject: entityVariable,
                predicate: {
                  type: 'path',
                  pathType: '^',
                  items: [
                    {
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
                  ],
                },
                object: c1,
              },
              {
                subject: c1,
                predicate,
                object: DataFactory.literal('hello world'),
              },
            ],
          },
          {
            type: 'filter',
            expression: {
              type: 'operation',
              operator: 'exists',
              args: [{
                type: 'graph',
                name: entityVariable,
                patterns: [{
                  type: 'bgp',
                  triples: [{
                    subject: entityVariable,
                    predicate: c2,
                    object: c3,
                  }],
                }],
              }],
            },
          },
        ],
        orders: [],
        graphWhere: [],
      });
    });

    it('builds a query with an in operator on the type field.', (): void => {
      expect(builder.buildEntitySelectPatternsFromOptions(
        entityVariable,
        {
          where: {
            type: In([ SKL.File, SKL.Event ]),
          },
        },
      )).toEqual({
        graphSelectionTriples: [],
        where: [
          {
            type: 'values',
            values: [
              { '?c1': file },
              { '?c1': event },
            ],
          },
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
              operator: 'exists',
              args: [{
                type: 'graph',
                name: entityVariable,
                patterns: [{
                  type: 'bgp',
                  triples: [{
                    subject: entityVariable,
                    predicate: c2,
                    object: c3,
                  }],
                }],
              }],
            },
          },
        ],
        orders: [],
        graphWhere: [],
      });
    });

    it('builds a query with a not operator on the type field.', (): void => {
      expect(builder.buildEntitySelectPatternsFromOptions(
        entityVariable,
        {
          where: {
            type: Not(SKL.File),
          },
        },
      )).toEqual({
        graphSelectionTriples: [],
        where: [
          {
            type: 'graph',
            name: entityVariable,
            patterns: [
              {
                type: 'bgp',
                triples: [
                  {
                    subject: entityVariable,
                    predicate: c2,
                    object: c3,
                  },
                ],
              },
            ],
          },
          {
            type: 'filter',
            expression: {
              type: 'operation',
              operator: 'notexists',
              args: [
                {
                  type: 'group',
                  patterns: [
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
                        operator: '=',
                        args: [ c1, file ],
                      },
                    },
                  ],
                },
              ],
            },
          },
        ],
        orders: [],
        graphWhere: [],
      });
    });

    it('builds a query with an in operator on a non id field.', (): void => {
      expect(builder.buildEntitySelectPatternsFromOptions(
        entityVariable,
        {
          where: {
            'https://example.com/pred': In([ 1, 2 ]),
          },
        },
      )).toEqual({
        graphSelectionTriples: [],
        where: [
          {
            type: 'values',
            values: [
              { '?c1': DataFactory.literal('1', XSD.integer) },
              { '?c1': DataFactory.literal('2', XSD.integer) },
            ],
          },
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
              operator: 'exists',
              args: [{
                type: 'graph',
                name: entityVariable,
                patterns: [{
                  type: 'bgp',
                  triples: [{
                    subject: entityVariable,
                    predicate: c2,
                    object: c3,
                  }],
                }],
              }],
            },
          },
        ],
        orders: [],
        graphWhere: [],
      });
    });

    it('builds a query with a not operator on the id field.', (): void => {
      expect(builder.buildEntitySelectPatternsFromOptions(
        entityVariable,
        {
          where: {
            id: Not('https://example.com/data/1'),
          },
        },
      )).toEqual({
        graphSelectionTriples: [],
        where: [
          {
            type: 'graph',
            name: entityVariable,
            patterns: [
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
            ],
          },
        ],
        orders: [],
        graphWhere: [
          {
            type: 'filter',
            expression: {
              type: 'operation',
              operator: '!=',
              args: [ entityVariable, data1 ],
            },
          },
        ],
      });
    });

    it('builds a query with a nested not in operator on the id field.', (): void => {
      expect(builder.buildEntitySelectPatternsFromOptions(
        entityVariable,
        {
          where: {
            id: Not(In([ 'https://example.com/data/1', 'https://example.com/data/2' ])),
          },
        },
      )).toEqual({
        graphSelectionTriples: [],
        where: [
          {
            type: 'graph',
            name: entityVariable,
            patterns: [
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
            ],
          },
        ],
        orders: [],
        graphWhere: [
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
      });
    });

    it('builds a query with a filtered id field and another field filter.', (): void => {
      expect(builder.buildEntitySelectPatternsFromOptions(
        entityVariable,
        {
          where: {
            id: Not(In([ 'https://example.com/data/1', 'https://example.com/data/2' ])),
            'https://example.com/pred': GreaterThan(1),
          },
        },
      )).toEqual({
        graphSelectionTriples: [],
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
              operator: '&&',
              args: [
                {
                  type: 'operation',
                  operator: 'notin',
                  args: [
                    entityVariable,
                    [ data1, data2 ],
                  ],
                },
                {
                  type: 'operation',
                  operator: '>',
                  args: [ c1, DataFactory.literal('1', XSD.integer) ],
                },
              ],
            },
          },
        ],
        orders: [],
        graphWhere: [],
      });
    });

    it('builds a query with a nested not equal operator on the id field.', (): void => {
      expect(builder.buildEntitySelectPatternsFromOptions(
        entityVariable,
        {
          where: {
            id: Not(Equal('https://example.com/data/1')),
          },
        },
      )).toEqual({
        graphSelectionTriples: [],
        where: [
          {
            type: 'graph',
            name: entityVariable,
            patterns: [
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
            ],
          },
        ],
        orders: [],
        graphWhere: [
          {
            type: 'filter',
            expression: {
              type: 'operation',
              operator: '!=',
              args: [ entityVariable, data1 ],
            },
          },
        ],
      });
    });

    it('builds a query with an equal operator on the id field.', (): void => {
      expect(builder.buildEntitySelectPatternsFromOptions(
        entityVariable,
        {
          where: {
            id: Equal('https://example.com/data/1'),
          },
        },
      )).toEqual({
        graphSelectionTriples: [],
        where: [
          {
            type: 'graph',
            name: entityVariable,
            patterns: [
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
            ],
          },
        ],
        orders: [],
        graphWhere: [
          {
            type: 'filter',
            expression: {
              type: 'operation',
              operator: '=',
              args: [ entityVariable, data1 ],
            },
          },
        ],
      });
    });

    it('builds a query with a not operator on a non id field.', (): void => {
      expect(builder.buildEntitySelectPatternsFromOptions(
        entityVariable,
        {
          where: {
            'https://example.com/pred': Not(1),
          },
        },
      )).toEqual({
        graphSelectionTriples: [],
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
              operator: '&&',
              args: [
                {
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
                {
                  type: 'operation',
                  operator: 'exists',
                  args: [{
                    type: 'graph',
                    name: entityVariable,
                    patterns: [{
                      type: 'bgp',
                      triples: [{
                        subject: entityVariable,
                        predicate: c2,
                        object: c3,
                      }],
                    }],
                  }],
                },
              ],
            },
          },
        ],
        orders: [],
        graphWhere: [],
      });
    });

    it('builds a query with a nested not in operator on a non id field.', (): void => {
      expect(builder.buildEntitySelectPatternsFromOptions(
        entityVariable,
        {
          where: {
            'https://example.com/pred': Not(In([ 1, 2 ])),
          },
        },
      )).toEqual({
        graphSelectionTriples: [],
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
              operator: '&&',
              args: [
                {
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
                {
                  type: 'operation',
                  operator: 'exists',
                  args: [{
                    type: 'graph',
                    name: entityVariable,
                    patterns: [{
                      type: 'bgp',
                      triples: [{
                        subject: entityVariable,
                        predicate: c2,
                        object: c3,
                      }],
                    }],
                  }],
                },
              ],
            },
          },
        ],
        orders: [],
        graphWhere: [],
      });
    });

    it('builds a query with a nested not equal operator on a non id field.', (): void => {
      expect(builder.buildEntitySelectPatternsFromOptions(
        entityVariable,
        {
          where: {
            'https://example.com/pred': Not(Equal(1)),
          },
        },
      )).toEqual({
        graphSelectionTriples: [],
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
              operator: '&&',
              args: [
                {
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
                {
                  type: 'operation',
                  operator: 'exists',
                  args: [{
                    type: 'graph',
                    name: entityVariable,
                    patterns: [{
                      type: 'bgp',
                      triples: [{
                        subject: entityVariable,
                        predicate: c2,
                        object: c3,
                      }],
                    }],
                  }],
                },
              ],
            },
          },
        ],
        orders: [],
        graphWhere: [],
      });
    });

    it('builds a query with an equal operator on a non id field.', (): void => {
      expect(builder.buildEntitySelectPatternsFromOptions(
        entityVariable,
        {
          where: {
            'https://example.com/pred': Equal(1),
          },
        },
      )).toEqual({
        graphSelectionTriples: [],
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
              operator: '&&',
              args: [
                {
                  type: 'operation',
                  operator: '=',
                  args: [
                    c1,
                    DataFactory.literal('1', XSD.integer),
                  ],
                },
                {
                  type: 'operation',
                  operator: 'exists',
                  args: [{
                    type: 'graph',
                    name: entityVariable,
                    patterns: [{
                      type: 'bgp',
                      triples: [{
                        subject: entityVariable,
                        predicate: c2,
                        object: c3,
                      }],
                    }],
                  }],
                },
              ],
            },
          },
        ],
        orders: [],
        graphWhere: [],
      });
    });

    it('builds a query with a gt operator.', (): void => {
      expect(builder.buildEntitySelectPatternsFromOptions(
        entityVariable,
        {
          where: {
            'https://example.com/pred': GreaterThan(1),
          },
        },
      )).toEqual({
        graphSelectionTriples: [],
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
              operator: '&&',
              args: [
                {
                  type: 'operation',
                  operator: '>',
                  args: [
                    c1,
                    DataFactory.literal('1', XSD.integer),
                  ],
                },
                {
                  type: 'operation',
                  operator: 'exists',
                  args: [{
                    type: 'graph',
                    name: entityVariable,
                    patterns: [{
                      type: 'bgp',
                      triples: [{
                        subject: entityVariable,
                        predicate: c2,
                        object: c3,
                      }],
                    }],
                  }],
                },
              ],
            },
          },
        ],
        orders: [],
        graphWhere: [],
      });
    });

    it('builds a query with a gte operator.', (): void => {
      expect(builder.buildEntitySelectPatternsFromOptions(
        entityVariable,
        {
          where: {
            'https://example.com/pred': GreaterThanOrEqual(1),
          },
        },
      )).toEqual({
        graphSelectionTriples: [],
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
              operator: '&&',
              args: [
                {
                  type: 'operation',
                  operator: '>=',
                  args: [
                    c1,
                    DataFactory.literal('1', XSD.integer),
                  ],
                },
                {
                  type: 'operation',
                  operator: 'exists',
                  args: [{
                    type: 'graph',
                    name: entityVariable,
                    patterns: [{
                      type: 'bgp',
                      triples: [{
                        subject: entityVariable,
                        predicate: c2,
                        object: c3,
                      }],
                    }],
                  }],
                },
              ],
            },
          },
        ],
        orders: [],
        graphWhere: [],
      });
    });

    it('builds a query with a lt operator.', (): void => {
      expect(builder.buildEntitySelectPatternsFromOptions(
        entityVariable,
        {
          where: {
            'https://example.com/pred': LessThan(1),
          },
        },
      )).toEqual({
        graphSelectionTriples: [],
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
              operator: '&&',
              args: [
                {
                  type: 'operation',
                  operator: '<',
                  args: [
                    c1,
                    DataFactory.literal('1', XSD.integer),
                  ],
                },
                {
                  type: 'operation',
                  operator: 'exists',
                  args: [{
                    type: 'graph',
                    name: entityVariable,
                    patterns: [{
                      type: 'bgp',
                      triples: [{
                        subject: entityVariable,
                        predicate: c2,
                        object: c3,
                      }],
                    }],
                  }],
                },
              ],
            },
          },
        ],
        orders: [],
        graphWhere: [],
      });
    });

    it('builds a query with a lte operator.', (): void => {
      expect(builder.buildEntitySelectPatternsFromOptions(
        entityVariable,
        {
          where: {
            'https://example.com/pred': LessThanOrEqual(1),
          },
        },
      )).toEqual({
        graphSelectionTriples: [],
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
              operator: '&&',
              args: [
                {
                  type: 'operation',
                  operator: '<=',
                  args: [
                    c1,
                    DataFactory.literal('1', XSD.integer),
                  ],
                },
                {
                  type: 'operation',
                  operator: 'exists',
                  args: [{
                    type: 'graph',
                    name: entityVariable,
                    patterns: [{
                      type: 'bgp',
                      triples: [{
                        subject: entityVariable,
                        predicate: c2,
                        object: c3,
                      }],
                    }],
                  }],
                },
              ],
            },
          },
        ],
        orders: [],
        graphWhere: [],
      });
    });

    it('builds a query with an operator with a value object value.', (): void => {
      expect(builder.buildEntitySelectPatternsFromOptions(
        entityVariable,
        {
          where: {
            'https://example.com/pred': GreaterThanOrEqual({
              '@type': XSD.dateTime,
              '@value': '2023-03-05T07:28:51Z',
            }),
          },
        },
      )).toEqual({
        graphSelectionTriples: [],
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
              operator: '&&',
              args: [
                {
                  type: 'operation',
                  operator: '>=',
                  args: [
                    c1,
                    DataFactory.literal('2023-03-05T07:28:51Z', XSD.dateTime),
                  ],
                },
                {
                  type: 'operation',
                  operator: 'exists',
                  args: [{
                    type: 'graph',
                    name: entityVariable,
                    patterns: [{
                      type: 'bgp',
                      triples: [{
                        subject: entityVariable,
                        predicate: c2,
                        object: c3,
                      }],
                    }],
                  }],
                },
              ],
            },
          },
        ],
        orders: [],
        graphWhere: [],
      });
    });

    it('builds a query with an operator with a value object value with no @type as a string.', (): void => {
      expect(builder.buildEntitySelectPatternsFromOptions(
        entityVariable,
        {
          where: {
            'https://example.com/pred': GreaterThanOrEqual({
              '@value': '2023-03-05T07:28:51Z',
            }),
          },
        },
      )).toEqual({
        graphSelectionTriples: [],
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
              operator: '&&',
              args: [
                {
                  type: 'operation',
                  operator: '>=',
                  args: [
                    c1,
                    DataFactory.literal('2023-03-05T07:28:51Z', XSD.string),
                  ],
                },
                {
                  type: 'operation',
                  operator: 'exists',
                  args: [{
                    type: 'graph',
                    name: entityVariable,
                    patterns: [{
                      type: 'bgp',
                      triples: [{
                        subject: entityVariable,
                        predicate: c2,
                        object: c3,
                      }],
                    }],
                  }],
                },
              ],
            },
          },
        ],
        orders: [],
        graphWhere: [],
      });
    });

    it('builds a query with an inverse operator.', (): void => {
      expect(builder.buildEntitySelectPatternsFromOptions(
        entityVariable,
        {
          where: {
            'https://example.com/pred': Inverse(1),
          },
        },
      )).toEqual({
        graphSelectionTriples: [],
        where: [
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
          {
            type: 'filter',
            expression: {
              type: 'operation',
              operator: 'exists',
              args: [{
                type: 'graph',
                name: entityVariable,
                patterns: [{
                  type: 'bgp',
                  triples: [{
                    subject: entityVariable,
                    predicate: c1,
                    object: c2,
                  }],
                }],
              }],
            },
          },
        ],
        orders: [],
        graphWhere: [],
      });
    });

    it('throws an error if there is an unsupported operation on a non id field.', (): void => {
      expect((): void => {
        builder.buildEntitySelectPatternsFromOptions(
          entityVariable,
          {
            where: {
              'https://example.com/pred': {
                type: 'operator',
                operator: 'and' as FindOperatorType,
                value: 'true',
              },
            },
          },
        );
      }).toThrow('Unsupported operator "and"');
    });

    it('throws an error if there is an unsupported operation on the id field.', (): void => {
      expect((): void => {
        builder.buildEntitySelectPatternsFromOptions(
          entityVariable,
          {
            where: {
              id: {
                type: 'operator',
                // Trick to make it think the type is ok
                operator: 'and' as 'in',
                value: 'true',
              },
            },
          },
        );
      }).toThrow('Unsupported operator "and"');
    });

    it('throws an error if there is an unsupported operation as an argument to a Not operator.', (): void => {
      expect((): void => {
        builder.buildEntitySelectPatternsFromOptions(
          entityVariable,
          {
            where: {
              'https://example.com/pred': Not({
                type: 'operator',
                operator: 'and' as FindOperatorType,
                value: 'true',
              }),
            },
          },
        );
      }).toThrow('Unsupported Not sub operator "and"');
    });

    it('throws an error if there is an unsupported operation as an argument to a Not operator on the id field.',
      (): void => {
        expect((): void => {
          builder.buildEntitySelectPatternsFromOptions(
            entityVariable,
            {
              where: {
                id: Not({
                  type: 'operator',
                  operator: 'and' as FindOperatorType,
                  value: 'true',
                }),
              },
            },
          );
        }).toThrow('Unsupported Not sub operator "and"');
      });

    it('builds a query with a with an order.', (): void => {
      expect(builder.buildEntitySelectPatternsFromOptions(
        entityVariable,
        {
          order: { 'https://example.com/pred': 'desc' },
        },
      )).toEqual({
        graphSelectionTriples: [],
        where: [
          {
            type: 'graph',
            name: entityVariable,
            patterns: [
              {
                type: 'bgp',
                triples: [
                  {
                    subject: entityVariable,
                    predicate: c2,
                    object: c3,
                  },
                ],
              },
            ],
          },
          {
            type: 'optional',
            patterns: [{
              type: 'bgp',
              triples: [{
                subject: entityVariable,
                predicate,
                object: c1,
              }],
            }],
          },
        ],
        orders: [{
          expression: c1,
          descending: true,
        }],
        graphWhere: [],
      });
    });

    it('builds a query with a with an order on id.', (): void => {
      expect(builder.buildEntitySelectPatternsFromOptions(
        entityVariable,
        { order: { id: 'desc' }},
      )).toEqual({
        graphSelectionTriples: [],
        where: [
          {
            type: 'graph',
            name: entityVariable,
            patterns: [
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
            ],
          },
        ],
        orders: [{
          expression: entityVariable,
          descending: true,
        }],
        graphWhere: [],
      });
    });

    it('builds a query with a with an inverse relation order.', (): void => {
      expect(builder.buildEntitySelectPatternsFromOptions(
        entityVariable,
        {
          order: {
            'https://example.com/pred': InverseRelationOrder({
              order: {
                'https://example.com/pred2': 'desc',
              },
              where: {
                'https://example.com/name': Not('Bob'),
              },
            }),
          },
        },
      )).toEqual({
        graphSelectionTriples: [],
        where: [
          {
            type: 'graph',
            name: entityVariable,
            patterns: [
              {
                type: 'bgp',
                triples: [
                  {
                    subject: entityVariable,
                    predicate: c4,
                    object: c5,
                  },
                ],
              },
            ],
          },
          {
            type: 'optional',
            patterns: [
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
                    object: c1,
                  },
                  {
                    subject: c1,
                    predicate: predicate2,
                    object: c2,
                  },
                  {
                    subject: c1,
                    predicate: DataFactory.namedNode('https://example.com/name'),
                    object: c3,
                  },
                ],
              },
              {
                type: 'filter',
                expression: {
                  type: 'operation',
                  operator: 'notexists',
                  args: [
                    {
                      type: 'group',
                      patterns: [
                        {
                          type: 'bgp',
                          triples: [
                            {
                              subject: c1,
                              predicate: DataFactory.namedNode('https://example.com/name'),
                              object: c3,
                            },
                          ],
                        },
                        {
                          type: 'filter',
                          expression: {
                            type: 'operation',
                            operator: '=',
                            args: [ c3, DataFactory.literal('Bob') ],
                          },
                        },
                      ],
                    },
                  ],
                },
              },
            ],
          },
        ],
        group: entityVariable,
        orders: [{
          expression: {
            type: 'aggregate',
            expression: c2,
            aggregation: 'max',
          },
          descending: true,
        }],
        graphWhere: [],
      });
    });

    it('builds a query with selected relations.', (): void => {
      expect(builder.buildEntitySelectPatternsFromOptions(
        entityVariable,
        {
          relations: {
            'https://example.com/pred': {
              'https://example.com/pred2': true,
            },
          },
        },
      )).toEqual({
        graphSelectionTriples: [
          { subject: c2, predicate: c3, object: c4 },
          { subject: c6, predicate: c7, object: c8 },
        ],
        where: [
          {
            type: 'graph',
            name: entityVariable,
            patterns: [
              {
                type: 'bgp',
                triples: [
                  {
                    subject: entityVariable,
                    predicate: c9,
                    object: c10,
                  },
                ],
              },
            ],
          },
        ],
        orders: [],
        graphWhere: [
          {
            type: 'optional',
            patterns: [
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
                type: 'graph',
                name: c1,
                patterns: [
                  {
                    type: 'bgp',
                    triples: [
                      { subject: c2, predicate: c3, object: c4 },
                    ],
                  },
                ],
              },
              {
                type: 'optional',
                patterns: [
                  {
                    type: 'bgp',
                    triples: [
                      { subject: c1, predicate: predicate2, object: c5 },
                    ],
                  },
                  {
                    type: 'graph',
                    name: c5,
                    patterns: [
                      {
                        type: 'bgp',
                        triples: [
                          { subject: c6, predicate: c7, object: c8 },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      });
    });

    it('builds a query with an inverse relation and nested relation inside that.', (): void => {
      expect(builder.buildEntitySelectPatternsFromOptions(
        entityVariable,
        {
          relations: {
            'https://example.com/pred': InverseRelation({
              resolvedName: 'https://example.com/inversePred',
              relations: {
                'https://example.com/pred2': true,
              },
            }),
          },
        },
      )).toEqual({
        graphSelectionTriples: [
          { subject: c2, predicate: c3, object: c4 },
          { subject: c6, predicate: c7, object: c8 },
        ],
        where: [
          {
            type: 'graph',
            name: entityVariable,
            patterns: [
              {
                type: 'bgp',
                triples: [
                  {
                    subject: entityVariable,
                    predicate: c9,
                    object: c10,
                  },
                ],
              },
            ],
          },
        ],
        orders: [],
        graphWhere: [
          {
            type: 'optional',
            patterns: [
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
                    object: c1,
                  },
                ],
              },
              {
                type: 'graph',
                name: c1,
                patterns: [
                  {
                    type: 'bgp',
                    triples: [
                      { subject: c2, predicate: c3, object: c4 },
                    ],
                  },
                ],
              },
              {
                type: 'optional',
                patterns: [
                  {
                    type: 'bgp',
                    triples: [
                      { subject: c1, predicate: predicate2, object: c5 },
                    ],
                  },
                  {
                    type: 'graph',
                    name: c5,
                    patterns: [
                      {
                        type: 'bgp',
                        triples: [
                          { subject: c6, predicate: c7, object: c8 },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      });
    });

    it('builds a query with a sequence, inverse, and zero or more path.', (): void => {
      expect(builder.buildEntitySelectPatternsFromOptions(
        entityVariable,
        {
          where: {
            'https://example.com/pred': InversePath({
              subPath: ZeroOrMorePath({ subPath: RDFS.subClassOf as string }),
              value: 'https://example.com/Class',
            }),
          },
        },
      )).toEqual({
        graphSelectionTriples: [],
        where: [
          {
            type: 'bgp',
            triples: [{
              subject: entityVariable,
              predicate: {
                type: 'path',
                pathType: '/',
                items: [
                  predicate,
                  {
                    type: 'path',
                    pathType: '^',
                    items: [{
                      type: 'path',
                      pathType: '*',
                      items: [ rdfsSubClassOfNamedNode ],
                    }],
                  },
                ],
              },
              object: DataFactory.namedNode('https://example.com/Class'),
            }],
          },
          {
            type: 'filter',
            expression: {
              type: 'operation',
              operator: 'exists',
              args: [{
                type: 'graph',
                name: entityVariable,
                patterns: [{
                  type: 'bgp',
                  triples: [{
                    subject: entityVariable,
                    predicate: c1,
                    object: c2,
                  }],
                }],
              }],
            },
          },
        ],
        orders: [],
        graphWhere: [],
      });
    });
  });

  describe('#buildConstructFromEntitySelectQuery', (): void => {
    it('builds a construct query without a select clause.', (): void => {
      const graphSelectionTriples = [{ subject: c1, predicate: c2, object: c3 }];
      const selectPattern = [
        { subject: subjectNode, predicate: predicateNode, object: objectNode },
        { subject: c1, predicate: c2, object: c3 },
      ];
      expect(builder.buildConstructFromEntitySelectQuery(
        [],
        graphSelectionTriples,
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
            type: 'optional',
            patterns: [{ type: 'bgp', triples: selectPattern }],
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
            type: 'optional',
            patterns: [{ type: 'bgp', triples: selectPattern }],
          },
        ],
      });
    });
  });
});
