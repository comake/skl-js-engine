/* eslint-disable capitalized-comments */
import DataFactory from '@rdfjs/data-model';
import type { Variable, NamedNode, Term, Literal } from '@rdfjs/types';
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
import type { OrArray } from '../../util/Types';
import { isUrl } from '../../util/Util';
import { FindOperator } from '../FindOperator';
import type {
  FieldPrimitiveValue,
  FindAllOptions,
  FindOptionsWhere,
  FindOptionsWhereField,
  IdOrTypeFindOptionsWhereField,
} from '../FindOptionsTypes';
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
    if (where.id) {
      const idFieldWhereQueryData = this.createWhereQueryDataForIdValue(parentVariable, where.id, hasSingleKey);
      triples = [ ...triples, ...idFieldWhereQueryData.triples ];
      filters = [ ...filters, ...idFieldWhereQueryData.filters ];
    }
    if (where.type) {
      const typeFieldWhereQueryData = this.createWhereQueryDataForType(parentVariable, where.type);
      triples = [ ...triples, ...typeFieldWhereQueryData.triples ];
      filters = [ ...filters, ...typeFieldWhereQueryData.filters ];
    }
    for (const [ key, value ] of Object.entries(where)) {
      if (key !== 'id' && key !== 'type') {
        const graphQueryData = this.createWhereQueryDataFromKeyValue(key, value!, parentVariable);
        triples = [ ...triples, ...graphQueryData.triples ];
        filters = [ ...filters, ...graphQueryData.filters ];
      }
    }

    return { triples, filters };
  }

  private createWhereQueryDataFromKeyValue(
    key: string,
    value: FindOptionsWhereField,
    parentVariable: Variable,
  ): WhereQueryData {
    if (FindOperator.isFindOperator(value)) {
      return this.createWhereQueryDataForFindOperator(key, value as FindOperator<any>, parentVariable);
    }
    if (typeof value === 'object') {
      return this.createWhereQueryDataForNestedWhere(key, value as FindOptionsWhere, parentVariable);
    }
    return {
      filters: [],
      triples: [{
        subject: parentVariable,
        predicate: DataFactory.namedNode(key),
        object: this.resolveValueToTerm(value),
      }],
    };
  }

  private createWhereQueryDataForIdValue(
    term: Variable | IriTerm,
    value: IdOrTypeFindOptionsWhereField,
    qualifyWithTriple: boolean,
  ): WhereQueryData {
    let filter: OperationExpression;
    if (FindOperator.isFindOperator(value)) {
      filter = this.resolveFindOperatorAsExpression(term as Expression, value as FindOperator<string>);
    } else {
      filter = this.buildEqualOperation(term as Expression, DataFactory.namedNode(value as string));
    }
    const queryData = {
      filters: [ filter ],
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

  private createWhereQueryDataForType(
    subject: Variable | IriTerm,
    value: IdOrTypeFindOptionsWhereField,
  ): WhereQueryData {
    if (FindOperator.isFindOperator(value)) {
      const variable = DataFactory.variable(this.variableGenerator.getNext());
      const operatorFilter = this.resolveFindOperatorAsExpression(
        variable as Expression,
        value as FindOperator<string>,
      );
      return {
        filters: [ operatorFilter ],
        triples: [ this.buildTypesAndSuperTypesTriple(subject, variable) ],
      };
    }
    return {
      filters: [],
      triples: [ this.buildTypesAndSuperTypesTriple(subject, DataFactory.namedNode(value as string)) ],
    };
  }

  private createWhereQueryDataForFindOperator(
    key: string,
    operator: FindOperator<any>,
    parentVariable: Variable,
  ): WhereQueryData {
    const variable = DataFactory.variable(this.variableGenerator.getNext());
    return {
      filters: [ this.resolveFindOperatorAsExpression(variable, operator) ],
      triples: [{
        subject: parentVariable,
        predicate: DataFactory.namedNode(key),
        object: variable,
      }],
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

  private resolveFindOperatorAsExpression(
    leftSide: Expression,
    operator: FindOperator<any>,
  ): OperationExpression {
    switch (operator.operator) {
      case 'in':
        return this.buildInOperation(
          leftSide,
          this.resolveValueToExpression(operator.value) as Expression,
        );
      default:
        throw new Error(`Unsupported operator "${operator.operator}"`);
    }
  }

  private resolveValueToExpression(
    value: OrArray<any> | FindOperator<any>,
  ): OperationExpression | OrArray<Term> {
    // if (FindOperator.isFindOperator(value)) {
    //   return this.resolveValueToExpression((value as FindOperator<string>).value);
    // }
    // if (Array.isArray(value)) {
    return (value as any[]).map((valueItem): Term => this.resolveValueToTerm(valueItem));
    // }
    // return this.resolveValueToTerm(value as FieldPrimitiveValue);
  }

  private buildInOperation(leftSide: Expression, rightSide: Expression): OperationExpression {
    return {
      type: 'operation',
      operator: 'IN',
      args: [ leftSide, rightSide ],
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

  private resolveValueToTerm(value: FieldPrimitiveValue): NamedNode | Literal {
    if (isUrl(value)) {
      return DataFactory.namedNode(value as string);
    }
    return valueToLiteral(value);
  }
}
