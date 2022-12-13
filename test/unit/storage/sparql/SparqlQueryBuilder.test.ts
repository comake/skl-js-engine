/* eslint-disable @typescript-eslint/naming-convention */
import DataFactory from '@rdfjs/data-model';
import type { FindOperator } from '../../../../src/storage/FindOperator';
import { Equal } from '../../../../src/storage/operator/Equal';
import { In } from '../../../../src/storage/operator/In';
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
import { SKL, XSD } from '../../../../src/util/Vocabularies';

const c1 = DataFactory.variable('c1');
const c2 = DataFactory.variable('c2');
const c3 = DataFactory.variable('c3');
const predicate = DataFactory.namedNode('https://example.com/pred');
const data1 = DataFactory.namedNode('https://example.com/data/1');
const data2 = DataFactory.namedNode('https://example.com/data/2');
const file = DataFactory.namedNode(SKL.File);
const event = DataFactory.namedNode(SKL.Event);

describe('A SparqlQueryBuilder', (): void => {
  let builder: SparqlQueryBuilder;

  beforeEach(async(): Promise<void> => {
    builder = new SparqlQueryBuilder();
  });

  it('builds a query without any options.', (): void => {
    const query = {
      type: 'query',
      queryType: 'CONSTRUCT',
      prefixes: {},
      template: [{ subject: subjectNode, predicate: predicateNode, object: objectNode }],
      where: [
        {
          type: 'graph',
          name: entityVariable,
          patterns: [
            {
              type: 'bgp',
              triples: [{ subject: subjectNode, predicate: predicateNode, object: objectNode }],
            },
          ],
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
              triples: [{ subject: c1, predicate: c2, object: c3 }],
            }],
          }],
        },
      ],
    };
    expect(builder.buildQuery()).toEqual(query);
  });

  it('builds a query with where, limit, and offset options.', (): void => {
    const query = {
      type: 'query',
      queryType: 'CONSTRUCT',
      prefixes: {},
      template: [{ subject: subjectNode, predicate: predicateNode, object: objectNode }],
      where: [
        {
          type: 'graph',
          name: entityVariable,
          patterns: [
            {
              type: 'bgp',
              triples: [{ subject: subjectNode, predicate: predicateNode, object: objectNode }],
            },
          ],
        },
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
          }],
        },
      ],
    };
    expect(builder.buildQuery({
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
      template: [{ subject: subjectNode, predicate: predicateNode, object: objectNode }],
      where: [
        {
          type: 'graph',
          name: entityVariable,
          patterns: [
            {
              type: 'bgp',
              triples: [{ subject: subjectNode, predicate: predicateNode, object: objectNode }],
            },
          ],
        },
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
          }],
        },
      ],
    };
    expect(builder.buildQuery({
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
      template: [{ subject: subjectNode, predicate: predicateNode, object: objectNode }],
      where: [
        {
          type: 'graph',
          name: entityVariable,
          patterns: [
            {
              type: 'bgp',
              triples: [{ subject: subjectNode, predicate: predicateNode, object: objectNode }],
            },
          ],
        },
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
          }],
        },
      ],
    };
    expect(builder.buildQuery({
      where: {
        id: 'https://example.com/data/1',
        'https://example.com/nested': {
          id: 'https://example.com/data/2',
        },
      },
    })).toEqual(query);
  });

  it('builds a query with a URL filter.', (): void => {
    const query = {
      type: 'query',
      queryType: 'CONSTRUCT',
      prefixes: {},
      template: [{ subject: subjectNode, predicate: predicateNode, object: objectNode }],
      where: [
        {
          type: 'graph',
          name: entityVariable,
          patterns: [
            {
              type: 'bgp',
              triples: [{ subject: subjectNode, predicate: predicateNode, object: objectNode }],
            },
          ],
        },
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
          }],
        },
      ],
    };
    expect(builder.buildQuery({
      where: {
        'https://example.com/pred': 'https://example.com/object',
      },
    })).toEqual(query);
  });

  it('builds a query with an in operator on the id field.', (): void => {
    const query = {
      type: 'query',
      queryType: 'CONSTRUCT',
      prefixes: {},
      template: [{ subject: subjectNode, predicate: predicateNode, object: objectNode }],
      where: [
        {
          type: 'graph',
          name: entityVariable,
          patterns: [
            {
              type: 'bgp',
              triples: [{ subject: subjectNode, predicate: predicateNode, object: objectNode }],
            },
          ],
        },
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
          }],
        },
      ],
    };
    expect(builder.buildQuery({
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
      template: [{ subject: subjectNode, predicate: predicateNode, object: objectNode }],
      where: [
        {
          type: 'graph',
          name: entityVariable,
          patterns: [
            {
              type: 'bgp',
              triples: [{ subject: subjectNode, predicate: predicateNode, object: objectNode }],
            },
          ],
        },
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
          }],
        },
      ],
    };
    expect(builder.buildQuery({
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
      template: [{ subject: subjectNode, predicate: predicateNode, object: objectNode }],
      where: [
        {
          type: 'graph',
          name: entityVariable,
          patterns: [
            {
              type: 'bgp',
              triples: [{ subject: subjectNode, predicate: predicateNode, object: objectNode }],
            },
          ],
        },
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
          }],
        },
      ],
    };
    expect(builder.buildQuery({
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
      template: [{ subject: subjectNode, predicate: predicateNode, object: objectNode }],
      where: [
        {
          type: 'graph',
          name: entityVariable,
          patterns: [
            {
              type: 'bgp',
              triples: [{ subject: subjectNode, predicate: predicateNode, object: objectNode }],
            },
          ],
        },
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
          }],
        },
      ],
    };
    expect(builder.buildQuery({
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
      template: [{ subject: subjectNode, predicate: predicateNode, object: objectNode }],
      where: [
        {
          type: 'graph',
          name: entityVariable,
          patterns: [
            {
              type: 'bgp',
              triples: [{ subject: subjectNode, predicate: predicateNode, object: objectNode }],
            },
          ],
        },
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
          }],
        },
      ],
    };
    expect(builder.buildQuery({
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
      template: [{ subject: subjectNode, predicate: predicateNode, object: objectNode }],
      where: [
        {
          type: 'graph',
          name: entityVariable,
          patterns: [
            {
              type: 'bgp',
              triples: [{ subject: subjectNode, predicate: predicateNode, object: objectNode }],
            },
          ],
        },
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
          }],
        },
      ],
    };
    expect(builder.buildQuery({
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
      template: [{ subject: subjectNode, predicate: predicateNode, object: objectNode }],
      where: [
        {
          type: 'graph',
          name: entityVariable,
          patterns: [
            {
              type: 'bgp',
              triples: [{ subject: subjectNode, predicate: predicateNode, object: objectNode }],
            },
          ],
        },
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
          }],
        },
      ],
    };
    expect(builder.buildQuery({
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
      template: [{ subject: subjectNode, predicate: predicateNode, object: objectNode }],
      where: [
        {
          type: 'graph',
          name: entityVariable,
          patterns: [
            {
              type: 'bgp',
              triples: [{ subject: subjectNode, predicate: predicateNode, object: objectNode }],
            },
          ],
        },
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
          }],
        },
      ],
    };
    expect(builder.buildQuery({
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
      template: [{ subject: subjectNode, predicate: predicateNode, object: objectNode }],
      where: [
        {
          type: 'graph',
          name: entityVariable,
          patterns: [
            {
              type: 'bgp',
              triples: [{ subject: subjectNode, predicate: predicateNode, object: objectNode }],
            },
          ],
        },
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
          }],
        },
      ],
    };
    expect(builder.buildQuery({
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
      template: [{ subject: subjectNode, predicate: predicateNode, object: objectNode }],
      where: [
        {
          type: 'graph',
          name: entityVariable,
          patterns: [
            {
              type: 'bgp',
              triples: [{ subject: subjectNode, predicate: predicateNode, object: objectNode }],
            },
          ],
        },
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
          }],
        },
      ],
    };
    expect(builder.buildQuery({
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
      template: [{ subject: subjectNode, predicate: predicateNode, object: objectNode }],
      where: [
        {
          type: 'graph',
          name: entityVariable,
          patterns: [
            {
              type: 'bgp',
              triples: [{ subject: subjectNode, predicate: predicateNode, object: objectNode }],
            },
          ],
        },
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
          }],
        },
      ],
    };
    expect(builder.buildQuery({
      where: {
        'https://example.com/pred': Equal(1),
      },
    })).toEqual(query);
  });

  it('throws an error if there is an unsupported operation on a non id field.', (): void => {
    expect((): void => {
      builder.buildQuery({
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
      builder.buildQuery({
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
      builder.buildQuery({
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
        builder.buildQuery({
          where: {
            id: Not({
              type: 'operator',
              operator: 'and',
            }) as unknown as FindOperator<string>,
          },
        });
      }).toThrow('Unsupported Not sub operator "and"');
    });
});
