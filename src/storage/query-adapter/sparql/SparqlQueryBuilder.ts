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
  GraphPattern,
  Grouping,
  SelectQuery,
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
  createSparqlExistsOperation,
  createSparqlContainsOperation,
  createSparqlLcaseOperation,
  createSparqlSelectQuery,
} from '../../../util/SparqlUtil';
import {
  valueToLiteral,
} from '../../../util/TripleUtil';
import type { OrArray } from '../../../util/Types';
import { isUrl } from '../../../util/Util';
import { RDF } from '../../../util/Vocabularies';
import { FindOperator } from '../../FindOperator';
import type {
  FieldPrimitiveValue,
  FindOptionsOrder,
  FindOptionsOrderValue,
  FindOptionsRelations,
  FindOptionsSelect,
  FindOptionsWhere,
  FindOptionsWhereField,
  IdFindOptionsWhereField,
  SubQuery,
  TypeFindOptionsWhereField,
  ValueWhereFieldObject,
  BindPattern,
} from '../../FindOptionsTypes';
import type { InverseRelationOperatorValue } from '../../operator/InverseRelation';
import type { InverseRelationOrderValue } from '../../operator/InverseRelationOrder';
import { VariableGenerator } from './VariableGenerator';
import { GroupByOptions, GroupByResponse } from '../../GroupOptionTypes';

export interface NonGraphWhereQueryData {
  values: ValuesPattern[];
  triples: Triple[];
  filters: OperationExpression[];
  patterns?: Pattern[];
  binds?: Pattern[];
}

export interface WhereQueryData extends NonGraphWhereQueryData {
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
  patterns?: Pattern[];
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
  subQueries?: SubQuery[];
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
    const whereQueryData = this.createWhereQueryData(subject, options?.where, true);
    const orderQueryData = this.createOrderQueryData(subject, options?.order);
    const relationsQueryData = this.createRelationsQueryData(subject, relations);
    // Handle subqueries
    if (options?.subQueries && options.subQueries.length > 0) {
      const subQueryPatterns = this.createSubQueryPatterns(options.subQueries);
      whereQueryData.values.unshift(...(subQueryPatterns as ValuesPattern[]));
    }
    const patterns: Pattern[] = whereQueryData.values;
    if (
      whereQueryData.triples.length === 0 &&
      (whereQueryData.filters.length > 0 ||
        orderQueryData.triples.length > 0 ||
        (whereQueryData.values.length === 0 &&
          whereQueryData.graphValues.length === 0 &&
          whereQueryData.graphTriples.length === 0))
    ) {
      const entityGraphFilterPattern = this.createEntityGraphFilterPattern(subject);
      patterns.push(entityGraphFilterPattern);
    } else if (!options?.where?.id) {
      const entityGraphFilterPattern = this.createEntityGraphFilterPattern(subject);
      const entityIsGraphFilter = createSparqlExistsOperation([entityGraphFilterPattern]);
      whereQueryData.filters.push(entityIsGraphFilter);
    }

    const wherePatterns = this.createWherePatternsFromQueryData(
      patterns,
      whereQueryData.triples,
      whereQueryData.filters,
      orderQueryData.triples,
      orderQueryData.filters,
      whereQueryData.patterns ?? [],
      undefined,
      whereQueryData.binds,
    );
    const graphWherePatterns = this.createWherePatternsFromQueryData(
      whereQueryData.graphValues,
      whereQueryData.graphTriples,
      whereQueryData.graphFilters,
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

  private createSubQueryPatterns(subQueries: SubQuery[]): Pattern[] {
    return subQueries.map((subQuery: SubQuery): Pattern => {
      const subQueryWhere = this.createWhereQueryData(entityVariable, subQuery.where);
      const queryGroup: Grouping[] = [];
      if (subQuery.groupBy && Array.isArray(subQuery.groupBy)) {
        subQuery.groupBy.forEach((group: string): void => {
          queryGroup.push({
            expression: DataFactory.variable(group),
          });
        });
      }
      const selectQuery: SelectQuery = {
        type: 'query',
        queryType: 'SELECT',
        variables: subQuery.select,
        where: this.createWherePatternsFromQueryData(
          subQueryWhere.values,
          subQueryWhere.triples,
          subQueryWhere.filters,
          undefined,
          undefined,
          subQueryWhere.patterns ?? [],
        ),
        group: queryGroup.length > 0 ? queryGroup : undefined,
        having: subQuery.having ? this.createWhereQueryData(entityVariable, subQuery.having).filters : undefined,
        prefixes: {},
      };
      return createSparqlSelectGroup([selectQuery]);
    });
  }

  private createEntityGraphFilterPattern(subject: Variable): GraphPattern {
    const entityFilterTriple = { subject, predicate: this.createVariable(), object: this.createVariable() };
    return createSparqlGraphPattern(subject, [createSparqlBasicGraphPattern([entityFilterTriple])]);
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
      where = [createSparqlOptional([createSparqlBasicGraphPattern(triples)]), ...graphWhere];
    } else {
      triples = [entityGraphTriple, ...graphSelectionTriples];
      where = [
        ...graphWhere,
        createSparqlGraphPattern(entityVariable, [createSparqlBasicGraphPattern([entityGraphTriple])]),
      ];
    }
    return createSparqlConstructQuery(triples, where);
  }

  private createWhereQueryData(subject: Variable, where?: FindOptionsWhere, isTopLevel = false): WhereQueryData {
    if (isTopLevel && Object.keys(where ?? {}).length === 1 && 'id' in where!) {
      const { values, filters, triples } = this.createWhereQueryDataForIdValue(subject, where.id!);
      return {
        values: [],
        filters: [],
        triples: [],
        graphValues: values,
        graphFilters: filters,
        graphTriples: triples,
        binds: [],
      };
    }

    // Handle binds if specified in where options
    const binds: Pattern[] = [];
    if (where?.binds) {
      binds.push(...where.binds.map(bind => ({
        type: 'bind' as const,
        expression: bind.expression,
        variable: bind.variable
      })));
      // Delete binds from where as it's a special key
      const { binds: _, ...restWhere } = where;
      where = restWhere;
    }

    const whereQueryData = Object.entries(where ?? {}).reduce(
      (obj: NonGraphWhereQueryData, [key, value]): NonGraphWhereQueryData => {
        const whereQueryDataForField = this.createWhereQueryDataForField(subject, key, value!);
        return {
          values: [...obj.values, ...whereQueryDataForField.values],
          triples: [...obj.triples, ...whereQueryDataForField.triples],
          filters: [...obj.filters, ...whereQueryDataForField.filters],
          patterns: [...(obj.patterns ?? []), ...(whereQueryDataForField.patterns ?? [])],
          binds: [...(obj.binds ?? []), ...(whereQueryDataForField.binds ?? [])],
        };
      },
      { values: [], triples: [], filters: [], patterns: [], binds }
    );

    return {
      ...whereQueryData,
      graphValues: [],
      graphFilters: [],
      graphTriples: [],
      patterns: whereQueryData.patterns ?? [],
      binds: whereQueryData.binds ?? [],
    };
  }

  private createWhereQueryDataForField(
    subject: Variable,
    field: string,
    value: IdFindOptionsWhereField | TypeFindOptionsWhereField | FindOptionsWhereField,
  ): NonGraphWhereQueryData {
    if (field === 'id') {
      return this.createWhereQueryDataForIdValue(subject, value as FindOperator<any, any>);
    }
    if (field === 'type') {
      return this.createWhereQueryDataForType(subject, value as FindOperator<any, any>);
    }
    const predicate = DataFactory.namedNode(field);
    return this.createWhereQueryDataFromKeyValue(subject, predicate, value);
  }

  private createWhereQueryDataForIdValue(term: Variable, value: IdFindOptionsWhereField): NonGraphWhereQueryData {
    let filters: OperationExpression[] = [];
    let values: ValuesPattern[] = [];
    let triples: Triple[] = [];
    if (FindOperator.isFindOperator(value)) {
      ({ filters, values, triples } = this.resolveFindOperatorAsExpressionForId(
        term,
        value as FindOperator<string, any>,
      ));
    } else {
      values = [
        {
          type: 'values',
          values: [
            {
              [`?${term.value}`]: DataFactory.namedNode(value as string),
            },
          ],
        },
      ];
    }
    return {
      values,
      filters,
      triples,
    };
  }

  private createWhereQueryDataForType(subject: Variable, value: TypeFindOptionsWhereField): NonGraphWhereQueryData {
    if (FindOperator.isFindOperator(value)) {
      if ((value as FindOperator<any, any>).operator === 'inverse') {
        const inversePredicate = createSparqlInversePredicate([allTypesAndSuperTypesPath]);
        const inverseWhereQueryData = this.createWhereQueryDataFromKeyValue(
          subject,
          inversePredicate,
          (value as FindOperator<any, any>).value,
        );
        return {
          values: inverseWhereQueryData.values,
          filters: inverseWhereQueryData.filters,
          triples: inverseWhereQueryData.triples,
        };
      }
      if ((value as FindOperator<any, any>).operator === 'sequence') {
        const sequencePredicate = createSparqlSequencePredicate([allTypesAndSuperTypesPath]);
        return this.createWhereQueryDataFromKeyValue(
          subject,
          sequencePredicate,
          (value as FindOperator<any, any>).value,
        );
      }

      const variable = this.createVariable();
      const triple = { subject, predicate: allTypesAndSuperTypesPath, object: variable };
      const { filter, valuePattern, tripleInFilter } = this.resolveFindOperatorAsExpressionWithMultipleValues(
        variable,
        value as FindOperator<string, any>,
        triple,
      );
      return {
        values: valuePattern ? [valuePattern] : [],
        filters: filter ? [filter] : [],
        triples: tripleInFilter ? [] : [triple],
      };
    }
    return {
      values: [],
      filters: [],
      triples: [
        {
          subject,
          predicate: allTypesAndSuperTypesPath,
          object: DataFactory.namedNode(value as string),
        },
      ],
    };
  }

  private createWhereQueryDataFromKeyValue(
    subject: Variable,
    predicate: IriTerm | PropertyPath,
    value: FindOptionsWhereField,
  ): NonGraphWhereQueryData {
    if (Array.isArray(value) && FindOperator.isFindOperator(value[0])) {
      return this.createWhereQueryDataForMultipleFindOperators(subject, predicate, value as FindOperator<any, any>[]);
    }
    if (FindOperator.isFindOperator(value)) {
      return this.createWhereQueryDataForFindOperator(subject, predicate, value as FindOperator<any, any>);
    }
    if (Array.isArray(value)) {
      return (value as FieldPrimitiveValue[]).reduce(
        (obj: NonGraphWhereQueryData, valueItem): NonGraphWhereQueryData => {
          const valueWhereQueryData = this.createWhereQueryDataFromKeyValue(subject, predicate, valueItem);
          return {
            values: [...obj.values, ...valueWhereQueryData.values],
            filters: [...obj.filters, ...valueWhereQueryData.filters],
            triples: [...obj.triples, ...valueWhereQueryData.triples],
            patterns: [...(obj.patterns ?? []), ...(valueWhereQueryData.patterns ?? [])],
          };
        },
        { values: [], filters: [], triples: [], patterns: [] },
      );
    }
    if (typeof value === 'object') {
      if ('@value' in value) {
        return this.createWhereQueryDataForValueObject(
          'subject' in value ? (value.subject as unknown as Variable) : subject,
          predicate,
          value as ValueWhereFieldObject,
        );
      }
      return this.createWhereQueryDataForNestedWhere(subject, predicate, value as FindOptionsWhere);
    }
    const term = this.resolveValueToTerm(value);
    return {
      values: [],
      filters: [],
      triples: [{ subject, predicate, object: term }],
    };
  }

  private createWhereQueryDataForFindOperator(
    subject: Variable,
    predicate: IriTerm | PropertyPath,
    operator: FindOperator<any, any>,
  ): NonGraphWhereQueryData {
    if (operator.operator === 'inverse') {
      const inversePredicate = createSparqlInversePredicate([predicate]);
      return this.createWhereQueryDataFromKeyValue(subject, inversePredicate, operator.value);
    }
    if (operator.operator === 'sequence') {
      const sequencePredicate = createSparqlSequencePredicate([predicate]);
      return this.createWhereQueryDataFromKeyValue(
        operator.subject ? operator.subject : subject,
        sequencePredicate,
        operator.value,
      );
    }
    if (FindOperator.isPathOperator(operator)) {
      const pathPredicate = this.pathOperatorToPropertyPath(operator);
      const combinedPredicate = createSparqlSequencePredicate([predicate, pathPredicate]);
      return this.createWhereQueryDataFromKeyValue(subject, combinedPredicate, operator.value.value);
    }
    const variable = this.createVariable();
    const triple = { subject, predicate, object: variable };
    const { filter, valuePattern, tripleInFilter } = this.resolveFindOperatorAsExpressionWithMultipleValues(
      variable,
      operator,
      triple,
    );
    return {
      values: valuePattern ? [valuePattern] : [],
      filters: filter ? [filter] : [],
      triples: tripleInFilter ? [] : [triple],
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
      return createSparqlInversePredicate([subPredicate]);
    }
    if (operator.operator === 'sequencePath') {
      const { subPath } = operator.value;
      const subPredicates = subPath.map((sequencePart: string | FindOperator<any, any>): IriTerm | PropertyPath => {
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
      return createSparqlZeroOrMorePredicate([subPredicate]);
    }
    if (operator.operator === 'oneOrMorePath') {
      const { subPath } = operator.value;
      let subPredicate: IriTerm | PropertyPath;
      if (typeof subPath === 'string') {
        subPredicate = DataFactory.namedNode(subPath);
      } else {
        subPredicate = this.pathOperatorToPropertyPath(subPath);
      }
      return createSparqlOneOrMorePredicate([subPredicate]);
    }
    throw new Error(`Operator ${operator.operator} not supported`);
  }

  private createWhereQueryDataForMultipleFindOperators(
    subject: Variable,
    predicate: IriTerm | PropertyPath,
    operators: FindOperator<any, any>[],
  ): NonGraphWhereQueryData {
    const variable = this.createVariable();
    const triple = { subject, predicate, object: variable };
    const whereQueryData = {
      values: [],
      filters: [],
      triples: [triple],
    };
    return operators.reduce((obj: NonGraphWhereQueryData, operator): NonGraphWhereQueryData => {
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
  ): NonGraphWhereQueryData {
    const subNodeVariable = this.createVariable();
    const subWhereQueryData = this.createWhereQueryData(subNodeVariable, where);
    return {
      values: [...subWhereQueryData.values, ...subWhereQueryData.graphValues],
      filters: subWhereQueryData.filters,
      triples: [{ subject, predicate, object: subNodeVariable }, ...subWhereQueryData.triples],
      patterns: [...(subWhereQueryData.patterns ?? [])],
    };
  }

  private createWhereQueryDataForValueObject(
    subject: Variable,
    predicate: IriTerm | PropertyPath,
    valueObject: ValueWhereFieldObject,
  ): NonGraphWhereQueryData {
    const term = this.valueObjectToTerm(valueObject);
    if ((valueObject as any).isOptional) {
      return {
        values: [],
        filters: [],
        triples: [],
        patterns: [createSparqlOptional([createSparqlBasicGraphPattern([{ subject, predicate, object: term }])])],
      };
    }
    return {
      values: [],
      filters: [],
      triples: [{ subject, predicate, object: term }],
    };
  }

  private valueObjectToTerm(valueObject: ValueWhereFieldObject): Literal | Variable {
    let typeOrLanguage: string;
    let value: string;
    if ('@type' in valueObject && valueObject['@type'] === '@json') {
      typeOrLanguage = RDF.JSON;
      value = JSON.stringify(valueObject['@value']);
    } else {
      typeOrLanguage = ('@type' in valueObject ? valueObject['@type'] : valueObject['@language'])!;
      value = (valueObject['@value'] as FieldPrimitiveValue).toString();
    }
    return valueToLiteral(value, typeOrLanguage);
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
    if (operator.operator === 'exists') {
      return {
        filter: createSparqlExistsOperation([createSparqlBasicGraphPattern([triple])]),
        tripleInFilter: true,
      };
    }

    if (operator.operator === 'contains') {
      const searchString = this.resolveValueToExpression(operator.value) as Literal;
      const filter = createSparqlContainsOperation(
        // Directly use the variable as an expression
        createSparqlLcaseOperation(DataFactory.variable(leftSide.value)),
        createSparqlLcaseOperation(DataFactory.literal(searchString.value.toLowerCase())),
      );
      return {
        filter,
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
  ): NonGraphWhereQueryData {
    switch (operator.operator) {
      case 'inversePath': {
        const predicate = this.pathOperatorToPropertyPath(operator);
        return this.createWhereQueryDataFromKeyValue(leftSide, predicate, operator.value.value);
      }
      case 'in': {
        const resolvedValue = this.resolveValueToExpression(operator.value) as NamedNode[];
        return {
          triples: [],
          filters: [],
          values: [
            {
              type: 'values',
              values: resolvedValue.map((value): ValuePatternRow => ({ [`?${leftSide.value}`]: value })),
            },
          ],
        };
      }
      case 'not':
        return {
          triples: [],
          values: [],
          filters: [
            this.buildNotOperationForId(
              leftSide,
              this.resolveValueToExpression(operator.value) as Expression | FindOperator<any, any>,
            ),
          ],
        };
      case 'equal':
        return {
          triples: [],
          values: [],
          filters: [createSparqlEqualOperation(leftSide, this.resolveValueToExpression(operator.value) as Expression)],
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
    const isFindOperator = FindOperator.isFindOperator(rightSide);
    if (isFindOperator && (rightSide as FindOperator<any, any>).operator === 'exists') {
      return createSparqlNotExistsOperation([createSparqlBasicGraphPattern([triple])]);
    }
    if (isFindOperator) {
      let expression: OperationExpression | undefined;
      try {
        ({ filter: expression } = this.resolveFindOperatorAsExpressionWithMultipleValues(
          leftSide,
          rightSide as FindOperator<any, any>,
          triple,
          true,
        ));
      } catch {
        throw new Error(`Unsupported Not sub operator "${(rightSide as FindOperator<any, any>).operator}"`);
      }
      filterExpression = createSparqlFilterWithExpression(expression!);
    } else {
      filterExpression = createSparqlFilterWithExpression(
        createSparqlEqualOperation(leftSide, rightSide as Expression),
      );
    }
    return createSparqlNotExistsOperation([
      createSparqlSelectGroup([createSparqlBasicGraphPattern([triple]), filterExpression]),
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

  private resolveValueToTerm(value: FieldPrimitiveValue | ValueWhereFieldObject): NamedNode | Literal | Variable {
    if (typeof value === 'object' && '@value' in value) {
      return valueToLiteral((value as ValueWhereFieldObject)['@value'], '@type' in value ? value['@type'] : undefined);
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
      return { triples: [], orders: [], filters: [] };
    }
    return Object.entries(order).reduce(
      (obj: OrderQueryData, [property, orderValue]): OrderQueryData => {
        const orderQueryData = this.createOrderQueryDataForProperty(subject, property, orderValue, isNested);
        obj.orders = [...obj.orders, ...orderQueryData.orders];
        obj.triples = [...obj.triples, ...orderQueryData.triples];
        obj.filters = [...obj.filters, ...orderQueryData.filters];
        obj.groupByParent = obj.groupByParent ?? orderQueryData.groupByParent;
        return obj;
      },
      { triples: [], orders: [], filters: [] },
    );
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
        predicate: createSparqlInversePredicate([predicate]),
        object: variable,
      };
      const subRelationOperatorValue = (orderValue as FindOperator<InverseRelationOrderValue, 'inverseRelationOrder'>)
        .value as InverseRelationOrderValue;
      const subRelationOrderQueryData = this.createOrderQueryData(variable, subRelationOperatorValue.order, true);
      const subRelationWhereQueryData = this.createWhereQueryData(variable, subRelationOperatorValue.where);
      return {
        triples: [inverseRelationTriple, ...subRelationOrderQueryData.triples, ...subRelationWhereQueryData.triples],
        filters: subRelationWhereQueryData.filters,
        orders: subRelationOrderQueryData.orders,
        groupByParent: true,
        patterns: [...(subRelationWhereQueryData.patterns ?? []), ...(subRelationOrderQueryData.patterns ?? [])],
      };
    }
    if (property === 'id') {
      return {
        triples: [],
        filters: [],
        orders: [
          {
            expression: subject,
            descending: orderValue === 'DESC' || orderValue === 'desc',
          },
        ],
      };
    }
    const variable = this.createVariable();
    const isDescending = orderValue === 'DESC' || orderValue === 'desc';
    return {
      triples: [{ subject, predicate, object: variable }],
      filters: [],
      orders: [
        {
          expression: isNested
            ? {
                type: 'aggregate',
                expression: variable,
                aggregation: isDescending ? 'max' : 'min',
              }
            : variable,
          descending: isDescending,
        },
      ],
    };
  }

  private createRelationsQueryData(subject: Variable, relations?: FindOptionsRelations): RelationsQueryData {
    if (!relations) {
      return { patterns: [], selectionTriples: [] };
    }
    return Object.entries(relations).reduce(
      (obj: RelationsQueryData, [property, relationsValue]): RelationsQueryData => {
        const predicate = DataFactory.namedNode(property);
        if (typeof relationsValue === 'object') {
          if (FindOperator.isFindOperator(relationsValue)) {
            const { patterns, selectionTriples } = this.createRelationsQueryDataForInverseRelation(
              subject,
              predicate,
              relationsValue as FindOperator<InverseRelationOperatorValue, 'inverseRelation'>,
            );
            return {
              patterns: [...obj.patterns, ...patterns],
              selectionTriples: [...obj.selectionTriples, ...selectionTriples],
            };
          }
          const { patterns, selectionTriples } = this.createRelationsQueryDataForNestedRelation(
            subject,
            predicate,
            relationsValue as FindOptionsRelations,
          );
          return {
            patterns: [...obj.patterns, ...patterns],
            selectionTriples: [...obj.selectionTriples, ...selectionTriples],
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
          createSparqlGraphPattern(variable, [createSparqlBasicGraphPattern([graphTriple])]),
        ]);
        return {
          patterns: [...obj.patterns, relationPattern],
          selectionTriples: [...obj.selectionTriples, graphTriple],
        };
      },
      { patterns: [], selectionTriples: [] },
    );
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
      predicate: createSparqlInversePredicate([predicate]),
      object: variable,
    };
    if (typeof relationsValue.value === 'object' && (relationsValue.value as InverseRelationOperatorValue).relations) {
      const subRelationsQueryData = this.createRelationsQueryData(
        variable,
        (relationsValue.value as InverseRelationOperatorValue).relations,
      );
      const relationPattern = createSparqlOptional([
        createSparqlBasicGraphPattern([inverseRelationTriple]),
        createSparqlGraphPattern(variable, [createSparqlBasicGraphPattern([graphTriple])]),
        ...subRelationsQueryData.patterns,
      ]);
      return {
        patterns: [relationPattern],
        selectionTriples: [graphTriple, ...subRelationsQueryData.selectionTriples],
      };
    }
    const relationPattern = createSparqlOptional([
      createSparqlBasicGraphPattern([inverseRelationTriple]),
      createSparqlGraphPattern(variable, [createSparqlBasicGraphPattern([graphTriple])]),
    ]);
    return {
      patterns: [relationPattern],
      selectionTriples: [graphTriple],
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
    const subRelationsQueryData = this.createRelationsQueryData(variable, relationsValue);
    const relationPattern = createSparqlOptional([
      createSparqlBasicGraphPattern([relationTriple]),
      createSparqlGraphPattern(variable, [createSparqlBasicGraphPattern([graphTriple])]),
      ...subRelationsQueryData.patterns,
    ]);
    return {
      patterns: [relationPattern],
      selectionTriples: [graphTriple, ...subRelationsQueryData.selectionTriples],
    };
  }

  private createVariable(): Variable {
    return DataFactory.variable(this.variableGenerator.getNext());
  }

  private createSelectPattern(select: FindOptionsSelect, subject: Variable): Triple[] {
    if (Array.isArray(select)) {
      return select.map(
        (selectPredicate): Triple => ({
          subject,
          predicate: DataFactory.namedNode(selectPredicate),
          object: this.createVariable(),
        }),
      );
    }
    return Object.entries(select).reduce((arr: Triple[], [key, value]): Triple[] => {
      const variable = this.createVariable();
      arr.push({ subject, predicate: DataFactory.namedNode(key), object: variable });
      if (typeof value === 'object') {
        arr = [...arr, ...this.createSelectPattern(value, variable)];
      }
      return arr;
    }, []);
  }

  private createWherePatternsFromQueryData(
    initialPatterns: Pattern[],
    triples: Triple[],
    filters: OperationExpression[],
    orderTriples?: Triple[],
    orderFilters?: OperationExpression[],
    additionalPatterns?: Pattern[],
    serviceTriples?: Record<string, Triple[]>,
    binds?: Pattern[],
  ): Pattern[] {
    let patterns = initialPatterns;

    // Add binds at the beginning if they exist
    if (binds && binds.length > 0) {
      patterns = [...patterns, ...binds];
    }

    if (triples.length > 0) {
      patterns.push(createSparqlBasicGraphPattern(triples));
    }
    if (orderTriples && orderTriples.length > 0) {
      const optionalPatterns: Pattern[] = [createSparqlBasicGraphPattern(orderTriples)];
      if (orderFilters && orderFilters.length > 0) {
        optionalPatterns.push(createFilterPatternFromFilters(orderFilters));
      }
      patterns.push(createSparqlOptional(optionalPatterns));
    }
    if (filters.length > 0) {
      patterns.push(createFilterPatternFromFilters(filters));
    }
    if (serviceTriples) {
      for (const [service, sTriples] of Object.entries(serviceTriples)) {
        patterns.unshift(createSparqlServicePattern(service, sTriples));
      }
    }
    if (additionalPatterns) {
      patterns = [...patterns, ...additionalPatterns];
    }
    return patterns;
  }

  private createGroupPatternForPath(
    entityVariable: Variable,
    path: string,
  ): {
    variable: Variable;
    patterns: Pattern[];
  } {
    const segments = path.split('~');
    let currentSubject = entityVariable;
    const patterns: Pattern[] = [];

    // Create a chain of patterns for each segment
    segments.forEach((predicate, index) => {
      const object = this.createVariable();
      patterns.push({
        type: 'bgp',
        triples: [
          {
            subject: currentSubject,
            predicate: DataFactory.namedNode(predicate),
            object: object,
          },
        ],
      });
      currentSubject = object;
    });

    // Return the final variable (last object) and all patterns
    return {
      variable: currentSubject,
      patterns,
    };
  }

  public async buildGroupByQuery(
    options: GroupByOptions,
  ): Promise<{ query: SelectQuery; variableMapping: Record<string, string> }> {
    const entityVariable = DataFactory.variable('entity');
    const queryData = this.buildEntitySelectPatternsFromOptions(entityVariable, {
      where: options.where || {},
    });

    // Add group variables and patterns with mapping
    const groupVariables: Variable[] = [];
    const groupPatterns: Pattern[] = [];
    const variableMapping: Record<string, string> = {};

    if (options.groupBy) {
      options.groupBy.forEach((path) => {
        const { variable: groupVar, patterns } = this.createGroupPatternForPath(entityVariable, path);
        groupVariables.push(groupVar);
        variableMapping[groupVar.value] = path;
        groupPatterns.push(...patterns);
      });
    }

    // Add date handling if specified
    if (options.dateRange) {
      const dateVar = this.createVariable();
      variableMapping[dateVar.value] = 'date';

      const datePattern: Pattern = {
        type: 'bgp',
        triples: [
          {
            subject: entityVariable,
            predicate: DataFactory.namedNode('http://purl.org/dc/terms/created'),
            object: dateVar,
          },
        ],
      };

      const dateFilter: FilterPattern = {
        type: 'filter',
        expression: {
          type: 'operation',
          operator: '&&',
          args: [
            {
              type: 'operation',
              operator: '>=',
              args: [
                dateVar,
                DataFactory.literal(options.dateRange.start, 'http://www.w3.org/2001/XMLSchema#dateTime'),
              ],
            },
            {
              type: 'operation',
              operator: '<=',
              args: [dateVar, DataFactory.literal(options.dateRange.end, 'http://www.w3.org/2001/XMLSchema#dateTime')],
            },
          ],
        },
      };

      groupPatterns.push(datePattern, dateFilter);

      if (options.dateGrouping) {
        const dateGroupVar = this.createVariable();
        groupVariables.push(dateGroupVar);
        variableMapping[dateGroupVar.value] = 'dateGroup';

        const dateGroupBind = this.createDateGroupingBind(dateVar, dateGroupVar, options.dateGrouping);
        groupPatterns.push(dateGroupBind);
      }
    }

    // Create count and entityIds variables
    const countVar = this.createVariable();
    const entityIdsVar = this.createVariable();
    variableMapping[countVar.value] = 'count';
    variableMapping[entityIdsVar.value] = 'entityIds';

    // Combine all patterns
    const combinedWhere = [...queryData.where, ...groupPatterns];

    // Create select query with aggregations
    const selectQuery = createSparqlSelectQuery(
      [
        ...groupVariables,
        {
          expression: {
            type: 'aggregate',
            aggregation: 'count',
            distinct: true,
            expression: entityVariable,
          },
          variable: countVar,
        },
        {
          expression: {
            type: 'aggregate',
            aggregation: 'group_concat',
            distinct: true,
            separator: ' ',
            expression: entityVariable,
          },
          variable: entityIdsVar,
        },
      ],
      combinedWhere,
      [], // orders
      groupVariables.length > 0 ? groupVariables : undefined, // group by
      options.limit,
      options.offset,
    );

    return { query: selectQuery, variableMapping };
  }

  // Helper function for date grouping
  private createDateGroupingBind(dateVar: Variable, dateGroupVar: Variable, grouping: 'month' | 'day'): Pattern {
    return {
      type: 'bind',
      expression: {
        type: 'operation',
        operator: 'CONCAT',
        args: [
          this.createYearExpression(dateVar),
          DataFactory.literal('-'),
          this.createMonthExpression(dateVar),
          ...this.createDayExpressionParts(dateVar, grouping),
        ],
      },
      variable: dateGroupVar,
    };
  }

  private createYearExpression(dateVar: Variable): Expression {
    return {
      type: 'operation',
      operator: 'STR',
      args: [
        {
          type: 'operation',
          operator: 'YEAR',
          args: [dateVar],
        },
      ],
    };
  }

  private createMonthExpression(dateVar: Variable): Expression {
    return this.createPaddedDatePartExpression(dateVar, 'MONTH');
  }

  private createDayExpression(dateVar: Variable): Expression {
    return this.createPaddedDatePartExpression(dateVar, 'DAY');
  }

  private createPaddedDatePartExpression(dateVar: Variable, datePart: 'MONTH' | 'DAY'): Expression {
    const comparisonValue = DataFactory.literal(
      '10',
      DataFactory.namedNode('http://www.w3.org/2001/XMLSchema#integer'),
    );

    return {
      type: 'operation',
      operator: 'IF',
      args: [
        this.createLessThanComparison(dateVar, datePart, comparisonValue),
        this.createPaddedStringExpression(dateVar, datePart),
        this.createUnpaddedStringExpression(dateVar, datePart),
      ],
    };
  }

  private createLessThanComparison(dateVar: Variable, datePart: 'MONTH' | 'DAY', comparisonValue: Term): Expression {
    return {
      type: 'operation',
      operator: '<',
      args: [
        {
          type: 'operation',
          operator: datePart,
          args: [dateVar],
        } as Expression,
        comparisonValue as Expression,
      ],
    };
  }

  private createPaddedStringExpression(dateVar: Variable, datePart: 'MONTH' | 'DAY'): Expression {
    return {
      type: 'operation',
      operator: 'CONCAT',
      args: [DataFactory.literal('0'), this.createUnpaddedStringExpression(dateVar, datePart)],
    };
  }

  private createUnpaddedStringExpression(dateVar: Variable, datePart: 'MONTH' | 'DAY'): Expression {
    return {
      type: 'operation',
      operator: 'STR',
      args: [
        {
          type: 'operation',
          operator: datePart,
          args: [dateVar],
        },
      ],
    };
  }

  private createDayExpressionParts(dateVar: Variable, grouping: 'month' | 'day'): Expression[] {
    if (grouping === 'day') {
      return [DataFactory.literal('-'), this.createDayExpression(dateVar)];
    }
    return [DataFactory.literal('')];
  }
}
