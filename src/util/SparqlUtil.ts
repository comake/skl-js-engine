import DataFactory from '@rdfjs/data-model';
import type { Literal, NamedNode } from '@rdfjs/types';
import type {
  SelectQuery,
  Pattern,
  Variable,
  GraphPattern,
  AggregateExpression,
  Triple,
  AskQuery,
  GroupPattern,
  Ordering,
  BgpPattern,
  IriTerm,
  Expression,
  FilterPattern,
  OptionalPattern,
  ServicePattern,
  OperationExpression,
  ValuesPattern,
  ValuePatternRow,
  PropertyPath,
  ConstructQuery,
  UpdateOperation,
  Update,
  BindPattern,
  ClearDropOperation,
  GraphQuads,
  InsertDeleteOperation,
} from 'sparqljs';
import type { RawQueryResult } from '../storage/QueryAdapter';
import type { SelectVariableQueryResult } from '../storage/sparql/SparqlQueryExecutor';
import { toJSValueFromDataType } from './TripleUtil';
import { BDS, DCTERMS, RDF, RDFS } from './Vocabularies';

export const rdfTypeNamedNode = DataFactory.namedNode(RDF.type);
export const rdfsSubClassOfNamedNode = DataFactory.namedNode(RDFS.subClassOf);
export const subjectNode = DataFactory.variable('subject');
export const predicateNode = DataFactory.variable('predicate');
export const objectNode = DataFactory.variable('object');
export const entityVariable = DataFactory.variable('entity');
export const countVariable = DataFactory.variable('count');
export const now = DataFactory.variable('now');
export const created = DataFactory.namedNode(DCTERMS.created);
export const modified = DataFactory.namedNode(DCTERMS.modified);
export const searchPredicate = DataFactory.namedNode(BDS.search);
export const anyPredicatePropertyPath = {
  type: 'path',
  pathType: '!',
  items: [ DataFactory.namedNode('') ],
} as PropertyPath;

export const allTypesAndSuperTypesPath: PropertyPath = {
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
};

export const bindNow: BindPattern = {
  type: 'bind',
  variable: now,
  expression: {
    type: 'operation',
    operator: 'now',
    args: [],
  },
};

export const dropAll: ClearDropOperation = {
  type: 'drop',
  silent: true,
  graph: {
    type: 'graph',
    all: true,
  },
};

export const entityGraphTriple = { subject: subjectNode, predicate: predicateNode, object: objectNode };

export function createSparqlGraphQuads(graph: NamedNode, triples: Triple[]): GraphQuads {
  return {
    type: 'graph',
    name: graph,
    triples,
  };
}

export function createSparqlClearUpdate(graph: NamedNode): ClearDropOperation {
  return {
    type: 'clear',
    silent: true,
    graph: {
      type: 'graph',
      name: graph,
    },
  };
}

export function createSparqlDropUpdate(graph: NamedNode): ClearDropOperation {
  return {
    type: 'drop',
    silent: true,
    graph: {
      type: 'graph',
      name: graph,
    },
  };
}

export function createSparqlUpdate(updates: UpdateOperation[]): Update {
  return {
    type: 'update',
    prefixes: {},
    updates,
  };
}

export function createSparqlGraphPattern(name: Variable | NamedNode, patterns: Pattern[]): GraphPattern {
  return {
    type: 'graph',
    name,
    patterns,
  } as GraphPattern;
}

export function createSparqlConstructQuery(triples: Triple[], where: Pattern[]): ConstructQuery {
  return {
    type: 'query',
    prefixes: {},
    queryType: 'CONSTRUCT',
    template: triples,
    where,
  };
}

export function createSparqlCountSelectQuery(
  subject: Variable,
  where: Pattern[],
  order: Ordering[],
  offset?: number,
): SelectQuery {
  return {
    type: 'query',
    queryType: 'SELECT',
    variables: [{
      expression: {
        type: 'aggregate',
        aggregation: 'count',
        distinct: true,
        expression: subject,
      } as AggregateExpression,
      variable: countVariable,
    }],
    where: [
      ...where,
      createSparqlGraphPattern(subject, [{
        type: 'bgp',
        triples: [
          {
            subject,
            predicate: predicateNode,
            object: objectNode,
          } as Triple,
        ],
      }]),
    ],
    order: order.length > 0 ? order : undefined,
    offset,
    prefixes: {},
  };
}

export function creteSparqlAskQuery(where: Pattern[]): AskQuery {
  return {
    type: 'query',
    queryType: 'ASK',
    where,
    prefixes: {},
  };
}

export function createSparqlSelectGroup(patterns: Pattern[]): GroupPattern {
  return {
    type: 'group',
    patterns,
  };
}

export function createSparqlOptional(patterns: Pattern[]): OptionalPattern {
  return {
    type: 'optional',
    patterns,
  };
}

export function createSparqlBasicGraphPattern(triples: Triple[]): BgpPattern {
  return { type: 'bgp', triples };
}

export function createSparqlOptionalGraphSelection(name: Variable | NamedNode, triples: Triple[]): GraphPattern {
  return {
    type: 'graph',
    name: name as IriTerm,
    patterns: [
      createSparqlOptional([
        createSparqlBasicGraphPattern(triples),
      ]),
    ],
  };
}

export function createSparqlServicePattern(serviceName: string, triples: Triple[]): ServicePattern {
  return {
    type: 'service',
    patterns: [ createSparqlBasicGraphPattern(triples) ],
    name: DataFactory.namedNode(serviceName),
    silent: false,
  };
}

export function createSparqlSelectQuery(
  variable: Variable,
  where: Pattern[],
  order: Ordering[],
  limit?: number,
  offset?: number,
): SelectQuery {
  return {
    type: 'query',
    queryType: 'SELECT',
    variables: [ variable ],
    distinct: true,
    where,
    order: order.length > 0 ? order : undefined,
    limit,
    offset,
    prefixes: {},
  };
}

export function createSparqlFilterWithExpression(expression: Expression): FilterPattern {
  return { type: 'filter', expression };
}

export function createFilterPatternFromFilters(filters: Expression[]): FilterPattern {
  if (filters.length > 1) {
    return createSparqlFilterWithExpression({
      type: 'operation',
      operator: '&&',
      args: filters,
    });
  }
  return createSparqlFilterWithExpression(filters[0]);
}

export function createSparqlEqualOperation(leftSide: Expression, rightSide: Expression): OperationExpression {
  return {
    type: 'operation',
    operator: '=',
    args: [ leftSide, rightSide ],
  };
}

export function createSparqlGtOperation(leftSide: Expression, rightSide: Expression): OperationExpression {
  return {
    type: 'operation',
    operator: '>',
    args: [ leftSide, rightSide ],
  };
}

export function createSparqlGteOperation(leftSide: Expression, rightSide: Expression): OperationExpression {
  return {
    type: 'operation',
    operator: '>=',
    args: [ leftSide, rightSide ],
  };
}

export function createSparqlLtOperation(leftSide: Expression, rightSide: Expression): OperationExpression {
  return {
    type: 'operation',
    operator: '<',
    args: [ leftSide, rightSide ],
  };
}

export function createSparqlLteOperation(leftSide: Expression, rightSide: Expression): OperationExpression {
  return {
    type: 'operation',
    operator: '<=',
    args: [ leftSide, rightSide ],
  };
}

export function createSparqlNotEqualOperation(leftSide: Expression, rightSide: Expression): OperationExpression {
  return {
    type: 'operation',
    operator: '!=',
    args: [ leftSide, rightSide ],
  };
}

export function createSparqlInOperation(leftSide: Expression, rightSide: Expression): OperationExpression {
  return {
    type: 'operation',
    operator: 'in',
    args: [ leftSide, rightSide ],
  };
}

export function createSparqlNotInOperation(leftSide: Expression, rightSide: Expression): OperationExpression {
  return {
    type: 'operation',
    operator: 'notin',
    args: [ leftSide, rightSide ],
  };
}

export function createSparqlNotExistsOperation(args: Expression[]): OperationExpression {
  return {
    type: 'operation',
    operator: 'notexists',
    args,
  };
}

export function createSparqlInversePredicate(predicates: (IriTerm | PropertyPath)[]): PropertyPath {
  return {
    type: 'path',
    pathType: '^',
    items: predicates,
  };
}

export function createSparqlOrPredicate(predicates: (IriTerm | PropertyPath)[]): PropertyPath {
  return {
    type: 'path',
    pathType: '|',
    items: predicates,
  };
}

export function createSparqlPathPredicate(predicates: (IriTerm | PropertyPath)[]): PropertyPath {
  return {
    type: 'path',
    pathType: '/',
    items: predicates,
  };
}

export function createSparqlInsertDeleteOperation(
  graph: NamedNode,
  insertionTriples: Triple[],
  deletionTriples: Triple[],
): InsertDeleteOperation {
  return {
    updateType: 'insertdelete',
    delete: [ createSparqlGraphQuads(graph, deletionTriples) ],
    insert: [ createSparqlGraphQuads(graph, insertionTriples) ],
    where: [ createSparqlBasicGraphPattern(deletionTriples) ],
    using: {
      default: [ graph ],
    },
  } as InsertDeleteOperation;
}

export function selectQueryResultsAsJSValues<T extends RawQueryResult>(
  results: SelectVariableQueryResult<T>[],
): T[] {
  return results
    .map((result): T =>
      Object.entries(result).reduce((obj, [ key, value ]): T => ({
        ...obj,
        [key]: value.termType === 'Literal'
          ? toJSValueFromDataType(value.value, value.datatype?.value)
          : value.value,
      // eslint-disable-next-line @typescript-eslint/prefer-reduce-type-parameter
      }), {} as T));
}

export function groupSelectQueryResultsByKey(
  results: SelectVariableQueryResult<any>[],
): Record<string, (NamedNode | Literal)[]> {
  return results
    .reduce((obj: Record<string, (NamedNode | Literal)[]>, result): Record<string, (NamedNode | Literal)[]> => {
      for (const [ key, value ] of Object.entries(result)) {
        if (!(key in obj)) {
          obj[key] = [ value ];
        } else {
          obj[key].push(value);
        }
      }
      return obj;
    }, {});
}

export function getEntityVariableValuesFromVariables(
  variables: Record<string, (Literal | NamedNode)[]>,
): string[] {
  if (!(entityVariable.value in variables)) {
    return [];
  }
  return (variables[entityVariable.value] as NamedNode[])
    .map((namedNode: NamedNode): string => namedNode.value);
}

export function createValuesPatternsForVariables(
  valuesByVariable: Record<string, (NamedNode | Literal)[]>,
): ValuesPattern[] {
  return Object.entries(valuesByVariable)
    .map(([ variableName, values ]): ValuesPattern => ({
      type: 'values',
      values: values.map((value): ValuePatternRow => ({
        [`?${variableName}`]: value,
      })),
    }));
}
