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
  GroupPattern,
  GraphPattern,
  Ordering,
  AskQuery,
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
  FindOptionsOrder,
  FindOptionsOrderValue,
  FindOptionsSelect,
  FindOptionsWhere,
  FindOptionsWhereField,
  IdOrTypeFindOptionsWhereField,
} from '../FindOptionsTypes';
import { VariableGenerator } from './VariableGenerator';

export interface WhereQueryData {
  filters: Expression[];
  triples: Triple[];
}

export interface OrderQueryData {
  optionalTriples: Triple[];
  orders: Ordering[];
}

export type QueryData = WhereQueryData & OrderQueryData;

export interface SelectQueryData {
  where: Pattern[];
  orders: Ordering[];
}

export class SparqlQueryBuilder {
  private readonly variableGenerator: VariableGenerator;

  public constructor() {
    this.variableGenerator = new VariableGenerator();
  }

  public buildEntityExistQuery(where: FindOptionsWhere): AskQuery {
    const selectQueryData = this.buildPatternsFromQueryData(where);
    return this.sparqlAsk(selectQueryData.where);
  }

  private sparqlAsk(where: Pattern[]): AskQuery {
    return {
      type: 'query',
      queryType: 'ASK',
      where,
      prefixes: {},
    };
  }

  public buildEntityQuery(options?: FindAllOptions): ConstructQuery {
    const selectQueryData = this.buildPatternsFromQueryData(options?.where, options?.order);
    const entitySelectQuery = this.sparqlSelect(
      [ entityVariable ],
      selectQueryData.where,
      selectQueryData.orders,
      options?.limit,
      options?.offset,
    );
    return this.sparqlConstruct(entitySelectQuery, options?.select);
  }

  private sparqlSelect(
    variables: Variable[],
    where: Pattern[],
    order: Ordering[],
    limit?: number,
    offset?: number,
  ): SelectQuery {
    return {
      type: 'query',
      queryType: 'SELECT',
      variables,
      where,
      order: order.length > 0 ? order : undefined,
      limit,
      offset,
      prefixes: {},
    };
  }

  private buildPatternsFromQueryData(where?: FindOptionsWhere, order?: FindOptionsOrder): SelectQueryData {
    const queryData = this.createQueryData(entityVariable, where, order);
    const patterns: Pattern[] = [];
    if (queryData.triples.length > 0) {
      patterns.push({
        type: 'bgp',
        triples: queryData.triples,
      });
    }
    if (queryData.optionalTriples.length > 0) {
      patterns.push({
        type: 'optional',
        patterns: [{
          type: 'bgp',
          triples: queryData.optionalTriples,
        }],
      });
    }
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
    return {
      where: patterns,
      orders: queryData.orders,
    };
  }

  private sparqlConstruct(
    graphSelectionQuery: SelectQuery,
    select?: FindOptionsSelect,
  ): ConstructQuery {
    let pattern: Triple[];
    let graphSelect: GraphPattern;
    if (select) {
      pattern = this.createSelectPattern(select, entityVariable);
      graphSelect = this.sparqlOptionalSelectGraph(entityVariable, pattern);
    } else {
      pattern = [{ subject: subjectNode, predicate: predicateNode, object: objectNode }];
      graphSelect = this.sparqlSelectGraph(entityVariable, pattern);
    }
    return {
      type: 'query',
      prefixes: {},
      queryType: 'CONSTRUCT',
      template: pattern,
      where: [
        graphSelect,
        this.sparqlSelectGroup([ graphSelectionQuery ]),
      ],
    };
  }

  private createSelectPattern(select: FindOptionsSelect, parentVariable: Variable): Triple[] {
    if (Array.isArray(select)) {
      return select.map((selectPredicate): Triple => ({
        subject: parentVariable,
        predicate: DataFactory.namedNode(selectPredicate),
        object: DataFactory.variable(this.variableGenerator.getNext()),
      }));
    }
    return Object.entries(select).reduce((arr: Triple[], [ key, value ]): Triple[] => {
      const variable = DataFactory.variable(this.variableGenerator.getNext());
      arr.push({ subject: parentVariable, predicate: DataFactory.namedNode(key), object: variable });
      if (typeof value === 'object') {
        arr = [ ...arr, ...this.createSelectPattern(value, variable) ];
      }
      return arr;
    }, []);
  }

  private sparqlSelectGraph(name: Variable | NamedNode, triples: Triple[]): GraphPattern {
    return {
      type: 'graph',
      name: name as IriTerm,
      patterns: [{ type: 'bgp', triples }],
    };
  }

  private sparqlOptionalSelectGraph(name: Variable | NamedNode, triples: Triple[]): GraphPattern {
    return {
      type: 'graph',
      name: name as IriTerm,
      patterns: [{
        type: 'optional',
        patterns: [{
          type: 'bgp',
          triples,
        }],
      }],
    };
  }

  private sparqlSelectGroup(patterns: Pattern[]): GroupPattern {
    return {
      type: 'group',
      patterns,
    };
  }

  private createQueryData(
    parentVariable: Variable,
    where?: FindOptionsWhere,
    order?: FindOptionsOrder,
  ): QueryData {
    const whereQueryData = this.createWhereQueryData(parentVariable, where);
    const orderQueryData = this.createOrderQueryData(parentVariable, order);
    return { ...whereQueryData, ...orderQueryData };
  }

  private createWhereQueryData(parentVariable: Variable, where?: FindOptionsWhere): WhereQueryData {
    if (!where) {
      return {
        triples: [{
          subject: parentVariable,
          predicate: DataFactory.variable(this.variableGenerator.getNext()),
          object: DataFactory.variable(this.variableGenerator.getNext()),
        }],
        filters: [],
      };
    }
    const hasSingleKey = Object.keys(where).length === 1;
    return Object.entries(where).reduce((obj: WhereQueryData, [ key, value ]): WhereQueryData => {
      const whereQueryData = this.createWhereQueryDataForField(key, value!, parentVariable, hasSingleKey);
      return {
        triples: [ ...obj.triples, ...whereQueryData.triples ],
        filters: [ ...obj.filters, ...whereQueryData.filters ],
      };
    }, { filters: [], triples: []});
  }

  private createWhereQueryDataForField(
    field: string,
    value: IdOrTypeFindOptionsWhereField | FindOptionsWhereField,
    parentVariable: Variable,
    isOnlyField: boolean,
  ): WhereQueryData {
    if (field === 'id') {
      return this.createWhereQueryDataForIdValue(parentVariable, value as IdOrTypeFindOptionsWhereField, isOnlyField);
    }
    if (field === 'type') {
      return this.createWhereQueryDataForType(parentVariable, value as IdOrTypeFindOptionsWhereField);
    }
    return this.createWhereQueryDataFromKeyValue(field, value, parentVariable);
  }

  private createWhereQueryDataFromKeyValue(
    key: string,
    value: FindOptionsWhereField,
    parentVariable: Variable,
  ): WhereQueryData {
    if (FindOperator.isFindOperator(value)) {
      return this.createWhereQueryDataForFindOperator(key, value as FindOperator<any>, parentVariable);
    }
    if (Array.isArray(value)) {
      return value.reduce((obj: WhereQueryData, valueItem): WhereQueryData => {
        const valueWhereQueryData = this.createWhereQueryDataFromKeyValue(key, valueItem, parentVariable);
        return {
          filters: [ ...obj.filters, ...valueWhereQueryData.filters ],
          triples: [ ...obj.triples, ...valueWhereQueryData.triples ],
        };
      }, { filters: [], triples: []});
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
      filter = this.resolveFindOperatorAsExpressionForId(term as Expression, value as FindOperator<string>);
    } else {
      filter = this.buildEqualOperation(term as Expression, DataFactory.namedNode(value as string));
    }
    const queryData = {
      filters: [ filter ],
      triples: [],
      optionalTriples: [],
      orders: [],
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
      const triple = this.buildTypesAndSuperTypesTriple(subject, variable);
      const operatorFilter = this.resolveFindOperatorAsExpressionWithMultipleValues(
        variable as Expression,
        value as FindOperator<string>,
        triple,
      );
      return {
        filters: [ operatorFilter ],
        triples: [ triple ],
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
    const triple = {
      subject: parentVariable,
      predicate: DataFactory.namedNode(key),
      object: variable,
    };
    return {
      filters: [ this.resolveFindOperatorAsExpressionWithMultipleValues(variable, operator, triple) ],
      triples: [ triple ],
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

  private resolveFindOperatorAsExpressionWithMultipleValues(
    leftSide: Expression,
    operator: FindOperator<any>,
    triple: Triple,
    parentOperator?: string,
  ): OperationExpression {
    switch (operator.operator) {
      case 'in':
        return this.buildInOperation(
          leftSide,
          this.resolveValueToExpression(operator.value) as Expression,
        );
      case 'not':
        return this.buildNotOperationForMultiValued(
          leftSide,
          this.resolveValueToExpression(operator.value) as Expression | FindOperator<any>,
          triple,
        );
      case 'equal':
        return this.buildEqualOperation(
          leftSide,
          this.resolveValueToExpression(operator.value) as Expression,
        );
      case 'gt':
        return this.buildGtOperation(
          leftSide,
          this.resolveValueToExpression(operator.value) as Expression,
        );
      case 'gte':
        return this.buildGteOperation(
          leftSide,
          this.resolveValueToExpression(operator.value) as Expression,
        );
      case 'lt':
        return this.buildLtOperation(
          leftSide,
          this.resolveValueToExpression(operator.value) as Expression,
        );
      case 'lte':
        return this.buildLteOperation(
          leftSide,
          this.resolveValueToExpression(operator.value) as Expression,
        );
      default:
        if (parentOperator) {
          throw new Error(`Unsupported ${parentOperator} sub operator "${operator.operator}"`);
        }
        throw new Error(`Unsupported operator "${operator.operator}"`);
    }
  }

  private resolveFindOperatorAsExpressionForId(
    leftSide: Expression,
    operator: FindOperator<any>,
  ): OperationExpression {
    switch (operator.operator) {
      case 'in':
        return this.buildInOperation(
          leftSide,
          this.resolveValueToExpression(operator.value) as Expression,
        );
      case 'not':
        return this.buildNotOperationForId(
          leftSide,
          this.resolveValueToExpression(operator.value) as Expression | FindOperator<any>,
        );
      case 'equal':
        return this.buildEqualOperation(
          leftSide,
          this.resolveValueToExpression(operator.value) as Expression,
        );
      default:
        throw new Error(`Unsupported operator "${operator.operator}"`);
    }
  }

  private resolveValueToExpression(
    value: OrArray<any> | FindOperator<any>,
  ): FindOperator<any> | OrArray<Term> {
    if (FindOperator.isFindOperator(value)) {
      return value;
    }
    if (Array.isArray(value)) {
      return value.map((valueItem): Term => this.resolveValueToTerm(valueItem));
    }
    return this.resolveValueToTerm(value as FieldPrimitiveValue);
  }

  private buildInOperation(leftSide: Expression, rightSide: Expression): OperationExpression {
    return {
      type: 'operation',
      operator: 'in',
      args: [ leftSide, rightSide ],
    };
  }

  private buildNotInOperation(leftSide: Expression, rightSide: Expression): OperationExpression {
    return {
      type: 'operation',
      operator: 'notin',
      args: [ leftSide, rightSide ],
    };
  }

  private buildNotOperationForMultiValued(
    leftSide: Expression,
    rightSide: Expression | FindOperator<any>,
    triple: Triple,
  ): OperationExpression {
    let filterExpression: FilterPattern;
    const rightSideIsOperation = typeof rightSide === 'object' && 'operator' in rightSide;
    if (rightSideIsOperation) {
      filterExpression = {
        type: 'filter',
        expression: this.resolveFindOperatorAsExpressionWithMultipleValues(
          leftSide,
          rightSide as FindOperator<any>,
          triple,
          'Not',
        ),
      };
    } else {
      filterExpression = {
        type: 'filter',
        expression: this.buildEqualOperation(leftSide, rightSide as Expression),
      };
    }
    return {
      type: 'operation',
      operator: 'notexists',
      args: [
        {
          type: 'group',
          patterns: [
            {
              type: 'bgp',
              triples: [ triple ],
            },
            filterExpression,
          ],
        } as GroupPattern,
      ],
    };
  }

  private buildNotOperationForId(
    leftSide: Expression,
    rightSide: Expression | FindOperator<any>,
  ): OperationExpression {
    if (FindOperator.isFindOperator(rightSide)) {
      switch ((rightSide as FindOperator<string>).operator) {
        case 'in':
          return this.buildNotInOperation(
            leftSide,
            this.resolveValueToExpression((rightSide as FindOperator<string>).value) as Expression,
          );
        case 'equal':
          return this.buildNotEqualOperation(
            leftSide,
            this.resolveValueToExpression((rightSide as FindOperator<string>).value) as Expression,
          );
        default:
          throw new Error(`Unsupported Not sub operator "${(rightSide as FindOperator<string>).operator}"`);
      }
    }
    return this.buildNotEqualOperation(leftSide, rightSide as Expression);
  }

  private buildEqualOperation(leftSide: Expression, rightSide: Expression): OperationExpression {
    return {
      type: 'operation',
      operator: '=',
      args: [ leftSide, rightSide ],
    };
  }

  private buildGtOperation(leftSide: Expression, rightSide: Expression): OperationExpression {
    return {
      type: 'operation',
      operator: '>',
      args: [ leftSide, rightSide ],
    };
  }

  private buildGteOperation(leftSide: Expression, rightSide: Expression): OperationExpression {
    return {
      type: 'operation',
      operator: '>=',
      args: [ leftSide, rightSide ],
    };
  }

  private buildLtOperation(leftSide: Expression, rightSide: Expression): OperationExpression {
    return {
      type: 'operation',
      operator: '<',
      args: [ leftSide, rightSide ],
    };
  }

  private buildLteOperation(leftSide: Expression, rightSide: Expression): OperationExpression {
    return {
      type: 'operation',
      operator: '<=',
      args: [ leftSide, rightSide ],
    };
  }

  private buildNotEqualOperation(leftSide: Expression, rightSide: Expression): OperationExpression {
    return {
      type: 'operation',
      operator: '!=',
      args: [ leftSide, rightSide ],
    };
  }

  private buildTypesAndSuperTypesTriple(subject: IriTerm | Variable, object: IriTerm | Variable): Triple {
    return { subject, predicate: allTypesAndSuperTypesPath, object };
  }

  private resolveValueToTerm(value: FieldPrimitiveValue): NamedNode | Literal {
    if (isUrl(value)) {
      return DataFactory.namedNode(value as string);
    }
    return valueToLiteral(value);
  }

  private createOrderQueryData(parentVariable: Variable, order?: FindOptionsOrder): OrderQueryData {
    if (!order) {
      return {
        optionalTriples: [],
        orders: [],
      };
    }
    return Object.entries(order).reduce((obj: OrderQueryData, [ property, direction ]): OrderQueryData => {
      const orderQueryData = this.createOrderQueryDataForProperty(property, direction, parentVariable);
      return {
        optionalTriples: [ ...obj.optionalTriples, orderQueryData.triple ],
        orders: [ ...obj.orders, orderQueryData.order ],
      };
    }, { optionalTriples: [], orders: []});
  }

  private createOrderQueryDataForProperty(
    property: string,
    direction: FindOptionsOrderValue,
    parentVariable: Variable,
  ): { triple: Triple; order: Ordering } {
    const variable = DataFactory.variable(this.variableGenerator.getNext());
    return {
      triple: {
        subject: parentVariable,
        predicate: DataFactory.namedNode(property),
        object: variable,
      },
      order: {
        expression: variable,
        descending: direction === 'DESC' || direction === 'desc',
      },
    };
  }
}
