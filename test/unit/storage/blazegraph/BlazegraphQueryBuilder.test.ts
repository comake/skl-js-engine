/* eslint-disable @typescript-eslint/naming-convention */
import DataFactory from '@rdfjs/data-model';
import {
  BlazegraphQueryBuilder,
  BLAZEGRAPH_FULLTEXT_SERVICE,
} from '../../../../src/storage/blazegraph/BlazegraphQueryBuilder';
import { InverseRelation } from '../../../../src/storage/operator/InverseRelation';
import {
  entityVariable,
  objectNode,
  predicateNode,
  searchPredicate,
  subjectNode,
} from '../../../../src/util/SparqlUtil';

const c1 = DataFactory.variable('c1');
const c2 = DataFactory.variable('c2');
const c3 = DataFactory.variable('c3');
const c4 = DataFactory.variable('c4');
const c5 = DataFactory.variable('c5');
const c6 = DataFactory.variable('c6');
const c7 = DataFactory.variable('c7');
const c8 = DataFactory.variable('c8');
const c9 = DataFactory.variable('c9');
const predicate = DataFactory.namedNode('https://example.com/pred');
const predicate2 = DataFactory.namedNode('https://example.com/pred2');

describe('A BlazegraphQueryBuilder', (): void => {
  let builder: BlazegraphQueryBuilder;

  beforeEach(async(): Promise<void> => {
    builder = new BlazegraphQueryBuilder();
  });

  describe('#buildEntitySelectPatternsFromOptions', (): void => {
    it('builds a query with a bds search.', (): void => {
      expect(builder.buildEntitySelectPatternsFromOptions(
        entityVariable,
        { search: 'hello world' },
      )).toEqual({
        graphSelectionTriples: [],
        where: [
          {
            type: 'service',
            name: DataFactory.namedNode(BLAZEGRAPH_FULLTEXT_SERVICE),
            silent: false,
            patterns: [
              {
                type: 'bgp',
                triples: [
                  {
                    subject: c1,
                    predicate: searchPredicate,
                    object: DataFactory.literal('hello world'),
                  },
                ],
              },
            ],
          },
          {
            type: 'bgp',
            triples: [
              {
                subject: entityVariable,
                predicate: {
                  type: 'path',
                  pathType: '!',
                  items: [
                    DataFactory.namedNode(''),
                  ],
                },
                object: c1,
              },
            ],
          },
        ],
        orders: [],
        graphWhere: [],
      });
    });

    it('builds a query with a bds search on nested relations.', (): void => {
      expect(builder.buildEntitySelectPatternsFromOptions(
        entityVariable,
        {
          relations: {
            'https://example.com/pred': {
              'https://example.com/pred2': true,
            },
          },
          search: 'hello world',
          searchRelations: true,
        },
      )).toEqual({
        graphSelectionTriples: [
          { subject: c3, predicate: c4, object: c5 },
          { subject: c7, predicate: c8, object: c9 },
        ],
        where: [
          {
            type: 'service',
            name: DataFactory.namedNode(BLAZEGRAPH_FULLTEXT_SERVICE),
            silent: false,
            patterns: [
              {
                type: 'bgp',
                triples: [
                  {
                    subject: c1,
                    predicate: searchPredicate,
                    object: DataFactory.literal('hello world'),
                  },
                ],
              },
            ],
          },
          {
            type: 'bgp',
            triples: [
              {
                subject: entityVariable,
                predicate: {
                  type: 'path',
                  pathType: '|',
                  items: [
                    {
                      type: 'path',
                      pathType: '!',
                      items: [
                        DataFactory.namedNode(''),
                      ],
                    },
                    {
                      type: 'path',
                      pathType: '/',
                      items: [
                        predicate,
                        {
                          type: 'path',
                          pathType: '!',
                          items: [
                            DataFactory.namedNode(''),
                          ],
                        },
                      ],
                    },
                    {
                      type: 'path',
                      pathType: '/',
                      items: [
                        predicate,
                        predicate2,
                        {
                          type: 'path',
                          pathType: '!',
                          items: [
                            DataFactory.namedNode(''),
                          ],
                        },
                      ],
                    },
                  ],
                },
                object: c1,
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
                    object: c2,
                  },
                ],
              },
              {
                type: 'graph',
                name: c2,
                patterns: [
                  {
                    type: 'bgp',
                    triples: [
                      { subject: c3, predicate: c4, object: c5 },
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
                      { subject: c2, predicate: predicate2, object: c6 },
                    ],
                  },
                  {
                    type: 'graph',
                    name: c6,
                    patterns: [
                      {
                        type: 'bgp',
                        triples: [
                          { subject: c7, predicate: c8, object: c9 },
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

    it('builds a query with a bds search on an inverse relation.', (): void => {
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
          search: 'hello world',
          searchRelations: true,
        },
      )).toEqual({
        graphSelectionTriples: [
          { subject: c3, predicate: c4, object: c5 },
          { subject: c7, predicate: c8, object: c9 },
        ],
        where: [
          {
            type: 'service',
            name: DataFactory.namedNode(BLAZEGRAPH_FULLTEXT_SERVICE),
            silent: false,
            patterns: [{
              type: 'bgp',
              triples: [
                {
                  subject: c1,
                  predicate: searchPredicate,
                  object: DataFactory.literal('hello world'),
                },
              ],
            }],
          },
          {
            type: 'bgp',
            triples: [
              {
                subject: entityVariable,
                predicate: {
                  type: 'path',
                  pathType: '|',
                  items: [
                    {
                      type: 'path',
                      pathType: '!',
                      items: [
                        DataFactory.namedNode(''),
                      ],
                    },
                    {
                      type: 'path',
                      pathType: '/',
                      items: [
                        {
                          type: 'path',
                          pathType: '^',
                          items: [ predicate ],
                        },
                        {
                          type: 'path',
                          pathType: '!',
                          items: [
                            DataFactory.namedNode(''),
                          ],
                        },
                      ],
                    },
                    {
                      type: 'path',
                      pathType: '/',
                      items: [
                        {
                          type: 'path',
                          pathType: '^',
                          items: [ predicate ],
                        },
                        predicate2,
                        {
                          type: 'path',
                          pathType: '!',
                          items: [
                            DataFactory.namedNode(''),
                          ],
                        },
                      ],
                    },
                  ],
                },
                object: c1,
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
                triples: [
                  {
                    subject: entityVariable,
                    predicate: {
                      type: 'path',
                      pathType: '^',
                      items: [ predicate ],
                    },
                    object: c2,
                  },
                ],
                type: 'bgp',
              },
              {
                type: 'graph',
                name: c2,
                patterns: [
                  {
                    type: 'bgp',
                    triples: [
                      { subject: c3, predicate: c4, object: c5 },
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
                      { subject: c2, predicate: predicate2, object: c6 },
                    ],
                  },
                  {
                    type: 'graph',
                    name: c6,
                    patterns: [
                      {
                        type: 'bgp',
                        triples: [
                          { subject: c7, predicate: c8, object: c9 },
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
