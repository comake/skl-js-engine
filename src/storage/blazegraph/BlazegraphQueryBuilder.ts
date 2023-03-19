import DataFactory from '@rdfjs/data-model';
import type { Variable } from '@rdfjs/types';
import type {
  Pattern,
  IriTerm,
  ConstructQuery,
  PropertyPath,
  Triple,
} from 'sparqljs';
import {
  searchPredicate,
  anyPredicatePropertyPath,
  entityVariable,
  createSparqlBasicGraphPattern,
  createSparqlGraphPattern,
  createSparqlOptionalGraphSelection,
  createSparqlInversePredicate,
  createSparqlOrPredicate,
  createSparqlPathPredicate,
  createSparqlConstructQuery,
  entityGraphTriple,
} from '../../util/SparqlUtil';
import { FindOperator } from '../FindOperator';
import type {
  FindOptionsOrder,
  FindOptionsRelations,
  FindOptionsSelect,
  FindOptionsWhere,
} from '../FindOptionsTypes';
import type { InverseRelationOperatorValue } from '../operator/InverseRelation';
import type { SparqlQueryBuilder } from '../sparql/SparqlQueryBuilder';
import type { EntitySelectQueryData } from '../sparql/SparqlQueryPatternBuilder';
import { SparqlQueryPatternBuilder } from '../sparql/SparqlQueryPatternBuilder';

export const BLAZEGRAPH_FULLTEXT_SERVICE = 'http://www.bigdata.com/rdf/search#search';

export interface BlazegraphQueryBuilderOptions {
  search?: string;
  select?: FindOptionsSelect;
  where?: FindOptionsWhere;
  relations?: FindOptionsRelations;
  order?: FindOptionsOrder;
  searchRelations?: boolean;
}

export class BlazegraphQueryBuilder implements SparqlQueryBuilder {
  private readonly sparqlQueryPatternBuilder: SparqlQueryPatternBuilder;

  public constructor() {
    this.sparqlQueryPatternBuilder = new SparqlQueryPatternBuilder();
  }

  public buildEntitySelectPatternsFromOptions(
    subject: Variable,
    options?: BlazegraphQueryBuilderOptions,
  ): EntitySelectQueryData {
    const serviceTriples: Record<string, Triple[]> = {};
    const baseTriples: Triple[] = [];
    if (options?.search) {
      const searchVariable = this.sparqlQueryPatternBuilder.createVariable();
      serviceTriples[BLAZEGRAPH_FULLTEXT_SERVICE] = [{
        subject: searchVariable,
        predicate: searchPredicate,
        object: DataFactory.literal(options?.search),
      }];
      baseTriples.push({
        subject,
        predicate: this.createSearchPredicatePath(options.relations, options.searchRelations),
        object: searchVariable,
      });
    }
    return this.sparqlQueryPatternBuilder.buildEntitySelectPatternsFromOptions(
      subject,
      options?.where,
      options?.order,
      options?.relations,
      serviceTriples,
      baseTriples,
    );
  }

  public buildConstructFromEntitySelectQuery(
    graphWhere: Pattern[],
    graphSelectionTriples: Triple[],
    select?: FindOptionsSelect,
  ): ConstructQuery {
    let triples: Triple[];
    let where: Pattern[] = [];
    if (select) {
      // eslint-disable-next-line unicorn/expiring-todo-comments
      // TODO: fix when select and relations are used.
      triples = this.sparqlQueryPatternBuilder.createSelectPattern(select, entityVariable);
      where = [
        createSparqlOptionalGraphSelection(entityVariable, triples),
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

  private createSearchPredicatePath(relations?: FindOptionsRelations, searchRelations?: boolean): PropertyPath {
    if (searchRelations && relations) {
      const relationsPaths = this.relationsToPropertyPaths(relations);
      return createSparqlOrPredicate([
        anyPredicatePropertyPath,
        ...relationsPaths.map((path): PropertyPath =>
          createSparqlPathPredicate([ ...path, anyPredicatePropertyPath ])),
      ]);
    }
    return anyPredicatePropertyPath;
  }

  private relationsToPropertyPaths(
    relations: FindOptionsRelations,
    nestedPathParts: (IriTerm | PropertyPath)[] = [],
  ): (IriTerm | PropertyPath)[][] {
    return Object.entries(relations)
      .reduce((arr: (IriTerm | PropertyPath)[][], [ field, value ]): (IriTerm | PropertyPath)[][] =>
        [ ...arr, ...this.relationToPropertyPaths(field, value, nestedPathParts) ]
      , []);
  }

  private relationToPropertyPaths(
    relationName: string,
    relationsValue: FindOptionsRelations[string],
    nestedPathParts: (IriTerm | PropertyPath)[],
  ): (IriTerm | PropertyPath)[][] {
    let predicate: IriTerm | PropertyPath;
    let subRelations: FindOptionsRelations | undefined;
    if (typeof relationsValue === 'object') {
      if (FindOperator.isFindOperator(relationsValue)) {
        predicate = createSparqlInversePredicate([
          DataFactory.namedNode(relationName),
        ]);
        subRelations = (relationsValue.value as InverseRelationOperatorValue).relations;
      } else {
        predicate = DataFactory.namedNode(relationName) as IriTerm;
        subRelations = relationsValue as FindOptionsRelations;
      }
    } else {
      predicate = DataFactory.namedNode(relationName) as IriTerm;
    }
    const newPathParts = [ ...nestedPathParts, predicate ];
    if (subRelations) {
      return [
        newPathParts,
        ...this.relationsToPropertyPaths(subRelations, newPathParts),
      ];
    }
    return [ newPathParts ];
  }
}
