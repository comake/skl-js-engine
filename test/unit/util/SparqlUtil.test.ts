/* eslint-disable @typescript-eslint/naming-convention */
import DataFactory from '@rdfjs/data-model';
import {
  countVariable,
  createFilterPatternFromFilters,
  createSparqlBasicGraphPattern,
  createSparqlConstructQuery,
  createSparqlCountSelectQuery,
  createSparqlEqualOperation,
  createSparqlFilterWithExpression,
  createSparqlGteOperation,
  createSparqlGtOperation,
  createSparqlInOperation,
  createSparqlInversePredicate,
  createSparqlLteOperation,
  createSparqlLtOperation,
  createSparqlNotEqualOperation,
  createSparqlNotExistsOperation,
  createSparqlNotInOperation,
  createSparqlOptional,
  createSparqlOptionalGraphSelection,
  createSparqlOrPredicate,
  createSparqlPathPredicate,
  createSparqlSelectGraph,
  createSparqlSelectGroup,
  createSparqlSelectQuery,
  createSparqlServicePattern,
  createValuesPatternsForVariables,
  creteSparqlAskQuery,
  getEntityVariableValuesFromVariables,
  groupSelectQueryResultsByKey,
  objectNode,
  predicateNode,
  selectQueryResultsAsJSValues,
} from '../../../src/util/SparqlUtil';
import { XSD } from '../../../src/util/Vocabularies';

describe('SparqlUtil', (): void => {
  describe('#createSparqlSelectGraph', (): void => {
    it('creates a sparql select graph.', (): void => {
      const node = DataFactory.variable('node');
      expect(
        createSparqlSelectGraph(node, []),
      ).toEqual({
        type: 'graph',
        name: node,
        patterns: [],
      });
    });
  });

  describe('#createSparqlConstructQuery', (): void => {
    it('creates a sparql construct query.', (): void => {
      expect(
        createSparqlConstructQuery([], []),
      ).toEqual({
        type: 'query',
        prefixes: {},
        queryType: 'CONSTRUCT',
        template: [],
        where: [],
      });
    });
  });

  describe('#createSparqlCountSelectQuery', (): void => {
    it('creates a sparql count select query.', (): void => {
      const node = DataFactory.variable('node');
      expect(
        createSparqlCountSelectQuery(node, []),
      ).toEqual({
        type: 'query',
        queryType: 'SELECT',
        variables: [{
          expression: {
            type: 'aggregate',
            aggregation: 'count',
            distinct: true,
            expression: node,
          },
          variable: countVariable,
        }],
        where: [
          {
            type: 'graph',
            name: node,
            patterns: [{
              type: 'bgp',
              triples: [{
                subject: node,
                predicate: predicateNode,
                object: objectNode,
              }],
            }],
          },
        ],
        prefixes: {},
      });
    });
  });

  describe('#creteSparqlAskQuery', (): void => {
    it('creates a sparql ask query.', (): void => {
      expect(
        creteSparqlAskQuery([]),
      ).toEqual({
        type: 'query',
        queryType: 'ASK',
        where: [],
        prefixes: {},
      });
    });
  });

  describe('#createSparqlSelectGroup', (): void => {
    it('creates a sparql select group.', (): void => {
      expect(
        createSparqlSelectGroup([]),
      ).toEqual({
        type: 'group',
        patterns: [],
      });
    });
  });

  describe('#createSparqlOptional', (): void => {
    it('creates a sparql optional expression.', (): void => {
      expect(
        createSparqlOptional([]),
      ).toEqual({
        type: 'optional',
        patterns: [],
      });
    });
  });

  describe('#createSparqlBasicGraphPattern', (): void => {
    it('creates a sparql basic graph pattern.', (): void => {
      expect(
        createSparqlBasicGraphPattern([]),
      ).toEqual({
        type: 'bgp',
        triples: [],
      });
    });
  });

  describe('#createSparqlOptionalGraphSelection', (): void => {
    it('creates a sparql optional graph pattern.', (): void => {
      const node = DataFactory.variable('node');
      expect(
        createSparqlOptionalGraphSelection(node, []),
      ).toEqual({
        type: 'graph',
        name: node,
        patterns: [{
          type: 'optional',
          patterns: [
            {
              type: 'bgp',
              triples: [],
            },
          ],
        }],
      });
    });
  });

  describe('#createSparqlServicePattern', (): void => {
    it('creates a sparql service pattern.', (): void => {
      expect(
        createSparqlServicePattern('service', []),
      ).toEqual({
        type: 'service',
        patterns: [
          {
            type: 'bgp',
            triples: [],
          },
        ],
        name: DataFactory.namedNode('service'),
        silent: false,
      });
    });
  });

  describe('#createSparqlSelectQuery', (): void => {
    it('creates a sparql select query.', (): void => {
      const node = DataFactory.variable('node');
      expect(
        createSparqlSelectQuery(node, [], []),
      ).toEqual({
        type: 'query',
        queryType: 'SELECT',
        variables: [ node ],
        distinct: true,
        where: [],
        order: undefined,
        limit: undefined,
        offset: undefined,
        prefixes: {},
      });
    });

    it('creates a sparql select query with orderings.', (): void => {
      const node = DataFactory.variable('node');
      const order = { expression: node, descending: true };
      expect(
        createSparqlSelectQuery(node, [], [ order ]),
      ).toEqual({
        type: 'query',
        queryType: 'SELECT',
        variables: [ node ],
        distinct: true,
        where: [],
        order: [ order ],
        limit: undefined,
        offset: undefined,
        prefixes: {},
      });
    });
  });

  describe('#createSparqlFilterWithExpression', (): void => {
    it('creates a sparql filter.', (): void => {
      expect(
        createSparqlFilterWithExpression({ type: 'bgp', triples: []}),
      ).toEqual({
        type: 'filter',
        expression: { type: 'bgp', triples: []},
      });
    });
  });

  describe('#createFilterPatternFromFilters', (): void => {
    it('creates a sparql filter pattern if there is only one filter.', (): void => {
      expect(
        createFilterPatternFromFilters([{ type: 'bgp', triples: []}]),
      ).toEqual({
        type: 'filter',
        expression: { type: 'bgp', triples: []},
      });
    });

    it('creates a sparql and pattern if there is more than one filter.', (): void => {
      expect(
        createFilterPatternFromFilters([
          { type: 'bgp', triples: []},
          { type: 'bgp', triples: []},
        ]),
      ).toEqual({
        type: 'filter',
        expression: {
          type: 'operation',
          operator: '&&',
          args: [
            { type: 'bgp', triples: []},
            { type: 'bgp', triples: []},
          ],
        },
      });
    });
  });

  describe('#createSparqlEqualOperation', (): void => {
    it('creates a sparql equal operation.', (): void => {
      expect(
        createSparqlEqualOperation(
          { type: 'bgp', triples: []},
          { type: 'bgp', triples: []},
        ),
      ).toEqual({
        type: 'operation',
        operator: '=',
        args: [
          { type: 'bgp', triples: []},
          { type: 'bgp', triples: []},
        ],
      });
    });
  });

  describe('#createSparqlGtOperation', (): void => {
    it('creates a sparql greater than operation.', (): void => {
      expect(
        createSparqlGtOperation(
          { type: 'bgp', triples: []},
          { type: 'bgp', triples: []},
        ),
      ).toEqual({
        type: 'operation',
        operator: '>',
        args: [
          { type: 'bgp', triples: []},
          { type: 'bgp', triples: []},
        ],
      });
    });
  });

  describe('#createSparqlGteOperation', (): void => {
    it('creates a sparql greater than or equal operation.', (): void => {
      expect(
        createSparqlGteOperation(
          { type: 'bgp', triples: []},
          { type: 'bgp', triples: []},
        ),
      ).toEqual({
        type: 'operation',
        operator: '>=',
        args: [
          { type: 'bgp', triples: []},
          { type: 'bgp', triples: []},
        ],
      });
    });
  });

  describe('#createSparqlLtOperation', (): void => {
    it('creates a sparql less than operation.', (): void => {
      expect(
        createSparqlLtOperation(
          { type: 'bgp', triples: []},
          { type: 'bgp', triples: []},
        ),
      ).toEqual({
        type: 'operation',
        operator: '<',
        args: [
          { type: 'bgp', triples: []},
          { type: 'bgp', triples: []},
        ],
      });
    });
  });

  describe('#createSparqlLteOperation', (): void => {
    it('creates a sparql less than or equal operation.', (): void => {
      expect(
        createSparqlLteOperation(
          { type: 'bgp', triples: []},
          { type: 'bgp', triples: []},
        ),
      ).toEqual({
        type: 'operation',
        operator: '<=',
        args: [
          { type: 'bgp', triples: []},
          { type: 'bgp', triples: []},
        ],
      });
    });
  });

  describe('#createSparqlNotEqualOperation', (): void => {
    it('creates a sparql not equal operation.', (): void => {
      expect(
        createSparqlNotEqualOperation(
          { type: 'bgp', triples: []},
          { type: 'bgp', triples: []},
        ),
      ).toEqual({
        type: 'operation',
        operator: '!=',
        args: [
          { type: 'bgp', triples: []},
          { type: 'bgp', triples: []},
        ],
      });
    });
  });

  describe('#createSparqlInOperation', (): void => {
    it('creates a sparql in operation.', (): void => {
      expect(
        createSparqlInOperation(
          { type: 'bgp', triples: []},
          { type: 'bgp', triples: []},
        ),
      ).toEqual({
        type: 'operation',
        operator: 'in',
        args: [
          { type: 'bgp', triples: []},
          { type: 'bgp', triples: []},
        ],
      });
    });
  });

  describe('#createSparqlNotInOperation', (): void => {
    it('creates a sparql not in operation.', (): void => {
      expect(
        createSparqlNotInOperation(
          { type: 'bgp', triples: []},
          { type: 'bgp', triples: []},
        ),
      ).toEqual({
        type: 'operation',
        operator: 'notin',
        args: [
          { type: 'bgp', triples: []},
          { type: 'bgp', triples: []},
        ],
      });
    });
  });

  describe('#createSparqlNotExistsOperation', (): void => {
    it('creates a sparql equal operation.', (): void => {
      expect(
        createSparqlNotExistsOperation([
          { type: 'bgp', triples: []},
        ]),
      ).toEqual({
        type: 'operation',
        operator: 'notexists',
        args: [
          { type: 'bgp', triples: []},
        ],
      });
    });
  });

  describe('#createSparqlInversePredicate', (): void => {
    it('creates a sparql inverse predicate.', (): void => {
      const node = DataFactory.namedNode('node');
      expect(
        createSparqlInversePredicate([ node ]),
      ).toEqual({
        type: 'path',
        pathType: '^',
        items: [ node ],
      });
    });
  });

  describe('#createSparqlOrPredicate', (): void => {
    it('creates a sparql or predicate.', (): void => {
      const node = DataFactory.namedNode('node');
      expect(
        createSparqlOrPredicate([ node ]),
      ).toEqual({
        type: 'path',
        pathType: '|',
        items: [ node ],
      });
    });
  });

  describe('#createSparqlPathPredicate', (): void => {
    it('creates a sparql or predicate.', (): void => {
      const node = DataFactory.namedNode('node');
      expect(
        createSparqlPathPredicate([ node ]),
      ).toEqual({
        type: 'path',
        pathType: '/',
        items: [ node ],
      });
    });
  });

  describe('#selectQueryResultsAsJSValues', (): void => {
    it('returns the results with javascript typed values.', (): void => {
      expect(
        selectQueryResultsAsJSValues([
          { string: DataFactory.literal('1', XSD.integer) },
          { string: DataFactory.namedNode(XSD.integer) },
        ]),
      ).toEqual([
        { string: 1 },
        { string: XSD.integer },
      ]);
    });
  });

  describe('#groupSelectQueryResultsByKey', (): void => {
    it('returns named nodes and literals grouped by key.', (): void => {
      expect(
        groupSelectQueryResultsByKey([
          { string: DataFactory.literal('1', XSD.integer) },
          { string: DataFactory.namedNode(XSD.integer) },
        ]),
      ).toEqual({
        string: [
          DataFactory.literal('1', XSD.integer),
          DataFactory.namedNode(XSD.integer),
        ],
      });
    });
  });

  describe('#getEntityVariableValuesFromVariables', (): void => {
    it('returns an empty array if the variables does not include the entity variable.', (): void => {
      expect(
        getEntityVariableValuesFromVariables({}),
      ).toEqual([]);
    });
    it('returns an array of uri values for every named node in the entity variable.', (): void => {
      expect(
        getEntityVariableValuesFromVariables({
          entity: [
            DataFactory.namedNode(XSD.integer),
            DataFactory.namedNode(XSD.boolean),
          ],
        }),
      ).toEqual([
        XSD.integer,
        XSD.boolean,
      ]);
    });
  });

  describe('#createValuesPatternsForVariables', (): void => {
    it('builds an and expression between multiple in expressions.', (): void => {
      expect(createValuesPatternsForVariables({
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
});
