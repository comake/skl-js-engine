import DataFactory from '@rdfjs/data-model';
import type { Variable, NamedNode, Term, Literal } from '@rdfjs/types';
import type {
  FilterPattern,
  IriTerm,
  Triple,
  Expression,
  OperationExpression,
  Ordering,
  PropertyPath,
  ValuePatternRow,
  ValuesPattern,
  Pattern,
  ConstructQuery,
} from 'sparqljs';
import {
  allTypesAndSuperTypesPath,
  createFilterPatternFromFilters,
  createSparqlFilterWithExpression,
  createSparqlBasicGraphPattern,
  createSparqlEqualOperation,
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
  createSparqlGraphPattern,
  createSparqlSelectGroup,
  createSparqlServicePattern,
  entityVariable,
  entityGraphTriple,
  createSparqlConstructQuery,
  createSparqlSequencePredicate,
  createSparqlZeroOrMorePredicate,
  createSparqlOneOrMorePredicate,
} from '../../util/SparqlUtil';
import {
  valueToLiteral,
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
  IdFindOptionsWhereField,
  TypeFindOptionsWhereField,
  ValueWhereFieldObject,
} from '../FindOptionsTypes';
import type { InverseRelationOperatorValue } from '../operator/InverseRelation';
import type { InverseRelationOrderValue } from '../operator/InverseRelationOrder';
import { VariableGenerator } from './VariableGenerator';

export interface WhereQueryData {
  values: ValuesPattern[];
  triples: Triple[];
  filters: OperationExpression[];
  graphValues: ValuesPattern[];
  graphTriples: Triple[];
  graphFilters: OperationExpression[];
  serviceTriples?: Record<string, Triple[]>;
}

export interface RelationsQueryData {
  patterns: Pattern[];
  selectionTriples: Triple[];
}

export interface OrderQueryData {
  triples: Triple[];
  filters: OperationExpression[];
  orders: Ordering[];
  groupByParent?: boolean;
}

export interface EntitySelectQueryData {
  where: Pattern[];
  orders: Ordering[];
  graphWhere: Pattern[];
  graphSelectionTriples: Triple[];
  group?: Variable;
}

export interface SparqlQueryBuilderOptions {
  where?: FindOptionsWhere;
  select?: FindOptionsSelect;
  order?: FindOptionsOrder;
  relations?: FindOptionsRelations;
}

export class SparqlQueryBuilder {
  private readonly variableGenerator: VariableGenerator;

  public constructor() {
    this.variableGenerator = new VariableGenerator();
  }

  public buildEntitySelectPatternsFromOptions(
    subject: Variable,
    options?: SparqlQueryBuilderOptions,
  ): EntitySelectQueryData {
    const relations = options?.select ? undefined : options?.relations;
    const whereQueryData = this.createWhereQueryData(subject, options?.where);
    const orderQueryData = this.createOrderQueryData(subject, options?.order);
    const relationsQueryData = this.createRelationsQueryData(subject, relations);
    if (whereQueryData.triples.length === 0 && (
      whereQueryData.filters.length > 0 ||
      orderQueryData.triples.length > 0 ||
      (
        whereQueryData.values.length === 0 &&
        whereQueryData.graphValues.length === 0 &&
        whereQueryData.graphTriples.length === 0
      )
    )) {
      whereQueryData.triples.push({
        subject,
        predicate: this.createVariable(),
        object: this.createVariable(),
      });
    }

    const wherePatterns = this.createWherePatternsFromQueryData(
      whereQueryData.values,
      whereQueryData.triples,
      whereQueryData.filters,
      orderQueryData.triples,
      orderQueryData.filters,
    );
    const graphWherePatterns = this.createWherePatternsFromQueryData(
      whereQueryData.graphValues,
      whereQueryData.graphTriples,
      whereQueryData.graphFilters,
      undefined,
      undefined,
      undefined,
      relationsQueryData.patterns,
    );
    return {
      where: wherePatterns,
      orders: orderQueryData.orders,
      group: orderQueryData.groupByParent ? subject : undefined,
      graphWhere: graphWherePatterns,
      graphSelectionTriples: relationsQueryData.selectionTriples,
    };
  }

  public buildConstructFromEntitySelectQuery(
    graphWhere: Pattern[],
    graphSelectionTriples: Triple[],
    select?: FindOptionsSelect,
  ): ConstructQuery {
    let triples: Triple[];
    let where: Pattern[] = [];
    if (select) {
      triples = this.createSelectPattern(select, entityVariable);
      where = [
        createSparqlOptional([
          createSparqlBasicGraphPattern(triples),
        ]),
        ...graphWhere,
      ];
    } else {
      triples = [ entityGraphTriple, ...graphSelectionTriples ];
      where = [
        ...graphWhere,
        createSparqlGraphPattern(
          entityVariable,
          [ createSparqlBasicGraphPattern([ entityGraphTriple ]) ],
        ),
      ];
    }
    return createSparqlConstructQuery(triples, where);
  }

  private createWhereQueryData(
    subject: Variable,
    where?: FindOptionsWhere,
    baseTriples: Triple[] = [],
  ): WhereQueryData {
    const hasSingleKey = Object.keys(where ?? {}).length === 1;
    const whereQueryData = Object.entries(where ?? {}).reduce((obj: WhereQueryData, [ key, value ]): WhereQueryData => {
      const whereQueryDataForField = this.createWhereQueryDataForField(subject, key, value!, hasSingleKey);
      return {
        values: [ ...obj.values, ...whereQueryDataForField.values ],
        triples: [ ...obj.triples, ...whereQueryDataForField.triples ],
        filters: [ ...obj.filters, ...whereQueryDataForField.filters ],
        graphValues: [ ...obj.graphValues, ...whereQueryDataForField.graphValues ],
        graphTriples: [ ...obj.graphTriples, ...whereQueryDataForField.graphTriples ],
        graphFilters: [ ...obj.graphFilters, ...whereQueryDataForField.graphFilters ],
      };
    }, { values: [], triples: baseTriples, filters: [], graphValues: [], graphTriples: [], graphFilters: []});
    return whereQueryData;
  }

  private createWhereQueryDataForField(
    subject: Variable,
    field: string,
    value: IdFindOptionsWhereField | TypeFindOptionsWhereField | FindOptionsWhereField,
    isOnlyField: boolean,
  ): WhereQueryData {
    if (field === 'id') {
      return this.createWhereQueryDataForIdValue(
        subject,
        value as FindOperator<any, any>,
        isOnlyField,
      );
    }
    if (field === 'type') {
      return this.createWhereQueryDataForType(subject, value as FindOperator<any, any>);
    }
    const predicate = DataFactory.namedNode(field);
    return this.createWhereQueryDataFromKeyValue(subject, predicate, value);
  }

  private createWhereQueryDataForIdValue(
    term: Variable,
    value: IdFindOptionsWhereField,
    isOnlyField: boolean,
  ): WhereQueryData {
    let filter: OperationExpression | undefined;
    let valuePattern: ValuesPattern | undefined;
    let triple: Triple | undefined;
    if (FindOperator.isFindOperator(value)) {
      ({ filter, valuePattern, triple } =
        this.resolveFindOperatorAsExpressionForId(term, value as FindOperator<string, any>));
    } else {
      valuePattern = {
        type: 'values',
        values: [{
          [`?${term.value}`]: DataFactory.namedNode(value as string),
        }],
      };
    }
    if (isOnlyField) {
      return {
        values: [],
        filters: [],
        triples: [],
        graphValues: valuePattern ? [ valuePattern ] : [],
        graphFilters: filter ? [ filter ] : [],
        graphTriples: triple ? [ triple ] : [],
      };
    }

    return {
      values: valuePattern ? [ valuePattern ] : [],
      filters: filter ? [ filter ] : [],
      triples: triple ? [ triple ] : [],
      graphValues: [],
      graphFilters: [],
      graphTriples: [],
    } as WhereQueryData;
  }

  private createWhereQueryDataForType(
    subject: Variable,
    value: TypeFindOptionsWhereField,
  ): WhereQueryData {
    if (FindOperator.isFindOperator(value)) {
      if ((value as FindOperator<any, any>).operator === 'inverse') {
        const inversePredicate = createSparqlInversePredicate([ allTypesAndSuperTypesPath ]);
        const inverseWhereQueryData = this.createWhereQueryDataFromKeyValue(
          subject,
          inversePredicate,
          (value as FindOperator<any, any>).value,
        );
        return {
          values: inverseWhereQueryData.values,
          filters: inverseWhereQueryData.filters,
          triples: inverseWhereQueryData.triples,
          graphValues: [],
          graphTriples: [],
          graphFilters: [],
        };
      }

      const variable = this.createVariable();
      const triple = { subject, predicate: allTypesAndSuperTypesPath, object: variable };
      const { filter, valuePattern, tripleInFilter } = this.resolveFindOperatorAsExpressionWithMultipleValues(
        variable,
        value as FindOperator<string, any>,
        triple,
      );
      return {
        values: valuePattern ? [ valuePattern ] : [],
        filters: filter ? [ filter ] : [],
        triples: tripleInFilter ? [] : [ triple ],
        graphValues: [],
        graphFilters: [],
        graphTriples: [],
      };
    }
    return {
      values: [],
      filters: [],
      triples: [{
        subject,
        predicate: allTypesAndSuperTypesPath,
        object: DataFactory.namedNode(value as string),
      }],
      graphValues: [],
      graphFilters: [],
      graphTriples: [],
    };
  }

  private createWhereQueryDataFromKeyValue(
    subject: Variable,
    predicate: IriTerm | PropertyPath,
    value: FindOptionsWhereField,
  ): WhereQueryData {
    if (Array.isArray(value) && FindOperator.isFindOperator(value[0])) {
      return this.createWhereQueryDataForMultipleFindOperators(subject, predicate, value as FindOperator<any, any>[]);
    }
    if (FindOperator.isFindOperator(value)) {
      return this.createWhereQueryDataForFindOperator(subject, predicate, value as FindOperator<any, any>);
    }
    if (Array.isArray(value)) {
      return (value as FieldPrimitiveValue[]).reduce((obj: WhereQueryData, valueItem): WhereQueryData => {
        const valueWhereQueryData = this.createWhereQueryDataFromKeyValue(subject, predicate, valueItem);
        return {
          values: [ ...obj.values, ...valueWhereQueryData.values ],
          filters: [ ...obj.filters, ...valueWhereQueryData.filters ],
          triples: [ ...obj.triples, ...valueWhereQueryData.triples ],
          graphValues: [ ...obj.graphValues, ...valueWhereQueryData.graphValues ],
          graphFilters: [ ...obj.graphFilters, ...valueWhereQueryData.graphFilters ],
          graphTriples: [ ...obj.graphTriples, ...valueWhereQueryData.graphTriples ],
        };
      }, { values: [], filters: [], triples: [], graphTriples: [], graphValues: [], graphFilters: []});
    }
    if (typeof value === 'object') {
      if ('@value' in value) {
        return this.createWhereQueryDataForValueObject(subject, predicate, value as ValueWhereFieldObject);
      }
      return this.createWhereQueryDataForNestedWhere(subject, predicate, value as FindOptionsWhere);
    }
    const term = this.resolveValueToTerm(value);
    return {
      values: [],
      filters: [],
      triples: [{ subject, predicate, object: term }],
      graphValues: [],
      graphFilters: [],
      graphTriples: [],
    };
  }

  private createWhereQueryDataForFindOperator(
    subject: Variable,
    predicate: IriTerm | PropertyPath,
    operator: FindOperator<any, any>,
  ): WhereQueryData {
    if (operator.operator === 'inverse') {
      const inversePredicate = createSparqlInversePredicate([ predicate ]);
      const inverseWhereQueryData = this.createWhereQueryDataFromKeyValue(subject, inversePredicate, operator.value);
      return {
        values: inverseWhereQueryData.values,
        filters: inverseWhereQueryData.filters,
        triples: inverseWhereQueryData.triples,
        graphValues: [],
        graphTriples: [],
        graphFilters: [],
      };
    }
    if (FindOperator.isPathOperator(operator)) {
      const pathPredicate = this.pathOperatorToPropertyPath(operator);
      const combinedPredicate = createSparqlSequencePredicate([
        predicate,
        pathPredicate,
      ]);
      return this.createWhereQueryDataFromKeyValue(subject, combinedPredicate, operator.value.value);
    }
    const variable = this.createVariable();
    const triple = { subject, predicate, object: variable };
    const { filter, valuePattern } = this.resolveFindOperatorAsExpressionWithMultipleValues(
      variable,
      operator,
      triple,
    );
    return {
      values: valuePattern ? [ valuePattern ] : [],
      filters: filter ? [ filter ] : [],
      triples: [ triple ],
      graphValues: [],
      graphTriples: [],
      graphFilters: [],
    };
  }

  private pathOperatorToPropertyPath(
    operator: FindOperator<any, 'inversePath' | 'sequencePath' | 'zeroOrMorePath' | 'oneOrMorePath'>,
  ): PropertyPath {
    if (operator.operator === 'inversePath') {
      let subPredicate: IriTerm | PropertyPath;
      const { subPath } = operator.value;
      if (typeof subPath === 'string') {
        subPredicate = DataFactory.namedNode(subPath);
      } else {
        subPredicate = this.pathOperatorToPropertyPath(subPath);
      }
      return createSparqlInversePredicate([ subPredicate ]);
    }
    if (operator.operator === 'sequencePath') {
      const { subPath } = operator.value;
      const subPredicates = subPath
        .map((sequencePart: string | FindOperator<any, any>): IriTerm | PropertyPath => {
          if (typeof sequencePart === 'string') {
            return DataFactory.namedNode(sequencePart);
          }
          return this.pathOperatorToPropertyPath(sequencePart);
        });
      return createSparqlSequencePredicate(subPredicates);
    }
    if (operator.operator === 'zeroOrMorePath') {
      const { subPath } = operator.value;
      let subPredicate: IriTerm | PropertyPath;
      if (typeof subPath === 'string') {
        subPredicate = DataFactory.namedNode(subPath);
      } else {
        subPredicate = this.pathOperatorToPropertyPath(subPath);
      }
      return createSparqlZeroOrMorePredicate([ subPredicate ]);
    }
    if (operator.operator === 'oneOrMorePath') {
      const { subPath } = operator.value;
      let subPredicate: IriTerm | PropertyPath;
      if (typeof subPath === 'string') {
        subPredicate = DataFactory.namedNode(subPath);
      } else {
        subPredicate = this.pathOperatorToPropertyPath(subPath);
      }
      return createSparqlOneOrMorePredicate([ subPredicate ]);
    }
    throw new Error(`Operator ${operator.operator} not supported`);
  }

  private createWhereQueryDataForMultipleFindOperators(
    subject: Variable,
    predicate: IriTerm | PropertyPath,
    operators: FindOperator<any, any>[],
  ): WhereQueryData {
    const variable = this.createVariable();
    const triple = { subject, predicate, object: variable };
    const whereQueryData = {
      values: [],
      filters: [],
      triples: [ triple ],
      graphValues: [],
      graphTriples: [],
      graphFilters: [],
    };
    return operators.reduce((obj: WhereQueryData, operator): WhereQueryData => {
      const { filter, valuePattern } = this.resolveFindOperatorAsExpressionWithMultipleValues(
        variable,
        operator,
        triple,
      );
      if (valuePattern) {
        obj.values.push(valuePattern);
      }
      if (filter) {
        obj.filters.push(filter);
      }
      return obj;
    }, whereQueryData);
  }

  private createWhereQueryDataForNestedWhere(
    subject: Variable,
    predicate: IriTerm | PropertyPath,
    where: FindOptionsWhere,
  ): WhereQueryData {
    const subNodeVariable = this.createVariable();
    const subWhereQueryData = this.createWhereQueryData(subNodeVariable, where);
    return {
      values: [ ...subWhereQueryData.values, ...subWhereQueryData.graphValues ],
      filters: subWhereQueryData.filters,
      triples: [
        { subject, predicate, object: subNodeVariable },
        ...subWhereQueryData.triples,
      ],
      graphValues: [],
      graphFilters: [],
      graphTriples: [],
    };
  }

  private createWhereQueryDataForValueObject(
    subject: Variable,
    predicate: IriTerm | PropertyPath,
    valueObject: ValueWhereFieldObject,
  ): WhereQueryData {
    const term = this.valueObjectToTerm(valueObject);
    return {
      values: [],
      filters: [],
      triples: [{ subject, predicate, object: term }],
      graphValues: [],
      graphFilters: [],
      graphTriples: [],
    };
  }

  private valueObjectToTerm(valueObject: ValueWhereFieldObject): Literal {
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
    leftSide: Variable,
    operator: FindOperator<any, any>,
    triple: Triple,
    dontUseValuePattern = false,
  ): { filter?: OperationExpression; valuePattern?: ValuesPattern; tripleInFilter?: boolean } {
    if (operator.operator === 'in') {
      const resolvedValue = this.resolveValueToExpression(operator.value) as (NamedNode | Literal)[];
      if (Array.isArray(resolvedValue) && !dontUseValuePattern) {
        return {
          valuePattern: {
            type: 'values',
            values: resolvedValue.map((value): ValuePatternRow => ({ [`?${leftSide.value}`]: value })),
          },
        };
      }
      return {
        filter: createSparqlInOperation(leftSide, resolvedValue as Expression),
      };
    }
    if (operator.operator === 'not') {
      const resolvedExpression = this.resolveValueToExpression(operator.value) as Expression | FindOperator<any, any>;
      return {
        filter: this.buildNotOperationForMultiValued(leftSide, resolvedExpression, triple),
        tripleInFilter: true,
      };
    }
    const resolvedExpression = this.resolveValueToExpression(operator.value) as Expression;
    switch (operator.operator) {
      case 'equal':
        return { filter: createSparqlEqualOperation(leftSide, resolvedExpression) };
      case 'gt':
        return { filter: createSparqlGtOperation(leftSide, resolvedExpression) };
      case 'gte':
        return { filter: createSparqlGteOperation(leftSide, resolvedExpression) };
      case 'lt':
        return { filter: createSparqlLtOperation(leftSide, resolvedExpression) };
      case 'lte':
        return { filter: createSparqlLteOperation(leftSide, resolvedExpression) };
      default:
        throw new Error(`Unsupported operator "${operator.operator}"`);
    }
  }

  private resolveFindOperatorAsExpressionForId(
    leftSide: Variable,
    operator: FindOperator<any, any>,
  ): { filter?: OperationExpression; valuePattern?: ValuesPattern; triple?: Triple } {
    switch (operator.operator) {
      case 'inversePath': {
        const predicate = this.pathOperatorToPropertyPath(operator);
        const triple = {
          subject: leftSide,
          predicate,
          object: DataFactory.namedNode(operator.value.value),
        };
        return { triple };
      }
      case 'in': {
        const resolvedValue = this.resolveValueToExpression(operator.value) as NamedNode[];
        return {
          valuePattern: {
            type: 'values',
            values: resolvedValue.map((value): ValuePatternRow => ({ [`?${leftSide.value}`]: value })),
          },
        };
      } case 'not':
        return {
          filter: this.buildNotOperationForId(
            leftSide,
            this.resolveValueToExpression(operator.value) as Expression | FindOperator<any, any>,
          ),
        };
      case 'equal':
        return {
          filter: createSparqlEqualOperation(
            leftSide,
            this.resolveValueToExpression(operator.value) as Expression,
          ),
        };
      default:
        throw new Error(`Unsupported operator "${operator.operator}"`);
    }
  }

  private resolveValueToExpression(
    value: OrArray<any> | FindOperator<any, any>,
  ): FindOperator<any, any> | OrArray<Term> {
    if (FindOperator.isFindOperator(value)) {
      return value;
    }
    if (Array.isArray(value)) {
      return value.map((valueItem): Term => this.resolveValueToTerm(valueItem));
    }
    return this.resolveValueToTerm(value);
  }

  private buildNotOperationForMultiValued(
    leftSide: Variable,
    rightSide: Expression | FindOperator<any, any>,
    triple: Triple,
  ): OperationExpression {
    let filterExpression: FilterPattern;
    const rightSideIsOperation = typeof rightSide === 'object' && 'operator' in rightSide;
    if (rightSideIsOperation) {
      let expression: OperationExpression | undefined;
      try {
        ({ filter: expression } = this.resolveFindOperatorAsExpressionWithMultipleValues(
          leftSide,
          rightSide as FindOperator<any, any>,
          triple,
          true,
        ));
      } catch {
        throw new Error(`Unsupported Not sub operator "${rightSide.operator}"`);
      }
      filterExpression = createSparqlFilterWithExpression(expression!);
    } else {
      filterExpression = createSparqlFilterWithExpression(
        createSparqlEqualOperation(leftSide, rightSide as Expression),
      );
    }
    return createSparqlNotExistsOperation([
      createSparqlSelectGroup([
        createSparqlBasicGraphPattern([ triple ]),
        filterExpression,
      ]),
    ]);
  }

  private buildNotOperationForId(
    leftSide: Expression,
    rightSide: Expression | FindOperator<any, any>,
  ): OperationExpression {
    if (FindOperator.isFindOperator(rightSide)) {
      const resolvedValue = this.resolveValueToExpression((rightSide as FindOperator<string, any>).value) as Expression;
      switch ((rightSide as FindOperator<string, any>).operator) {
        case 'in':
          return createSparqlNotInOperation(leftSide, resolvedValue);
        case 'equal':
          return createSparqlNotEqualOperation(leftSide, resolvedValue);
        default:
          throw new Error(`Unsupported Not sub operator "${(rightSide as FindOperator<string, any>).operator}"`);
      }
    }
    return createSparqlNotEqualOperation(leftSide, rightSide as Expression);
  }

  private resolveValueToTerm(value: FieldPrimitiveValue | ValueWhereFieldObject): NamedNode | Literal {
    if (typeof value === 'object' && '@value' in value) {
      return valueToLiteral(
        (value as ValueWhereFieldObject)['@value'],
        '@type' in value ? value['@type'] : undefined,
      );
    }
    if (isUrl(value)) {
      return DataFactory.namedNode(value as string);
    }
    return valueToLiteral(value);
  }

  private createOrderQueryData(
    subject: Variable,
    order?: FindOptionsOrder | FindOperator<InverseRelationOrderValue, 'inverseRelationOrder'>,
    isNested = false,
  ): OrderQueryData {
    if (!order) {
      return { triples: [], orders: [], filters: []};
    }
    return Object.entries(order).reduce((obj: OrderQueryData, [ property, orderValue ]): OrderQueryData => {
      const orderQueryData = this.createOrderQueryDataForProperty(subject, property, orderValue, isNested);
      obj.orders = [ ...obj.orders, ...orderQueryData.orders ];
      obj.triples = [ ...obj.triples, ...orderQueryData.triples ];
      obj.filters = [ ...obj.filters, ...orderQueryData.filters ];
      obj.groupByParent = obj.groupByParent ?? orderQueryData.groupByParent;
      return obj;
    }, { triples: [], orders: [], filters: []});
  }

  private createOrderQueryDataForProperty(
    subject: Variable,
    property: string,
    orderValue: FindOptionsOrderValue | FindOperator<InverseRelationOrderValue, 'inverseRelationOrder'>,
    isNested = false,
  ): OrderQueryData {
    const predicate = DataFactory.namedNode(property);
    if (FindOperator.isFindOperator(orderValue)) {
      const variable = this.createVariable();
      const inverseRelationTriple = {
        subject,
        predicate: createSparqlInversePredicate([ predicate ]),
        object: variable,
      };
      const subRelationOperatorValue = (
        orderValue as FindOperator<InverseRelationOrderValue, 'inverseRelationOrder'>
      ).value as InverseRelationOrderValue;
      const subRelationOrderQueryData = this.createOrderQueryData(
        variable,
        subRelationOperatorValue.order,
        true,
      );
      const subRelationWhereQueryData = this.createWhereQueryData(variable, subRelationOperatorValue.where);
      return {
        triples: [ inverseRelationTriple, ...subRelationOrderQueryData.triples, ...subRelationWhereQueryData.triples ],
        filters: subRelationWhereQueryData.filters,
        orders: subRelationOrderQueryData.orders,
        groupByParent: true,
      };
    }
    if (property === 'id') {
      return {
        triples: [],
        filters: [],
        orders: [{
          expression: subject,
          descending: orderValue === 'DESC' || orderValue === 'desc',
        }],
      };
    }
    const variable = this.createVariable();
    const isDescending = orderValue === 'DESC' || orderValue === 'desc';
    return {
      triples: [{ subject, predicate, object: variable }],
      filters: [],
      orders: [{
        expression: isNested
          ? {
            type: 'aggregate',
            expression: variable,
            aggregation: isDescending ? 'max' : 'min',
          }
          : variable,
        descending: isDescending,
      }],
    };
  }

  private createRelationsQueryData(
    subject: Variable,
    relations?: FindOptionsRelations,
  ): RelationsQueryData {
    if (!relations) {
      return { patterns: [], selectionTriples: []};
    }
    return Object.entries(relations)
      .reduce((obj: RelationsQueryData, [ property, relationsValue ]): RelationsQueryData => {
        const predicate = DataFactory.namedNode(property);
        if (typeof relationsValue === 'object') {
          if (FindOperator.isFindOperator(relationsValue)) {
            const { patterns, selectionTriples } = this.createRelationsQueryDataForInverseRelation(
              subject,
              predicate,
              relationsValue as FindOperator<InverseRelationOperatorValue, 'inverseRelation'>,
            );
            return {
              patterns: [ ...obj.patterns, ...patterns ],
              selectionTriples: [ ...obj.selectionTriples, ...selectionTriples ],
            };
          }
          const { patterns, selectionTriples } = this.createRelationsQueryDataForNestedRelation(
            subject,
            predicate,
            relationsValue as FindOptionsRelations,
          );
          return {
            patterns: [ ...obj.patterns, ...patterns ],
            selectionTriples: [ ...obj.selectionTriples, ...selectionTriples ],
          };
        }
        const variable = this.createVariable();
        const graphTriple = {
          subject: this.createVariable(),
          predicate: this.createVariable(),
          object: this.createVariable(),
        };
        const relationPattern = createSparqlOptional([
          createSparqlBasicGraphPattern([{ subject, predicate, object: variable }]),
          createSparqlGraphPattern(
            variable,
            [ createSparqlBasicGraphPattern([ graphTriple ]) ],
          ),
        ]);
        return {
          patterns: [ ...obj.patterns, relationPattern ],
          selectionTriples: [ ...obj.selectionTriples, graphTriple ],
        };
      }, { patterns: [], selectionTriples: []});
  }

  private createRelationsQueryDataForInverseRelation(
    subject: Variable,
    predicate: NamedNode,
    relationsValue: FindOperator<InverseRelationOperatorValue, 'inverseRelation'>,
  ): RelationsQueryData {
    const variable = this.createVariable();
    const graphTriple = {
      subject: this.createVariable(),
      predicate: this.createVariable(),
      object: this.createVariable(),
    };
    const inverseRelationTriple = {
      subject,
      predicate: createSparqlInversePredicate([ predicate ]),
      object: variable,
    };
    if (typeof relationsValue.value === 'object' &&
      (relationsValue.value as InverseRelationOperatorValue).relations
    ) {
      const subRelationsQueryData = this.createRelationsQueryData(
        variable,
        (relationsValue.value as InverseRelationOperatorValue).relations,
      );
      const relationPattern = createSparqlOptional([
        createSparqlBasicGraphPattern([ inverseRelationTriple ]),
        createSparqlGraphPattern(
          variable,
          [ createSparqlBasicGraphPattern([ graphTriple ]) ],
        ),
        ...subRelationsQueryData.patterns,
      ]);
      return {
        patterns: [ relationPattern ],
        selectionTriples: [ graphTriple, ...subRelationsQueryData.selectionTriples ],
      };
    }
    const relationPattern = createSparqlOptional([
      createSparqlBasicGraphPattern([ inverseRelationTriple ]),
      createSparqlGraphPattern(
        variable,
        [ createSparqlBasicGraphPattern([ graphTriple ]) ],
      ),
    ]);
    return {
      patterns: [ relationPattern ],
      selectionTriples: [ graphTriple ],
    };
  }

  private createRelationsQueryDataForNestedRelation(
    subject: Variable,
    predicate: NamedNode,
    relationsValue: FindOptionsRelations,
  ): RelationsQueryData {
    const variable = this.createVariable();
    const graphTriple = {
      subject: this.createVariable(),
      predicate: this.createVariable(),
      object: this.createVariable(),
    };
    const relationTriple = { subject, predicate, object: variable };
    const subRelationsQueryData = this.createRelationsQueryData(
      variable,
      relationsValue,
    );
    const relationPattern = createSparqlOptional([
      createSparqlBasicGraphPattern([ relationTriple ]),
      createSparqlGraphPattern(
        variable,
        [ createSparqlBasicGraphPattern([ graphTriple ]) ],
      ),
      ...subRelationsQueryData.patterns,
    ]);
    return {
      patterns: [ relationPattern ],
      selectionTriples: [ graphTriple, ...subRelationsQueryData.selectionTriples ],
    };
  }

  private createVariable(): Variable {
    return DataFactory.variable(this.variableGenerator.getNext());
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

  private createWherePatternsFromQueryData(
    values: ValuesPattern[],
    triples: Triple[],
    filters: OperationExpression[],
    orderTriples?: Triple[],
    orderFilters?: OperationExpression[],
    serviceTriples?: Record<string, Triple[]>,
    additionalPatterns?: Pattern[],
  ): Pattern[] {
    let patterns: Pattern[] = values;
    if (triples.length > 0) {
      patterns.push(createSparqlBasicGraphPattern(triples));
    }
    if (orderTriples && orderTriples.length > 0) {
      const optionalPatterns: Pattern[] = [ createSparqlBasicGraphPattern(orderTriples) ];
      if (orderFilters && orderFilters.length > 0) {
        optionalPatterns.push(createFilterPatternFromFilters(orderFilters));
      }
      patterns.push(createSparqlOptional(optionalPatterns));
    }
    if (filters.length > 0) {
      patterns.push(createFilterPatternFromFilters(filters));
    }
    if (serviceTriples) {
      for (const [ service, sTriples ] of Object.entries(serviceTriples)) {
        patterns.unshift(createSparqlServicePattern(service, sTriples));
      }
    }
    if (additionalPatterns) {
      patterns = [ ...patterns, ...additionalPatterns ];
    }
    return patterns;
  }
}
