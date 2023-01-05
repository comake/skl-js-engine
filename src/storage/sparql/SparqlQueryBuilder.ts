/* eslint-disable unicorn/expiring-todo-comments */
import DataFactory from '@rdfjs/data-model';
import type { Variable, NamedNode, Term, Literal } from '@rdfjs/types';
import type {
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
  OptionalPattern,
  BgpPattern,
  PropertyPath,
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
import { RDF } from '../../util/Vocabularies';
import { FindOperator } from '../FindOperator';
import type {
  FieldPrimitiveValue,
  FindOptionsOrder,
  FindOptionsOrderValue,
  FindOptionsRelations,
  FindOptionsSelect,
  FindOptionsWhere,
  FindOptionsWhereField,
  IdOrTypeFindOptionsWhereField,
  ValueObject,
} from '../FindOptionsTypes';
import { VariableGenerator } from './VariableGenerator';

export interface WhereQueryData {
  triples: Triple[];
  graphTriples: Triple[];
  filters: OperationExpression[];
  graphFilters: OperationExpression[];
}

export interface RelationsQueryData {
  variables: Variable[];
  triples: Triple[];
  graphTriples: Triple[];
}

export interface OrderQueryData {
  triples: Triple[];
  orders: Ordering[];
  variables: Variable[];
}

export type QueryData = {
  relationsVariables: Variable[];
  filters: OperationExpression[];
  triples: Triple[];
  optionalTriples: Triple[];
  orders: Ordering[];
  graphTriples: Triple[];
  optionalGraphTriples: Triple[];
  graphFilters: OperationExpression[];
};

export interface SelectQueryData {
  variables: Variable[];
  where: Pattern[];
  orders: Ordering[];
  graphWhere: Pattern[];
}

export class SparqlQueryBuilder {
  private readonly variableGenerator: VariableGenerator;

  public constructor() {
    this.variableGenerator = new VariableGenerator();
  }

  public buildInFilterForVariables(valuesByVariable: Record<string, (NamedNode | Literal)[]>): FilterPattern {
    return this.filterPatternFromFilters(
      Object.entries(valuesByVariable).map(([ variableName, values ]): OperationExpression =>
        this.buildInOperation(
          DataFactory.variable(variableName),
          values,
        )),
    );
  }

  private filterWithExpression(expression: Expression): FilterPattern {
    return { type: 'filter', expression };
  }

  public buildPatternsFromQueryOptions(
    subject: Variable,
    where?: FindOptionsWhere,
    order?: FindOptionsOrder,
    relations?: FindOptionsRelations,
  ): SelectQueryData {
    const queryData = this.createQueryData(subject, where, order, relations);
    const wherePatterns = this.createWherePatternsFromQueryData(
      queryData.triples,
      queryData.optionalTriples,
      queryData.filters,
    );
    const graphWherePatterns = this.createWherePatternsFromQueryData(
      queryData.graphTriples,
      queryData.optionalGraphTriples,
      queryData.graphFilters,
    );
    return {
      variables: queryData.relationsVariables,
      where: wherePatterns,
      orders: queryData.orders,
      graphWhere: graphWherePatterns,
    };
  }

  private createWherePatternsFromQueryData(
    triples: Triple[],
    optionalTriples: Triple[],
    filters: OperationExpression[],
  ): Pattern[] {
    const patterns: Pattern[] = [];
    if (triples.length > 0) {
      patterns.push(this.sparqlBasicGraphPattern(triples));
    }
    if (optionalTriples.length > 0) {
      patterns.push(this.sparqlOptionalWithTriples(optionalTriples));
    }
    if (filters.length > 0) {
      patterns.push(this.filterPatternFromFilters(filters));
    }
    return patterns;
  }

  private filterPatternFromFilters(filters: Expression[]): FilterPattern {
    if (filters.length > 1) {
      return this.filterWithExpression({
        type: 'operation',
        operator: '&&',
        args: filters,
      });
    }
    return this.filterWithExpression(filters[0]);
  }

  private sparqlOptionalWithTriples(triples: Triple[]): OptionalPattern {
    return {
      type: 'optional',
      patterns: [ this.sparqlBasicGraphPattern(triples) ],
    };
  }

  private sparqlBasicGraphPattern(triples: Triple[]): BgpPattern {
    return { type: 'bgp', triples };
  }

  public buildConstructFromEntitySelectQuery(
    graphWhere: Pattern[],
    graphSelectVariables: Variable[],
    select?: FindOptionsSelect,
  ): ConstructQuery {
    let triples: Triple[];
    let where: Pattern[] = [];
    if (select) {
      // TODO: fix when select and relations are used.
      triples = this.createSelectPattern(select, entityVariable);
      where = [
        this.sparqlOptionalSelectGraph(entityVariable, triples),
        ...graphWhere ];
    } else {
      const graphSelectsAndTriplePatterns = this.createGraphSelectsAndTriplePatterns(graphSelectVariables);
      const entityGraphTriple = { subject: subjectNode, predicate: predicateNode, object: objectNode };
      triples = [
        entityGraphTriple,
        ...graphSelectsAndTriplePatterns.triples,
      ];
      where = [
        ...graphWhere,
        this.sparqlSelectGraph(
          entityVariable,
          [ this.sparqlBasicGraphPattern([ entityGraphTriple ]) ],
        ),
        ...graphSelectsAndTriplePatterns.graphPatterns,
      ];
    }

    return {
      type: 'query',
      prefixes: {},
      queryType: 'CONSTRUCT',
      template: triples,
      where,
    };
  }

  private createSelectPattern(select: FindOptionsSelect, subject: Variable): Triple[] {
    if (Array.isArray(select)) {
      return select.map((selectPredicate): Triple => ({
        subject,
        predicate: DataFactory.namedNode(selectPredicate),
        object: this.createVariable(),
      }));
    }
    return Object.entries(select).reduce((arr: Triple[], [ key, value ]): Triple[] => {
      const variable = this.createVariable();
      arr.push({ subject, predicate: DataFactory.namedNode(key), object: variable });
      if (typeof value === 'object') {
        arr = [ ...arr, ...this.createSelectPattern(value, variable) ];
      }
      return arr;
    }, []);
  }

  private createGraphSelectsAndTriplePatterns(
    variables: Variable[],
  ): { triples: Triple[]; graphPatterns: OptionalPattern[] } {
    return variables.reduce((
      obj: { triples: Triple[]; graphPatterns: OptionalPattern[] },
      variable: Variable,
    ): { triples: Triple[]; graphPatterns: OptionalPattern[] } => {
      const triple = {
        subject: this.createVariable(),
        predicate: this.createVariable(),
        object: this.createVariable(),
      };
      obj.triples.push(triple);
      obj.graphPatterns.push({
        type: 'optional',
        patterns: [
          this.sparqlSelectGraph(
            variable,
            [ this.sparqlBasicGraphPattern([ triple ]) ],
          ),
        ],
      });
      return obj;
    }, { triples: [], graphPatterns: []});
  }

  private sparqlSelectGraph(name: Variable | NamedNode, patterns: Pattern[]): GraphPattern {
    return {
      type: 'graph',
      name: name as IriTerm,
      patterns,
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

  private createQueryData(
    subject: Variable,
    where?: FindOptionsWhere,
    order?: FindOptionsOrder,
    relations?: FindOptionsRelations,
  ): QueryData {
    const whereQueryData = this.createWhereQueryData(subject, where);
    const orderQueryData = this.createOrderQueryData(subject, order);
    const relationsQueryData = this.createRelationsQueryData(subject, relations);
    return {
      relationsVariables: relationsQueryData.variables,
      triples: whereQueryData.triples,
      filters: whereQueryData.filters,
      optionalTriples: [ ...relationsQueryData.triples, ...orderQueryData.triples ],
      orders: orderQueryData.orders,
      graphTriples: whereQueryData.graphTriples,
      optionalGraphTriples: [ ...relationsQueryData.graphTriples ],
      graphFilters: [ ...whereQueryData.graphFilters ],
    };
  }

  private createWhereQueryData(subject: Variable, where?: FindOptionsWhere): WhereQueryData {
    const hasSingleKey = Object.keys(where ?? {}).length === 1;
    const whereQueryData = Object.entries(where ?? {}).reduce((obj: WhereQueryData, [ key, value ]): WhereQueryData => {
      const whereQueryDataForField = this.createWhereQueryDataForField(subject, key, value!, hasSingleKey);
      return {
        triples: [ ...obj.triples, ...whereQueryDataForField.triples ],
        graphTriples: [ ...obj.graphTriples, ...whereQueryDataForField.graphTriples ],
        filters: [ ...obj.filters, ...whereQueryDataForField.filters ],
        graphFilters: [ ...obj.graphFilters, ...whereQueryDataForField.graphFilters ],
      };
    }, { triples: [], graphTriples: [], filters: [], graphFilters: []});

    if (whereQueryData.triples.length === 0) {
      whereQueryData.triples.push({
        subject,
        predicate: this.createVariable(),
        object: this.createVariable(),
      });
    }
    return whereQueryData;
  }

  private createWhereQueryDataForField(
    subject: Variable,
    field: string,
    value: IdOrTypeFindOptionsWhereField | FindOptionsWhereField,
    isOnlyField: boolean,
  ): WhereQueryData {
    if (field === 'id') {
      return this.createWhereQueryDataForIdValue(subject, value as IdOrTypeFindOptionsWhereField, isOnlyField);
    }
    if (field === 'type') {
      return this.createWhereQueryDataForType(subject, value as IdOrTypeFindOptionsWhereField);
    }
    const predicate = DataFactory.namedNode(field);
    return this.createWhereQueryDataFromKeyValue(subject, predicate, value);
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
      graphFilters: [],
      triples: [],
      graphTriples: [],
      optionalTriples: [],
      orders: [],
    } as WhereQueryData;

    if (qualifyWithTriple) {
      queryData.triples.push({
        subject: term,
        predicate: this.createVariable(),
        object: this.createVariable(),
      });
    }
    return queryData;
  }

  private createWhereQueryDataForType(
    subject: Variable | IriTerm,
    value: IdOrTypeFindOptionsWhereField,
  ): WhereQueryData {
    if (FindOperator.isFindOperator(value)) {
      const variable = this.createVariable();
      const triple = this.buildTypesAndSuperTypesTriple(subject, variable);
      const operatorFilter = this.resolveFindOperatorAsExpressionWithMultipleValues(
        variable as Expression,
        value as FindOperator<string>,
        triple,
      );
      return {
        filters: [ operatorFilter ],
        graphFilters: [],
        triples: [ triple ],
        graphTriples: [],
      };
    }
    return {
      filters: [],
      graphFilters: [],
      triples: [ this.buildTypesAndSuperTypesTriple(subject, DataFactory.namedNode(value as string)) ],
      graphTriples: [],
    };
  }

  private createWhereQueryDataFromKeyValue(
    subject: Variable,
    predicate: IriTerm | PropertyPath,
    value: FindOptionsWhereField,
  ): WhereQueryData {
    if (FindOperator.isFindOperator(value)) {
      return this.createWhereQueryDataForFindOperator(subject, predicate, value as FindOperator<any>);
    }
    if (Array.isArray(value)) {
      return value.reduce((obj: WhereQueryData, valueItem): WhereQueryData => {
        const valueWhereQueryData = this.createWhereQueryDataFromKeyValue(subject, predicate, valueItem);
        return {
          filters: [ ...obj.filters, ...valueWhereQueryData.filters ],
          triples: [ ...obj.triples, ...valueWhereQueryData.triples ],
          graphFilters: [ ...obj.graphFilters, ...valueWhereQueryData.graphFilters ],
          graphTriples: [ ...obj.graphTriples, ...valueWhereQueryData.graphTriples ],
        };
      }, { filters: [], graphTriples: [], triples: [], graphFilters: []});
    }
    if (typeof value === 'object') {
      if ('@value' in value) {
        return this.createWhereQueryDataForValueObject(subject, predicate, value as ValueObject);
      }
      return this.createWhereQueryDataForNestedWhere(subject, predicate, value as FindOptionsWhere);
    }
    const term = this.resolveValueToTerm(value);
    return {
      filters: [],
      graphFilters: [],
      triples: [{ subject, predicate, object: term }],
      graphTriples: [],
    };
  }

  private inversePropertyPredicate(predicate: IriTerm | PropertyPath): PropertyPath {
    return {
      type: 'path',
      pathType: '^',
      items: [ predicate ],
    };
  }

  private createWhereQueryDataForFindOperator(
    subject: Variable,
    predicate: IriTerm | PropertyPath,
    operator: FindOperator<any>,
  ): WhereQueryData {
    if (operator.operator === 'inverse') {
      const inversePredicate = this.inversePropertyPredicate(predicate);
      const inverseWhereQueryData = this.createWhereQueryDataFromKeyValue(subject, inversePredicate, operator.value);
      return {
        filters: [],
        triples: [],
        graphTriples: inverseWhereQueryData.triples,
        graphFilters: inverseWhereQueryData.filters,
      };
    }
    const variable = this.createVariable();
    const triple = { subject, predicate, object: variable };
    return {
      filters: [ this.resolveFindOperatorAsExpressionWithMultipleValues(variable, operator, triple) ],
      triples: [ triple ],
      graphTriples: [],
      graphFilters: [],
    };
  }

  private createWhereQueryDataForNestedWhere(
    subject: Variable,
    predicate: IriTerm | PropertyPath,
    where: FindOptionsWhere,
  ): WhereQueryData {
    const subNodeVariable = this.createVariable();
    const subWhereQueryData = this.createWhereQueryData(subNodeVariable, where);
    return {
      filters: subWhereQueryData.filters,
      triples: [
        { subject, predicate, object: subNodeVariable },
        ...subWhereQueryData.triples,
      ],
      graphFilters: [],
      graphTriples: [],
    };
  }

  private createWhereQueryDataForValueObject(
    subject: Variable,
    predicate: IriTerm | PropertyPath,
    valueObject: ValueObject,
  ): WhereQueryData {
    const term = this.valueObjectToTerm(valueObject);
    return {
      filters: [],
      triples: [{ subject, predicate, object: term }],
      graphFilters: [],
      graphTriples: [],
    };
  }

  private valueObjectToTerm(valueObject: ValueObject): Literal {
    let typeOrLanguage: string;
    let value: string;
    if ('@type' in valueObject && valueObject['@type'] === '@json') {
      typeOrLanguage = RDF.JSON;
      value = JSON.stringify(valueObject['@value']);
    } else {
      typeOrLanguage = ('@type' in valueObject ? valueObject['@type'] : valueObject['@language'])!;
      value = (valueObject['@value'] as FieldPrimitiveValue).toString();
    }
    return DataFactory.literal(value, typeOrLanguage);
  }

  private resolveFindOperatorAsExpressionWithMultipleValues(
    leftSide: Expression,
    operator: FindOperator<any>,
    triple: Triple,
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
      let expression: OperationExpression;
      try {
        expression = this.resolveFindOperatorAsExpressionWithMultipleValues(
          leftSide,
          rightSide as FindOperator<any>,
          triple,
        );
      } catch {
        throw new Error(`Unsupported Not sub operator "${rightSide.operator}"`);
      }
      filterExpression = this.filterWithExpression(expression);
    } else {
      filterExpression = this.filterWithExpression(
        this.buildEqualOperation(leftSide, rightSide as Expression),
      );
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

  private createOrderQueryData(subject: Variable, order?: FindOptionsOrder): OrderQueryData {
    if (!order) {
      return { triples: [], orders: [], variables: []};
    }
    return Object.entries(order).reduce((obj: OrderQueryData, [ property, direction ]): OrderQueryData => {
      const orderQueryData = this.createOrderQueryDataForProperty(subject, property, direction);
      obj.orders = [ ...obj.orders, orderQueryData.order ];
      obj.variables.push(orderQueryData.variable);
      if (orderQueryData.triple) {
        obj.triples.push(orderQueryData.triple);
      }
      return obj;
    }, { triples: [], orders: [], variables: []});
  }

  private createOrderQueryDataForProperty(
    subject: Variable,
    property: string,
    direction: FindOptionsOrderValue,
  ): { triple?: Triple; order: Ordering; variable: Variable } {
    if (property === 'id') {
      return {
        triple: undefined,
        order: {
          expression: subject,
          descending: direction === 'DESC' || direction === 'desc',
        },
        variable: subject,
      };
    }
    const variable = this.createVariable();
    return {
      triple: {
        subject,
        predicate: DataFactory.namedNode(property),
        object: variable,
      },
      order: {
        expression: variable,
        descending: direction === 'DESC' || direction === 'desc',
      },
      variable,
    };
  }

  private createRelationsQueryData(subject: Variable, relations?: FindOptionsRelations): RelationsQueryData {
    if (!relations) {
      return { variables: [], triples: [], graphTriples: []};
    }
    return Object.entries(relations).reduce((obj: RelationsQueryData, [ property, value ]): RelationsQueryData => {
      const variable = this.createVariable();
      obj.variables.push(variable);
      obj.triples.push({
        subject,
        predicate: DataFactory.namedNode(property),
        object: variable,
      });
      if (typeof value === 'object') {
        const subRelationsQueryData = this.createRelationsQueryData(variable, value);
        obj.variables = [ ...obj.variables, ...subRelationsQueryData.variables ];
        obj.graphTriples = [
          ...obj.graphTriples,
          ...subRelationsQueryData.triples,
          ...subRelationsQueryData.graphTriples,
        ];
      }
      return obj;
    }, { variables: [], triples: [], graphTriples: []});
  }

  private createVariable(): Variable {
    return DataFactory.variable(this.variableGenerator.getNext());
  }
}
