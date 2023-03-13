/* eslint-disable @typescript-eslint/method-signature-style */
import type { Variable } from '@rdfjs/types';
import type {
  Pattern,
  ConstructQuery,
  Triple,
} from 'sparqljs';
import type { FindAllOptions, FindOptionsSelect } from '../FindOptionsTypes';
import type { EntitySelectQueryData } from './SparqlQueryPatternBuilder';

export interface SparqlQueryBuilder {

  buildEntitySelectPatternsFromOptions<T extends FindAllOptions>(
    subject: Variable,
    options: T,
  ): EntitySelectQueryData;

  buildConstructFromEntitySelectQuery(
    graphWhere: Pattern[],
    graphSelectionTriples: Triple[],
    select?: FindOptionsSelect,
  ): ConstructQuery;
}
