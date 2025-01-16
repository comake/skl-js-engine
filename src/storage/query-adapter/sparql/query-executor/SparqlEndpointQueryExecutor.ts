import type { Quad, Literal } from '@rdfjs/types';
import SparqlClient from 'sparql-http-client';
import type {
  Update,
  SparqlGenerator,
  AskQuery,
  SelectQuery,
  ConstructQuery,
} from 'sparqljs';
import { Generator } from 'sparqljs';
import { Logger } from '../../../../logger';
import type { QueryExecutor, SelectVariableQueryResult } from './SparqlQueryExecutor';

export interface SparqlEndpointQueryExecutorOptions {
  /**
   * The location of the SPARQL endpoint. This value is required.
   */
  readonly endpointUrl: string;
  /**
   * The location of the SPARQL update endpoint. Defaults to the value of endpointUrl if not set.
   */
  readonly updateUrl?: string;
}

export class SparqlEndpointQueryExecutor implements QueryExecutor {
  private readonly sparqlClient: SparqlClient;
  private readonly sparqlGenerator: SparqlGenerator;

  public constructor(options: SparqlEndpointQueryExecutorOptions) {
    this.sparqlClient = new SparqlClient({
      endpointUrl: options.endpointUrl,
      updateUrl: options.updateUrl ?? options.endpointUrl,
    });
    this.sparqlGenerator = new Generator();
  }

  public async executeSparqlSelectAndGetData<
    TQuery extends SelectQuery | ConstructQuery,
    TReturn extends SelectVariableQueryResult<any> | Quad =
    TQuery extends SelectQuery ? SelectVariableQueryResult<any> : Quad
  >(
    query: TQuery,
  ): Promise<TReturn[]> {
    const generatedQuery = this.sparqlGenerator.stringify(query);
    return this.executeSparqlSelectAndGetDataRaw(generatedQuery);
  }

  public async executeSparqlSelectAndGetDataRaw<T extends Quad | SelectVariableQueryResult<any> = Quad>(
    query: string,
  ): Promise<T[]> {
    const stream = await this.sparqlClient.query.select(query, { operation: 'postUrlencoded' });
    return new Promise((resolve, reject): void => {
      const data: T[] = [];
      stream.on('data', (row): void => {
        data.push(row);
      });

      stream.on('end', (): void => {
        resolve(data);
      });

      stream.on('error', (error): void => {
        reject(error);
      });
    });
  }

  public async executeSparqlConstructAndGetDataRaw(query: string): Promise<Quad[]> {
    return await this.executeSparqlSelectAndGetDataRaw(query);
  }

  public async executeSparqlUpdate(query: Update): Promise<void> {
    const generatedQuery = this.sparqlGenerator.stringify(query);
    await this.executeRawSparqlUpdate(generatedQuery);
  }

  public async executeRawSparqlUpdate(query: string): Promise<void> {
    await this.sparqlClient.query.update(query);
  }

  public async executeAskQueryAndGetResponse(query: AskQuery): Promise<boolean> {
    const generatedQuery = this.sparqlGenerator.stringify(query);
    return await this.sparqlClient.query.ask(generatedQuery);
  }

  public async executeSelectCountAndGetResponse(query: SelectQuery): Promise<number> {
    const generatedQuery = this.sparqlGenerator.stringify(query);
    const stream = await this.sparqlClient.query.select(generatedQuery, { operation: 'postUrlencoded' });
    return new Promise((resolve, reject): void => {
      let countValue: number;
      stream.on('data', (row: { count: Literal }): void => {
        const { count } = row;
        countValue = Number.parseInt(count.value, 10);
      });

      stream.on('end', (): void => {
        resolve(countValue);
      });

      stream.on('error', (error): void => {
        reject(error);
      });
    });
  }
}
