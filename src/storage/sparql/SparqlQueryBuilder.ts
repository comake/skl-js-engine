import DataFactory from '@rdfjs/data-model';
import type { Variable } from '@rdfjs/types';
import type {
  SelectQuery,
  FilterPattern,
  Pattern,
  IriTerm,
  ConstructQuery,
  Triple,
  Expression,
  OperationExpression,
} from 'sparqljs';
import {
  allTypesAndSuperTypesPath,
  entityVariable,
  valueToLiteral,
  subjectNode,
  predicateNode,
  objectNode,
} from '../../util/TripleUtil';
import { isUrl } from '../../util/Util';
import type { FindAllOptions, FindOptionsWhere } from '../QueryAdapter';
import { VariableGenerator } from './VariableGenerator';

export interface WhereQueryData {
  triples: Triple[];
  filters: Expression[];
}

export class SparqlQueryBuilder {
  private readonly variableGenerator: VariableGenerator;

  public constructor() {
    this.variableGenerator = new VariableGenerator();
  }

  public buildQuery(options?: FindAllOptions): ConstructQuery {
    const graphQuery = {
      type: 'query',
      queryType: 'SELECT',
      variables: [ entityVariable ],
      where: this.buildPatternsFromQueryData(options?.where),
    } as unknown as SelectQuery;
    if (options?.limit) {
      graphQuery.limit = options.limit;
    }
    if (options?.offset) {
      graphQuery.offset = options.offset;
    }

    return this.buildEntityDataQuery(graphQuery);
  }

  private buildPatternsFromQueryData(where?: FindOptionsWhere): Pattern[] {
    const queryData = this.createWhereQueryData(entityVariable, where);
    const patterns: Pattern[] = [{ type: 'bgp', triples: queryData.triples }];
    if (queryData.filters.length === 1) {
      patterns.push({
        type: 'filter',
        expression: queryData.filters[0],
      } as FilterPattern);
    } else if (queryData.filters.length > 1) {
      patterns.push({
        type: 'filter',
        expression: {
          type: 'operation',
          operator: '&&',
          args: queryData.filters,
        },
      } as FilterPattern);
    }
    return patterns;
  }

  private buildEntityDataQuery(graphSelectionQuery: SelectQuery): ConstructQuery {
    return {
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
          patterns: [ graphSelectionQuery ],
        },
      ],
    } as unknown as ConstructQuery;
  }

  private createWhereQueryData(
    parentVariable: Variable,
    where?: FindOptionsWhere,
  ): WhereQueryData {
    if (!where) {
      return {
        triples: [{
          subject: DataFactory.variable(this.variableGenerator.getNext()),
          predicate: DataFactory.variable(this.variableGenerator.getNext()),
          object: DataFactory.variable(this.variableGenerator.getNext()),
        }],
        filters: [],
      };
    }
    let triples: Triple[] = [];
    let filters: Expression[] = [];
    const hasSingleKey = Object.keys(where).length === 1;
    for (const [ key, value ] of Object.entries(where)) {
      const graphQueryData = this.createWhereQueryDataFromKeyValue(key, value!, parentVariable, hasSingleKey);
      triples = [ ...triples, ...graphQueryData.triples ];
      filters = [ ...filters, ...graphQueryData.filters ];
    }

    return { triples, filters };
  }

  private createWhereQueryDataFromKeyValue(
    key: string,
    value: boolean | number | string | FindOptionsWhere,
    parentVariable: Variable,
    isOnlyKey: boolean,
  ): WhereQueryData {
    if (key === 'id') {
      return this.createWhereQueryDataForIdValue(parentVariable, value as string, isOnlyKey);
    }
    if (key === 'type') {
      return this.createWhereQueryDataForType(parentVariable, value as string);
    }
    if (typeof value === 'object') {
      return this.createWhereQueryDataForNestedWhere(key, value, parentVariable);
    }
    if (isUrl(value)) {
      return this.createWhereQueryDataForNamedNode(key, value as string, parentVariable);
    }
    return this.createWhereQueryDataForLiteral(key, value, parentVariable);
  }

  private createWhereQueryDataForIdValue(
    term: Variable | IriTerm,
    value: string,
    qualifyWithTriple: boolean,
  ): WhereQueryData {
    const queryData = {
      filters: [ this.buildEqualOperation(term as Expression, DataFactory.namedNode(value)) ],
      triples: [],
    } as WhereQueryData;
    if (qualifyWithTriple) {
      queryData.triples.push({
        subject: term,
        predicate: DataFactory.variable(this.variableGenerator.getNext()),
        object: DataFactory.variable(this.variableGenerator.getNext()),
      });
    }
    return queryData;
  }

  private createWhereQueryDataForType(subject: Variable | IriTerm, value: string): WhereQueryData {
    return {
      filters: [],
      triples: [ this.buildTypesAndSuperTypesTriple(subject, DataFactory.namedNode(value)) ],
    };
  }

  private createWhereQueryDataForNestedWhere(
    key: string,
    where: FindOptionsWhere,
    parentVariable: Variable,
  ): WhereQueryData {
    const subNodeVariable = DataFactory.variable(this.variableGenerator.getNext());
    const subWhereQueryData = this.createWhereQueryData(subNodeVariable, where);
    return {
      filters: subWhereQueryData.filters,
      triples: [
        {
          subject: parentVariable,
          predicate: DataFactory.namedNode(key),
          object: subNodeVariable,
        },
        ...subWhereQueryData.triples,
      ],
    };
  }

  private createWhereQueryDataForNamedNode(
    key: string,
    value: string,
    parentVariable: Variable,
  ): WhereQueryData {
    return {
      filters: [],
      triples: [{
        subject: parentVariable,
        predicate: DataFactory.namedNode(key),
        object: DataFactory.namedNode(value),
      }],
    };
  }

  private createWhereQueryDataForLiteral(
    key: string,
    value: string | number | boolean,
    parentVariable: Variable,
  ): WhereQueryData {
    return {
      filters: [],
      triples: [{
        subject: parentVariable,
        predicate: DataFactory.namedNode(key),
        object: valueToLiteral(value),
      }],
    };
  }

  private buildEqualOperation(leftSide: Expression, rightSide: Expression): OperationExpression {
    return {
      type: 'operation',
      operator: '=',
      args: [ leftSide, rightSide ],
    };
  }

  private buildTypesAndSuperTypesTriple(subject: IriTerm | Variable, object: IriTerm | Variable): Triple {
    return {
      subject,
      predicate: allTypesAndSuperTypesPath,
      object,
    };
  }
}
