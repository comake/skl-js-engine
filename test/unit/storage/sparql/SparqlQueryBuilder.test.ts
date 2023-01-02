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
  countVariable,
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
const graphPattern = [{ subject: subjectNode, predicate: predicateNode, object: objectNode }];

describe('A SparqlQueryBuilder', (): void => {
  let builder: SparqlQueryBuilder;

  beforeEach(async(): Promise<void> => {
    builder = new SparqlQueryBuilder();
  });

  describe('exists query', (): void => {
    it('builds an ask query.', (): void => {
      const query = {
        type: 'query',
        queryType: 'ASK',
        prefixes: {},
        where: [{
          type: 'bgp',
          triples: [{
            subject: entityVariable,
            predicate,
            object: DataFactory.literal('1', XSD.integer),
          }],
        }],
      };
      expect(builder.buildEntityExistQuery({
        'https://example.com/pred': 1,
      })).toEqual(query);
    });
  });

  describe('count query', (): void => {
    it('builds a select count query.', (): void => {
      const query = {
        type: 'query',
        queryType: 'SELECT',
        prefixes: {},
        variables: [{
          expression: {
            type: 'aggregate',
            aggregation: 'count',
            distinct: true,
            expression: entityVariable,
          },
          variable: countVariable,
        }],
        where: [{
          type: 'graph',
          name: entityVariable,
          patterns: [{
            type: 'bgp',
            triples: [{
              subject: entityVariable,
              predicate,
              object: DataFactory.literal('1', XSD.integer),
            }],
          }],
        }],
      };
      expect(builder.buildEntityCountQuery({
        'https://example.com/pred': 1,
      })).toEqual(query);
    });
  });

  describe('entity query', (): void => {
    it('builds a query without any options.', (): void => {
      const query = {
        type: 'query',
        queryType: 'CONSTRUCT',
        prefixes: {},
        template: graphPattern,
        where: [
          {
            type: 'group',
            patterns: [{
              type: 'query',
              prefixes: {},
              queryType: 'SELECT',
              variables: [ entityVariable ],
              where: [{
                type: 'bgp',
                triples: [{
                  subject: entityVariable,
                  predicate: c1,
                  object: c2,
                }],
              }],
              limit: undefined,
              offset: undefined,
              order: undefined,
            }],
          },
          {
            type: 'graph',
            name: entityVariable,
            patterns: [{ type: 'bgp', triples: graphPattern }],
          },
        ],
      };
      expect(builder.buildEntityQuery()).toEqual(query);
    });

    it('builds a query with where, limit, and offset options.', (): void => {
      const query = {
        type: 'query',
        queryType: 'CONSTRUCT',
        prefixes: {},
        template: graphPattern,
        where: [
          {
            type: 'group',
            patterns: [{
              type: 'query',
              prefixes: {},
              queryType: 'SELECT',
              variables: [ entityVariable ],
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
              limit: 5,
              offset: 5,
              order: undefined,
            }],
          },
          {
            type: 'graph',
            name: entityVariable,
            patterns: [{ type: 'bgp', triples: graphPattern }],
          },
        ],
      };
      expect(builder.buildEntityQuery({
        where: {
          id: 'https://example.com/data/1',
          type: SKL.File,
          'https://example.com/pred': 1,
        },
        limit: 5,
        offset: 5,
      })).toEqual(query);
    });

    it('builds a query with one filter and no triple patterns.', (): void => {
      const query = {
        type: 'query',
        queryType: 'CONSTRUCT',
        prefixes: {},
        template: graphPattern,
        where: [
          {
            type: 'group',
            patterns: [{
              type: 'query',
              prefixes: {},
              queryType: 'SELECT',
              variables: [ entityVariable ],
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
              limit: undefined,
              offset: undefined,
              order: undefined,
            }],
          },
          {
            type: 'graph',
            name: entityVariable,
            patterns: [{ type: 'bgp', triples: graphPattern }],
          },
        ],
      };
      expect(builder.buildEntityQuery({
        where: {
          id: 'https://example.com/data/1',
        },
      })).toEqual(query);
    });

    it('builds a query with more than one filter.', (): void => {
      const query = {
        type: 'query',
        queryType: 'CONSTRUCT',
        prefixes: {},
        template: graphPattern,
        where: [
          {
            type: 'group',
            patterns: [{
              type: 'query',
              prefixes: {},
              queryType: 'SELECT',
              variables: [ entityVariable ],
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
              limit: undefined,
              offset: undefined,
              order: undefined,
            }],
          },
          {
            type: 'graph',
            name: entityVariable,
            patterns: [{ type: 'bgp', triples: graphPattern }],
          },
        ],
      };
      expect(builder.buildEntityQuery({
        where: {
          id: 'https://example.com/data/1',
          'https://example.com/nested': {
            id: 'https://example.com/data/2',
          },
        },
      })).toEqual(query);
    });

    it('builds a query with a literal value filter.', (): void => {
      const query = {
        type: 'query',
        queryType: 'CONSTRUCT',
        prefixes: {},
        template: graphPattern,
        where: [
          {
            type: 'group',
            patterns: [{
              type: 'query',
              prefixes: {},
              queryType: 'SELECT',
              variables: [ entityVariable ],
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
              limit: undefined,
              offset: undefined,
              order: undefined,
            }],
          },
          {
            type: 'graph',
            name: entityVariable,
            patterns: [{ type: 'bgp', triples: graphPattern }],
          },
        ],
      };
      expect(builder.buildEntityQuery({
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
      })).toEqual(query);
    });

    it('builds a query with a NamedNode filter.', (): void => {
      const query = {
        type: 'query',
        queryType: 'CONSTRUCT',
        prefixes: {},
        template: graphPattern,
        where: [
          {
            type: 'group',
            patterns: [{
              type: 'query',
              prefixes: {},
              queryType: 'SELECT',
              variables: [ entityVariable ],
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
              limit: undefined,
              offset: undefined,
              order: undefined,
            }],
          },
          {
            type: 'graph',
            name: entityVariable,
            patterns: [{ type: 'bgp', triples: graphPattern }],
          },
        ],
      };
      expect(builder.buildEntityQuery({
        where: {
          'https://example.com/pred': 'https://example.com/object',
        },
      })).toEqual(query);
    });

    it('builds a query with an array valued filter.', (): void => {
      const query = {
        type: 'query',
        queryType: 'CONSTRUCT',
        prefixes: {},
        template: graphPattern,
        where: [
          {
            type: 'group',
            patterns: [{
              type: 'query',
              prefixes: {},
              queryType: 'SELECT',
              variables: [ entityVariable ],
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
              limit: undefined,
              offset: undefined,
              order: undefined,
            }],
          },
          {
            type: 'graph',
            name: entityVariable,
            patterns: [{ type: 'bgp', triples: graphPattern }],
          },
        ],
      };
      expect(builder.buildEntityQuery({
        where: {
          'https://example.com/pred': [ 1, 2 ],
        },
      })).toEqual(query);
    });

    it('builds a query with an in operator on the id field.', (): void => {
      const query = {
        type: 'query',
        queryType: 'CONSTRUCT',
        prefixes: {},
        template: graphPattern,
        where: [
          {
            type: 'group',
            patterns: [{
              type: 'query',
              prefixes: {},
              queryType: 'SELECT',
              variables: [ entityVariable ],
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
              limit: undefined,
              offset: undefined,
              order: undefined,
            }],
          },
          {
            type: 'graph',
            name: entityVariable,
            patterns: [{ type: 'bgp', triples: graphPattern }],
          },
        ],
      };
      expect(builder.buildEntityQuery({
        where: {
          id: In([ 'https://example.com/data/1' ]),
        },
      })).toEqual(query);
    });

    it('builds a query with an in operator on the type field.', (): void => {
      const query = {
        type: 'query',
        queryType: 'CONSTRUCT',
        prefixes: {},
        template: graphPattern,
        where: [
          {
            type: 'group',
            patterns: [{
              type: 'query',
              prefixes: {},
              queryType: 'SELECT',
              variables: [ entityVariable ],
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
              limit: undefined,
              offset: undefined,
              order: undefined,
            }],
          },
          {
            type: 'graph',
            name: entityVariable,
            patterns: [{ type: 'bgp', triples: graphPattern }],
          },
        ],
      };
      expect(builder.buildEntityQuery({
        where: {
          type: In([ SKL.File, SKL.Event ]),
        },
      })).toEqual(query);
    });

    it('builds a query with an in operator on a non id field.', (): void => {
      const query = {
        type: 'query',
        queryType: 'CONSTRUCT',
        prefixes: {},
        template: graphPattern,
        where: [
          {
            type: 'group',
            patterns: [{
              type: 'query',
              prefixes: {},
              queryType: 'SELECT',
              variables: [ entityVariable ],
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
              limit: undefined,
              offset: undefined,
              order: undefined,
            }],
          },
          {
            type: 'graph',
            name: entityVariable,
            patterns: [{ type: 'bgp', triples: graphPattern }],
          },
        ],
      };
      expect(builder.buildEntityQuery({
        where: {
          'https://example.com/pred': In([ 1, 2 ]),
        },
      })).toEqual(query);
    });

    it('builds a query with a not operator on the id field.', (): void => {
      const query = {
        type: 'query',
        queryType: 'CONSTRUCT',
        prefixes: {},
        template: graphPattern,
        where: [
          {
            type: 'group',
            patterns: [{
              type: 'query',
              prefixes: {},
              queryType: 'SELECT',
              variables: [ entityVariable ],
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
              limit: undefined,
              offset: undefined,
              order: undefined,
            }],
          },
          {
            type: 'graph',
            name: entityVariable,
            patterns: [{ type: 'bgp', triples: graphPattern }],
          },
        ],
      };
      expect(builder.buildEntityQuery({
        where: {
          id: Not('https://example.com/data/1'),
        },
      })).toEqual(query);
    });

    it('builds a query with a nested not in operator on the id field.', (): void => {
      const query = {
        type: 'query',
        queryType: 'CONSTRUCT',
        prefixes: {},
        template: graphPattern,
        where: [
          {
            type: 'group',
            patterns: [{
              type: 'query',
              prefixes: {},
              queryType: 'SELECT',
              variables: [ entityVariable ],
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
              limit: undefined,
              offset: undefined,
              order: undefined,
            }],
          },
          {
            type: 'graph',
            name: entityVariable,
            patterns: [{ type: 'bgp', triples: graphPattern }],
          },
        ],
      };
      expect(builder.buildEntityQuery({
        where: {
          id: Not(In([ 'https://example.com/data/1', 'https://example.com/data/2' ])),
        },
      })).toEqual(query);
    });

    it('builds a query with a nested not equal operator on the id field.', (): void => {
      const query = {
        type: 'query',
        queryType: 'CONSTRUCT',
        prefixes: {},
        template: graphPattern,
        where: [
          {
            type: 'group',
            patterns: [{
              type: 'query',
              prefixes: {},
              queryType: 'SELECT',
              variables: [ entityVariable ],
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
              limit: undefined,
              offset: undefined,
              order: undefined,
            }],
          },
          {
            type: 'graph',
            name: entityVariable,
            patterns: [{ type: 'bgp', triples: graphPattern }],
          },
        ],
      };
      expect(builder.buildEntityQuery({
        where: {
          id: Not(Equal('https://example.com/data/1')),
        },
      })).toEqual(query);
    });

    it('builds a query with an equal operator on the id field.', (): void => {
      const query = {
        type: 'query',
        queryType: 'CONSTRUCT',
        prefixes: {},
        template: graphPattern,
        where: [
          {
            type: 'group',
            patterns: [{
              type: 'query',
              prefixes: {},
              queryType: 'SELECT',
              variables: [ entityVariable ],
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
              limit: undefined,
              offset: undefined,
              order: undefined,
            }],
          },
          {
            type: 'graph',
            name: entityVariable,
            patterns: [{ type: 'bgp', triples: graphPattern }],
          },
        ],
      };
      expect(builder.buildEntityQuery({
        where: {
          id: Equal('https://example.com/data/1'),
        },
      })).toEqual(query);
    });

    it('builds a query with a not operator on a non id field.', (): void => {
      const query = {
        type: 'query',
        queryType: 'CONSTRUCT',
        prefixes: {},
        template: graphPattern,
        where: [
          {
            type: 'group',
            patterns: [{
              type: 'query',
              prefixes: {},
              queryType: 'SELECT',
              variables: [ entityVariable ],
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
              limit: undefined,
              offset: undefined,
              order: undefined,
            }],
          },
          {
            type: 'graph',
            name: entityVariable,
            patterns: [{ type: 'bgp', triples: graphPattern }],
          },
        ],
      };
      expect(builder.buildEntityQuery({
        where: {
          'https://example.com/pred': Not(1),
        },
      })).toEqual(query);
    });

    it('builds a query with a nested not in operator on a non id field.', (): void => {
      const query = {
        type: 'query',
        queryType: 'CONSTRUCT',
        prefixes: {},
        template: graphPattern,
        where: [
          {
            type: 'group',
            patterns: [{
              type: 'query',
              prefixes: {},
              queryType: 'SELECT',
              variables: [ entityVariable ],
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
              limit: undefined,
              offset: undefined,
              order: undefined,
            }],
          },
          {
            type: 'graph',
            name: entityVariable,
            patterns: [{ type: 'bgp', triples: graphPattern }],
          },
        ],
      };
      expect(builder.buildEntityQuery({
        where: {
          'https://example.com/pred': Not(In([ 1, 2 ])),
        },
      })).toEqual(query);
    });

    it('builds a query with a nested not equal operator on a non id field.', (): void => {
      const query = {
        type: 'query',
        queryType: 'CONSTRUCT',
        prefixes: {},
        template: graphPattern,
        where: [
          {
            type: 'group',
            patterns: [{
              type: 'query',
              prefixes: {},
              queryType: 'SELECT',
              variables: [ entityVariable ],
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
              limit: undefined,
              offset: undefined,
              order: undefined,
            }],
          },
          {
            type: 'graph',
            name: entityVariable,
            patterns: [{ type: 'bgp', triples: graphPattern }],
          },
        ],
      };
      expect(builder.buildEntityQuery({
        where: {
          'https://example.com/pred': Not(Equal(1)),
        },
      })).toEqual(query);
    });

    it('builds a query with an equal operator on a non id field.', (): void => {
      const query = {
        type: 'query',
        queryType: 'CONSTRUCT',
        prefixes: {},
        template: graphPattern,
        where: [
          {
            type: 'group',
            patterns: [{
              type: 'query',
              prefixes: {},
              queryType: 'SELECT',
              variables: [ entityVariable ],
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
              limit: undefined,
              offset: undefined,
              order: undefined,
            }],
          },
          {
            type: 'graph',
            name: entityVariable,
            patterns: [{ type: 'bgp', triples: graphPattern }],
          },
        ],
      };
      expect(builder.buildEntityQuery({
        where: {
          'https://example.com/pred': Equal(1),
        },
      })).toEqual(query);
    });

    it('builds a query with a gt operator.', (): void => {
      const query = {
        type: 'query',
        queryType: 'CONSTRUCT',
        prefixes: {},
        template: graphPattern,
        where: [
          {
            type: 'group',
            patterns: [{
              type: 'query',
              prefixes: {},
              queryType: 'SELECT',
              variables: [ entityVariable ],
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
              limit: undefined,
              offset: undefined,
              order: undefined,
            }],
          },
          {
            type: 'graph',
            name: entityVariable,
            patterns: [{ type: 'bgp', triples: graphPattern }],
          },
        ],
      };
      expect(builder.buildEntityQuery({
        where: {
          'https://example.com/pred': GreaterThan(1),
        },
      })).toEqual(query);
    });

    it('builds a query with a gte operator.', (): void => {
      const query = {
        type: 'query',
        queryType: 'CONSTRUCT',
        prefixes: {},
        template: graphPattern,
        where: [
          {
            type: 'group',
            patterns: [{
              type: 'query',
              prefixes: {},
              queryType: 'SELECT',
              variables: [ entityVariable ],
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
              limit: undefined,
              offset: undefined,
              order: undefined,
            }],
          },
          {
            type: 'graph',
            name: entityVariable,
            patterns: [{ type: 'bgp', triples: graphPattern }],
          },
        ],
      };
      expect(builder.buildEntityQuery({
        where: {
          'https://example.com/pred': GreaterThanOrEqual(1),
        },
      })).toEqual(query);
    });

    it('builds a query with a lt operator.', (): void => {
      const query = {
        type: 'query',
        queryType: 'CONSTRUCT',
        prefixes: {},
        template: graphPattern,
        where: [
          {
            type: 'group',
            patterns: [{
              type: 'query',
              prefixes: {},
              queryType: 'SELECT',
              variables: [ entityVariable ],
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
              limit: undefined,
              offset: undefined,
              order: undefined,
            }],
          },
          {
            type: 'graph',
            name: entityVariable,
            patterns: [{ type: 'bgp', triples: graphPattern }],
          },
        ],
      };
      expect(builder.buildEntityQuery({
        where: {
          'https://example.com/pred': LessThan(1),
        },
      })).toEqual(query);
    });

    it('builds a query with a lte operator.', (): void => {
      const query = {
        type: 'query',
        queryType: 'CONSTRUCT',
        prefixes: {},
        template: graphPattern,
        where: [
          {
            type: 'group',
            patterns: [{
              type: 'query',
              prefixes: {},
              queryType: 'SELECT',
              variables: [ entityVariable ],
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
              limit: undefined,
              offset: undefined,
              order: undefined,
            }],
          },
          {
            type: 'graph',
            name: entityVariable,
            patterns: [{ type: 'bgp', triples: graphPattern }],
          },
        ],
      };
      expect(builder.buildEntityQuery({
        where: {
          'https://example.com/pred': LessThanOrEqual(1),
        },
      })).toEqual(query);
    });

    it('builds a query with an inverse operator.', (): void => {
      const query = {
        type: 'query',
        queryType: 'CONSTRUCT',
        prefixes: {},
        template: graphPattern,
        where: [
          {
            type: 'group',
            patterns: [{
              type: 'query',
              prefixes: {},
              queryType: 'SELECT',
              variables: [ entityVariable ],
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
            }],
          },
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
            type: 'graph',
            name: entityVariable,
            patterns: [{ type: 'bgp', triples: graphPattern }],
          },
        ],
      };
      expect(builder.buildEntityQuery({
        where: {
          'https://example.com/pred': Inverse(1),
        },
      })).toEqual(query);
    });

    it('throws an error if there is an unsupported operation on a non id field.', (): void => {
      expect((): void => {
        builder.buildEntityQuery({
          where: {
            'https://example.com/pred': {
              type: 'operator',
              operator: 'and',
            },
          },
        });
      }).toThrow('Unsupported operator "and"');
    });

    it('throws an error if there is an unsupported operation on the id field.', (): void => {
      expect((): void => {
        builder.buildEntityQuery({
          where: {
            id: {
              type: 'operator',
              operator: 'and' as any,
            } as FindOperator<string>,
          },
        });
      }).toThrow('Unsupported operator "and"');
    });

    it('throws an error if there is an unsupported operation as an argument to a Not operator.', (): void => {
      expect((): void => {
        builder.buildEntityQuery({
          where: {
            'https://example.com/pred': Not({
              type: 'operator',
              operator: 'and',
            }),
          },
        });
      }).toThrow('Unsupported Not sub operator "and"');
    });

    it('throws an error if there is an unsupported operation as an argument to a Not operator on the id field.',
      (): void => {
        expect((): void => {
          builder.buildEntityQuery({
            where: {
              id: Not({
                type: 'operator',
                operator: 'and',
              }) as unknown as FindOperator<string>,
            },
          });
        }).toThrow('Unsupported Not sub operator "and"');
      });

    it('builds a query with a with an order.', (): void => {
      const query = {
        type: 'query',
        queryType: 'CONSTRUCT',
        prefixes: {},
        template: graphPattern,
        where: [
          {
            type: 'group',
            patterns: [{
              type: 'query',
              prefixes: {},
              queryType: 'SELECT',
              variables: [ entityVariable ],
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
              limit: undefined,
              offset: undefined,
              order: [{
                expression: c3,
                descending: true,
              }],
            }],
          },
          {
            type: 'graph',
            name: entityVariable,
            patterns: [{ type: 'bgp', triples: graphPattern }],
          },
        ],
      };
      expect(builder.buildEntityQuery({
        order: {
          'https://example.com/pred': 'desc',
        },
      })).toEqual(query);
    });

    it('builds a query with a with an order on id.', (): void => {
      const query = {
        type: 'query',
        queryType: 'CONSTRUCT',
        prefixes: {},
        template: graphPattern,
        where: [
          {
            type: 'group',
            patterns: [{
              type: 'query',
              prefixes: {},
              queryType: 'SELECT',
              variables: [ entityVariable ],
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
              limit: undefined,
              offset: undefined,
              order: [{
                expression: entityVariable,
                descending: true,
              }],
            }],
          },
          {
            type: 'graph',
            name: entityVariable,
            patterns: [{ type: 'bgp', triples: graphPattern }],
          },
        ],
      };
      expect(builder.buildEntityQuery({
        order: { id: 'desc' },
      })).toEqual(query);
    });

    it('builds a query with a nested select clause.', (): void => {
      const selectPattern = [
        { subject: entityVariable, predicate, object: c3 },
        { subject: c3, predicate: predicate2, object: c4 },
      ];
      const query = {
        type: 'query',
        queryType: 'CONSTRUCT',
        prefixes: {},
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
          {
            type: 'group',
            patterns: [{
              type: 'query',
              prefixes: {},
              queryType: 'SELECT',
              variables: [ entityVariable ],
              where: [{
                type: 'bgp',
                triples: [{
                  subject: entityVariable,
                  predicate: c1,
                  object: c2,
                }],
              }],
              limit: undefined,
              offset: undefined,
              order: undefined,
            }],
          },
        ],
      };
      expect(builder.buildEntityQuery({
        select: {
          'https://example.com/pred': {
            'https://example.com/pred2': true,
          },
        },
      })).toEqual(query);
    });

    it('builds a query with an array of selections.', (): void => {
      const selectPattern = [
        { subject: entityVariable, predicate, object: c3 },
        { subject: entityVariable, predicate: predicate2, object: c4 },
      ];
      const query = {
        type: 'query',
        queryType: 'CONSTRUCT',
        prefixes: {},
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
          {
            type: 'group',
            patterns: [{
              type: 'query',
              prefixes: {},
              queryType: 'SELECT',
              variables: [ entityVariable ],
              where: [{
                type: 'bgp',
                triples: [{
                  subject: entityVariable,
                  predicate: c1,
                  object: c2,
                }],
              }],
              limit: undefined,
              offset: undefined,
              order: undefined,
            }],
          },
        ],
      };
      expect(builder.buildEntityQuery({
        select: [
          'https://example.com/pred',
          'https://example.com/pred2',
        ],
      })).toEqual(query);
    });

    it('builds a query with selected relations.', (): void => {
      const query = {
        type: 'query',
        queryType: 'CONSTRUCT',
        prefixes: {},
        template: [
          { subject: subjectNode, predicate: predicateNode, object: objectNode },
          { subject: c5, predicate: c6, object: c7 },
          { subject: c8, predicate: c9, object: c10 },
        ],
        where: [
          {
            type: 'group',
            patterns: [{
              type: 'query',
              prefixes: {},
              queryType: 'SELECT',
              variables: [ entityVariable, c3, c4 ],
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
              limit: undefined,
              offset: undefined,
              order: undefined,
            }],
          },
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
          {
            type: 'graph',
            name: entityVariable,
            patterns: [{
              type: 'bgp',
              triples: [
                { subject: subjectNode, predicate: predicateNode, object: objectNode },
              ],
            }],
          },
          {
            type: 'optional',
            patterns: [
              {
                type: 'graph',
                name: c3,
                patterns: [
                  {
                    type: 'bgp',
                    triples: [
                      {
                        subject: c5,
                        predicate: c6,
                        object: c7,
                      },
                    ],
                  },
                ],
              },
            ],
          },
          {
            type: 'optional',
            patterns: [
              {
                type: 'graph',
                name: c4,
                patterns: [
                  {
                    type: 'bgp',
                    triples: [
                      {
                        subject: c8,
                        predicate: c9,
                        object: c10,
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      };
      expect(builder.buildEntityQuery({
        relations: {
          'https://example.com/pred': {
            'https://example.com/pred2': true,
          },
        },
      })).toEqual(query);
    });
  });
});
