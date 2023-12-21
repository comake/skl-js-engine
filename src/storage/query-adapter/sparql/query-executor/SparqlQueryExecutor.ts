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
  executeSparqlSelectAndGetData<
    TQuery extends SelectQuery | ConstructQuery,
    TReturn extends SelectVariableQueryResult<any> | Quad =
    TQuery extends SelectQuery ? SelectVariableQueryResult<any> : Quad
  >(
    query: TQuery,
  ): Promise<TReturn[]>;
  /**
   * Executes a raw SPARQL select query.
   */
  executeSparqlSelectAndGetDataRaw(
    query: string,
  ): Promise<SelectVariableQueryResult<any>[]>;
  /**
   * Executes a raw SPARQL construct query.
   */
  executeSparqlConstructAndGetDataRaw(
    query: string,
  ): Promise<Quad[]>;
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
