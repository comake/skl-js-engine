import { QueryEngine } from '@comunica/query-sparql-rdfjs';
import type { Quad, QueryStringContext, QuerySourceContext } from '@rdfjs/types';
import { Store } from 'n3';

import type {
  Update,
  SparqlGenerator,
  AskQuery,
  SelectQuery,
  ConstructQuery,
} from 'sparqljs';
import { Generator } from 'sparqljs';
import type { QueryExecutor, SelectVariableQueryResult } from './SparqlQueryExecutor';

export class InMemorySparqlQueryExecutor implements QueryExecutor {
  private readonly engine: QueryEngine;
  private readonly store: Store;
  private readonly sparqlGenerator: SparqlGenerator;
  private readonly queryContext: QueryStringContext & QuerySourceContext<Store>;

  public constructor() {
    this.sparqlGenerator = new Generator();
    this.store = new Store();
    this.engine = new QueryEngine();
    this.queryContext = {
      sources: [ this.store ],
      unionDefaultGraph: true,
    };
  }

  public async executeSparqlSelectAndGetData<T extends Quad | SelectVariableQueryResult<any> = Quad>(
    query: SelectQuery | ConstructQuery,
  ): Promise<T[]> {
    const generatedQuery = this.sparqlGenerator.stringify(query);
    return this.executeSparqlSelectAndGetDataRaw(generatedQuery, query.queryType === 'CONSTRUCT');
  }

  public async executeSparqlSelectAndGetDataRaw<T extends Quad | SelectVariableQueryResult<any> = Quad>(
    query: string,
    isConstruct = false,
  ): Promise<T[]> {
    const stream = await this.engine[isConstruct ? 'queryQuads' : 'queryBindings'](
      query,
      this.queryContext,
    );
    return new Promise((resolve, reject): void => {
      const data: T[] = [];
      stream.on('data', (row): void => {
        if (row.termType === 'Quad') {
          data.push(row);
        } else if (row.type === 'bindings' && row.entries.size > 0) {
          const bindingRow: SelectVariableQueryResult<any> = {};
          for (const [ key, value ] of row.entries) {
            bindingRow[key] = value;
          }
          data.push(bindingRow as T);
        }
      });

      stream.on('end', (): void => {
        resolve(data);
      });

      stream.on('error', (error): void => {
        reject(error);
      });
    });
  }

  public async executeSparqlUpdate(query: Update): Promise<void> {
    if ((query?.updates?.length ?? 0) > 0) {
      const generatedQuery = this.sparqlGenerator.stringify(query);
      await this.engine.queryVoid(
        generatedQuery,
        this.queryContext,
      );
    }
  }

  public async executeAskQueryAndGetResponse(query: AskQuery): Promise<boolean> {
    const generatedQuery = this.sparqlGenerator.stringify(query);
    return await this.engine.queryBoolean(
      generatedQuery,
      this.queryContext,
    );
  }

  public async executeSelectCountAndGetResponse(query: SelectQuery): Promise<number> {
    const generatedQuery = this.sparqlGenerator.stringify(query);
    const stream = await this.engine.queryBindings(
      generatedQuery,
      this.queryContext,
    );
    return new Promise((resolve, reject): void => {
      let countValue: number;
      stream.on('data', (row): void => {
        if (row.entries.has('count')) {
          const countLiteral = row.entries.get('count');
          countValue = Number.parseInt(countLiteral.value, 10);
        }
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
