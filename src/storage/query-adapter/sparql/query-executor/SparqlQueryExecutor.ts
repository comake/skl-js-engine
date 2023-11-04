/* eslint-disable @typescript-eslint/method-signature-style */
import type { Quad, Literal, NamedNode } from '@rdfjs/types';
import type {
  Update,
  AskQuery,
  SelectQuery,
  ConstructQuery,
} from 'sparqljs';

export type SelectVariableQueryResult<T> = Record<keyof T, NamedNode | Literal>;

export interface QueryExecutor {
  /**
   * Executes a SPARQL select or construct query.
   */
  executeSparqlSelectAndGetData<T extends Quad | SelectVariableQueryResult<any> = Quad>(
    query: SelectQuery | ConstructQuery,
  ): Promise<T[]>;
  /**
   * Executes a raw SPARQL select query.
   */
  executeSparqlSelectAndGetDataRaw<T extends Quad | SelectVariableQueryResult<any> = Quad>(
    query: string,
  ): Promise<T[]>;
  /**
   * Executes a SPARQL update query.
   */
  executeSparqlUpdate(query: Update): Promise<void>;
  /**
   * Executes a raw SPARQL update query.
   */
  executeRawSparqlUpdate(query: string,): Promise<void>;
  /**
   * Executes a SPARQL ask query.
   */
  executeAskQueryAndGetResponse(query: AskQuery): Promise<boolean>;
  /**
   * Executes a SPARQL select query.
   */
  executeSelectCountAndGetResponse(query: SelectQuery): Promise<number>;
}
