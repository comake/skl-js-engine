/* eslint-disable @typescript-eslint/naming-convention */
import type { OrArray } from '@comake/rmlmapper-js';
import type { GraphObject, NodeObject } from 'jsonld';
import type { Frame } from 'jsonld/jsonld-spec';
import type {
  ConstructQuery,
  Pattern,
  Triple,
} from 'sparqljs';
import {
  createSparqlCountSelectQuery,
  createSparqlSelectGroup,
  createSparqlSelectQuery,
  createValuesPatternsForVariables,
  creteSparqlAskQuery,
  getEntityVariableValuesFromVariables,
  groupSelectQueryResultsByKey,
  selectQueryResultsAsJSValues,
  entityVariable,
} from '../../../util/SparqlUtil';
import {
  triplesToJsonld,
  triplesToJsonldWithFrame,
} from '../../../util/TripleUtil';
import type { Entity } from '../../../util/Types';
import type {
  FindOneOptions,
  FindAllOptions,
  FindOptionsWhere,
  FindCountOptions,
  FindExistsOptions,
} from '../../FindOptionsTypes';
import type { QueryAdapter, RawQueryResult } from '../QueryAdapter';
import { InMemorySparqlQueryExecutor } from './query-executor/InMemorySparqlQueryExecutor';
import { SparqlEndpointQueryExecutor } from './query-executor/SparqlEndpointQueryExecutor';
import type { QueryExecutor, SelectVariableQueryResult } from './query-executor/SparqlQueryExecutor';
import type { SparqlQueryAdapterOptions } from './SparqlQueryAdapterOptions';
import { SparqlQueryBuilder } from './SparqlQueryBuilder';
import { SparqlUpdateBuilder } from './SparqlUpdateBuilder';

/**
 * A {@link QueryAdapter} that stores data in a database through a sparql endpoint.
 */
export class SparqlQueryAdapter implements QueryAdapter {
  protected readonly queryExecutor: QueryExecutor;
  private readonly setTimestamps: boolean;

  public constructor(options: SparqlQueryAdapterOptions) {
    this.setTimestamps = options.setTimestamps ?? false;
    switch (options.type) {
      case 'memory':
        this.queryExecutor = new InMemorySparqlQueryExecutor();
        break;
      case 'sparql':
        this.queryExecutor = new SparqlEndpointQueryExecutor(options);
        break;
      default:
        throw new Error('No schema source found in setSchema args.');
    }
  }

  public async executeRawQuery<T extends RawQueryResult>(
    query: string,
  ): Promise<T[]> {
    const response =
      await this.queryExecutor.executeSparqlSelectAndGetDataRaw<SelectVariableQueryResult<T>>(query);
    if (response.length === 0) {
      return [] as T[];
    }
    return selectQueryResultsAsJSValues<T>(response);
  }

  public async executeRawEntityQuery(query: string, frame?: Frame): Promise<GraphObject> {
    const response = await this.queryExecutor.executeSparqlSelectAndGetDataRaw(query);
    if (response.length === 0) {
      return { '@graph': []};
    }
    return await triplesToJsonldWithFrame(response, frame);
  }

  public async executeRawUpdate(
    query: string,
  ): Promise<void> {
    await this.queryExecutor.executeRawSparqlUpdate(query);
  }

  public async find(options?: FindOneOptions): Promise<Entity | null> {
    const jsonld = await this.findAllAsJsonLd({ ...options, limit: 1 });
    if (Array.isArray(jsonld) && !options?.skipFraming) {
      if (jsonld.length === 0) {
        return null;
      }
      if (jsonld.length === 1) {
        return jsonld[0] as Entity;
      }
    }
    return jsonld as Entity;
  }

  public async findBy(where: FindOptionsWhere): Promise<Entity | null> {
    return this.find({ where });
  }

  public async findAll(options?: FindAllOptions): Promise<Entity[]> {
    const jsonld = await this.findAllAsJsonLd(options);
    if (Array.isArray(jsonld)) {
      return jsonld as Entity[];
    }
    return [ jsonld ] as Entity[];
  }

  private async findAllAsJsonLd(options?: FindAllOptions): Promise<OrArray<NodeObject>> {
    const queryBuilder = new SparqlQueryBuilder();
    const { where, selectionTriples, entityOrder } = await this.buildFindAllQueryData(queryBuilder, options);
    if (entityOrder && entityOrder.length === 0) {
      return [];
    }
    const query = queryBuilder.buildConstructFromEntitySelectQuery(
      where,
      selectionTriples,
      options?.select,
    );
    return await this.executeEntitySelectQuery(query, options, entityOrder);
  }

  private async buildFindAllQueryData(
    queryBuilder: SparqlQueryBuilder,
    options?: FindAllOptions,
  ): Promise<{ where: Pattern[]; selectionTriples: Triple[]; entityOrder?: string[] }> {
    const queryData = queryBuilder.buildEntitySelectPatternsFromOptions(entityVariable, options);
    const entitySelectQuery = queryData.where.length > 0
      ? createSparqlSelectQuery(
        entityVariable,
        queryData.where,
        queryData.orders,
        queryData.group,
        options?.limit,
        options?.offset,
      )
      : undefined;

    let entityOrder: string[] | undefined;
    if (queryData.orders.length > 0 && options?.limit !== 1 && entitySelectQuery) {
      const entitySelectResponse =
      await this.queryExecutor.executeSparqlSelectAndGetData<SelectVariableQueryResult<any>>(entitySelectQuery);
      const valuesByVariable = groupSelectQueryResultsByKey(entitySelectResponse);
      entityOrder = getEntityVariableValuesFromVariables(valuesByVariable);
      if (entityOrder.length === 0) {
        return {
          where: queryData.where,
          selectionTriples: queryData.graphSelectionTriples,
          entityOrder: [],
        };
      }
      const variableValueFilters = createValuesPatternsForVariables(valuesByVariable);
      queryData.graphWhere = [ ...variableValueFilters, ...queryData.graphWhere ];
    } else if (entitySelectQuery) {
      const entitySelectGroupQuery = createSparqlSelectGroup([ entitySelectQuery ]);
      queryData.graphWhere.unshift(entitySelectGroupQuery);
    }
    return {
      where: queryData.graphWhere,
      selectionTriples: queryData.graphSelectionTriples,
      entityOrder,
    };
  }

  private async executeEntitySelectQuery(
    query: ConstructQuery,
    options?: FindAllOptions,
    entityOrder?: string[],
  ): Promise<OrArray<NodeObject>> {
    const responseTriples = await this.queryExecutor.executeSparqlSelectAndGetData(query);
    return await triplesToJsonld(
      responseTriples,
      options?.skipFraming,
      options?.relations,
      options?.where,
      entityOrder,
    );
  }

  public async findAllBy(where: FindOptionsWhere): Promise<Entity[]> {
    return this.findAll({ where });
  }

  public async exists(options: FindExistsOptions): Promise<boolean> {
    const queryBuilder = new SparqlQueryBuilder();
    const queryData = queryBuilder.buildEntitySelectPatternsFromOptions(entityVariable, options);
    const values = queryData.graphWhere.filter((pattern): boolean => pattern.type === 'values');
    const query = creteSparqlAskQuery([ ...values, ...queryData.where ]);
    return await this.queryExecutor.executeAskQueryAndGetResponse(query);
  }

  public async count(options: FindCountOptions): Promise<number> {
    const queryBuilder = new SparqlQueryBuilder();
    const queryData = queryBuilder.buildEntitySelectPatternsFromOptions(entityVariable, options);
    const values = queryData.graphWhere.filter((pattern): boolean => pattern.type === 'values');
    const query = createSparqlCountSelectQuery(
      entityVariable,
      [ ...values, ...queryData.where ],
      queryData.orders,
      options?.offset,
    );
    return await this.queryExecutor.executeSelectCountAndGetResponse(query);
  }

  public async save(entity: Entity): Promise<Entity>;
  public async save(entities: Entity[]): Promise<Entity[]>;
  public async save(entityOrEntities: Entity | Entity[]): Promise<Entity | Entity[]> {
    const queryBuilder = new SparqlUpdateBuilder({ setTimestamps: this.setTimestamps });
    const query = queryBuilder.buildUpdate(entityOrEntities);
    await this.queryExecutor.executeSparqlUpdate(query);
    return entityOrEntities;
  }

  public async update(id: string, attributes: Partial<Entity>): Promise<void>;
  public async update(ids: string[], attributes: Partial<Entity>): Promise<void>;
  public async update(idOrIds: string | string[], attributes: Partial<Entity>): Promise<void> {
    const queryBuilder = new SparqlUpdateBuilder({ setTimestamps: this.setTimestamps });
    const query = queryBuilder.buildPartialUpdate(idOrIds, attributes);
    await this.queryExecutor.executeSparqlUpdate(query);
  }

  public async delete(id: string): Promise<void>;
  public async delete(ids: string[]): Promise<void>;
  public async delete(idOrIds: string | string[]): Promise<void> {
    const queryBuilder = new SparqlUpdateBuilder();
    const query = queryBuilder.buildDeleteById(idOrIds);
    await this.queryExecutor.executeSparqlUpdate(query);
  }

  public async destroy(entity: Entity): Promise<Entity>;
  public async destroy(entities: Entity[]): Promise<Entity[]>;
  public async destroy(entityOrEntities: Entity | Entity[]): Promise<Entity | Entity[]> {
    const queryBuilder = new SparqlUpdateBuilder();
    const query = queryBuilder.buildDelete(entityOrEntities);
    await this.queryExecutor.executeSparqlUpdate(query);
    return entityOrEntities;
  }

  public async destroyAll(): Promise<void> {
    const queryBuilder = new SparqlUpdateBuilder();
    const query = queryBuilder.buildDeleteAll();
    await this.queryExecutor.executeSparqlUpdate(query);
  }
}
