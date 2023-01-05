/* eslint-disable @typescript-eslint/naming-convention */
import type { Quad, Literal, NamedNode } from '@rdfjs/types';
import type { GraphObject } from 'jsonld';
import type { Frame } from 'jsonld/jsonld-spec';
import SparqlClient from 'sparql-http-client';
import type {
  Update,
  SparqlGenerator,
  AskQuery,
  SelectQuery,
} from 'sparqljs';
import { Generator } from 'sparqljs';
import { toJSValueFromDataType, triplesToJsonld, triplesToJsonldWithFrame } from '../../util/TripleUtil';
import type { Entity } from '../../util/Types';
import type { FindOneOptions, FindAllOptions, FindOptionsWhere } from '../FindOptionsTypes';
import type { QueryAdapter, RawQueryResult } from '../QueryAdapter';
import type { SparqlQueryAdapterOptions } from './SparqlQueryAdapterOptions';
import { SparqlQueryBuilder } from './SparqlQueryBuilder';
import { SparqlUpdateBuilder } from './SparqlUpdateBuilder';

export type SelectVariableQueryResult<T> = Record<keyof T, NamedNode | Literal>;

/**
 * A {@link QueryAdapter} that stores data in a database through a sparql endpoint.
 */
export class SparqlQueryAdapter implements QueryAdapter {
  private readonly sparqlClient: SparqlClient;
  private readonly sparqlGenerator: SparqlGenerator;
  private readonly setTimestamps: boolean;

  public constructor(options: SparqlQueryAdapterOptions) {
    this.sparqlClient = new SparqlClient({
      endpointUrl: options.endpointUrl,
      updateUrl: options.updateUrl ?? options.endpointUrl,
    });
    this.sparqlGenerator = new Generator();
    this.setTimestamps = options.setTimestamps ?? false;
  }

  public async executeRawQuery<T extends RawQueryResult>(query: string): Promise<T[]> {
    const response = await this.executeSparqlSelectAndGetData<SelectVariableQueryResult<T>>(query);
    if (response.length === 0) {
      return [] as T[];
    }
    return response
      .map((result): RawQueryResult =>
        Object.entries(result).reduce((obj, [ key, value ]): RawQueryResult => ({
          ...obj,
          [key]: value.termType === 'Literal'
            ? toJSValueFromDataType(value.value, value.datatype?.value)
            : value.value,
        }), {})) as T[];
  }

  public async executeRawEntityQuery(query: string, frame?: Frame): Promise<GraphObject> {
    const response = await this.executeSparqlSelectAndGetData(query);
    if (response.length === 0) {
      return { '@graph': []};
    }
    return await triplesToJsonldWithFrame(response, frame);
  }

  public async find(options?: FindOneOptions): Promise<Entity | null> {
    const queryBuilder = new SparqlQueryBuilder();
    const query = queryBuilder.buildEntityQuery({ ...options, limit: 1 });
    const generatedQuery = this.sparqlGenerator.stringify(query);
    const responseTriples = await this.executeSparqlSelectAndGetData(generatedQuery);
    if (responseTriples.length === 0) {
      return null;
    }
    const jsonld = await triplesToJsonld(responseTriples, options?.relations);
    return jsonld as Entity;
  }

  public async findBy(where: FindOptionsWhere): Promise<Entity | null> {
    return this.find({ where });
  }

  public async findAll(options?: FindAllOptions): Promise<Entity[]> {
    const queryBuilder = new SparqlQueryBuilder();
    const query = queryBuilder.buildEntityQuery(options);
    const generatedQuery = this.sparqlGenerator.stringify(query);
    const responseTriples = await this.executeSparqlSelectAndGetData(generatedQuery);
    if (responseTriples.length === 0) {
      return [];
    }
    const jsonld = await triplesToJsonld(responseTriples, options?.relations);
    if (Array.isArray(jsonld)) {
      return jsonld as Entity[];
    }
    return [ jsonld ] as Entity[];
  }

  public async findAllBy(where: FindOptionsWhere): Promise<Entity[]> {
    return this.findAll({ where });
  }

  public async exists(where: FindOptionsWhere): Promise<boolean> {
    const queryBuilder = new SparqlQueryBuilder();
    const query = queryBuilder.buildEntityExistQuery(where);
    return await this.executeAskQueryAndGetResponse(query);
  }

  public async count(where?: FindOptionsWhere): Promise<number> {
    const queryBuilder = new SparqlQueryBuilder();
    const query = queryBuilder.buildEntityCountQuery(where);
    return await this.executeSelectCountAndGetResponse(query);
  }

  public async save(entity: Entity): Promise<Entity>;
  public async save(entities: Entity[]): Promise<Entity[]>;
  public async save(entityOrEntities: Entity | Entity[]): Promise<Entity | Entity[]> {
    const queryBuilder = new SparqlUpdateBuilder({ setTimestamps: this.setTimestamps });
    const query = queryBuilder.buildUpdate(entityOrEntities);
    await this.executeSparqlUpdate(query);
    return entityOrEntities;
  }

  public async destroy(entity: Entity): Promise<Entity>;
  public async destroy(entities: Entity[]): Promise<Entity[]>;
  public async destroy(entityOrEntities: Entity | Entity[]): Promise<Entity | Entity[]> {
    const queryBuilder = new SparqlUpdateBuilder();
    const query = queryBuilder.buildDelete(entityOrEntities);
    await this.executeSparqlUpdate(query);
    return entityOrEntities;
  }

  public async destroyAll(): Promise<void> {
    const queryBuilder = new SparqlUpdateBuilder();
    const query = queryBuilder.buildDeleteAll();
    await this.executeSparqlUpdate(query);
  }

  private async executeSparqlSelectAndGetData<T extends Quad | SelectVariableQueryResult<any> = Quad>(
    query: string,
  ): Promise<T[]> {
    const stream = await this.sparqlClient.query.select(query);
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

  private async executeSparqlUpdate(query: Update): Promise<void> {
    const generatedQuery = this.sparqlGenerator.stringify(query);
    await this.sparqlClient.query.update(generatedQuery);
  }

  private async executeAskQueryAndGetResponse(query: AskQuery): Promise<boolean> {
    const generatedQuery = this.sparqlGenerator.stringify(query);
    return await this.sparqlClient.query.ask(generatedQuery);
  }

  private async executeSelectCountAndGetResponse(query: SelectQuery): Promise<number> {
    const generatedQuery = this.sparqlGenerator.stringify(query);
    const stream = await this.sparqlClient.query.select(generatedQuery);
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
