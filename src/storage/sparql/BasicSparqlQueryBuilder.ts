import type { Variable } from '@rdfjs/types';
import type {
  Pattern,
  ConstructQuery,
  Triple,
} from 'sparqljs';
import {
  entityVariable,
  createSparqlBasicGraphPattern,
  createSparqlGraphPattern,
  createSparqlOptionalGraphSelection,
  createSparqlConstructQuery,
  entityGraphTriple,
} from '../../util/SparqlUtil';
import type {
  FindOptionsOrder,
  FindOptionsRelations,
  FindOptionsSelect,
  FindOptionsWhere,
} from '../FindOptionsTypes';
import type { SparqlQueryBuilder } from './SparqlQueryBuilder';
import type { EntitySelectQueryData } from './SparqlQueryPatternBuilder';
import { SparqlQueryPatternBuilder } from './SparqlQueryPatternBuilder';

export interface BasicSparqlQueryBuilderOptions {
  where?: FindOptionsWhere;
  order?: FindOptionsOrder;
  relations?: FindOptionsRelations;
}

export class BasicSparqlQueryBuilder implements SparqlQueryBuilder {
  protected readonly sparqlQueryPatternBuilder: SparqlQueryPatternBuilder;

  public constructor() {
    this.sparqlQueryPatternBuilder = new SparqlQueryPatternBuilder();
  }

  public buildEntitySelectPatternsFromOptions(
    subject: Variable,
    options?: BasicSparqlQueryBuilderOptions,
  ): EntitySelectQueryData {
    return this.sparqlQueryPatternBuilder.buildEntitySelectPatternsFromOptions(
      subject,
      options?.where,
      options?.order,
      options?.relations,
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
}
