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
} from '../../util/SparqlUtil';
import {
  triplesToJsonld,
  triplesToJsonldWithFrame,
} from '../../util/TripleUtil';
import type { Entity } from '../../util/Types';
import type { FindOneOptions, FindAllOptions, FindOptionsWhere, FindOptionsRelations } from '../FindOptionsTypes';
import type { QueryAdapter, RawQueryResult } from '../QueryAdapter';
import { BasicSparqlQueryBuilder } from './BasicSparqlQueryBuilder';
import type { SparqlQueryAdapterOptions } from './SparqlQueryAdapterOptions';
import type { SelectVariableQueryResult } from './SparqlQueryExecutor';
import { SparqlQueryExecutor } from './SparqlQueryExecutor';
import { SparqlUpdateBuilder } from './SparqlUpdateBuilder';

/**
 * A {@link QueryAdapter} that stores data in a database through a sparql endpoint.
 */
export class BasicSparqlQueryAdapter implements QueryAdapter {
  protected readonly sparqlQueryExecutor: SparqlQueryExecutor;
  private readonly setTimestamps: boolean;

  public constructor(options: SparqlQueryAdapterOptions) {
    this.sparqlQueryExecutor = new SparqlQueryExecutor(options);
    this.setTimestamps = options.setTimestamps ?? false;
  }

  public async executeRawQuery<T extends RawQueryResult>(
    query: string,
  ): Promise<T[]> {
    const response =
      await this.sparqlQueryExecutor.executeSparqlSelectAndGetDataRaw<SelectVariableQueryResult<T>>(query);
    if (response.length === 0) {
      return [] as T[];
    }
    return selectQueryResultsAsJSValues<T>(response);
  }

  public async executeRawEntityQuery(query: string, frame?: Frame): Promise<GraphObject> {
    const response = await this.sparqlQueryExecutor.executeSparqlSelectAndGetDataRaw(query);
    if (response.length === 0) {
      return { '@graph': []};
    }
    return await triplesToJsonldWithFrame(response, frame);
  }

  public async find(options?: FindOneOptions): Promise<Entity | null> {
    const jsonld = await this.findAllAsJsonLd({ ...options, limit: 1 });
    if (Array.isArray(jsonld)) {
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
    if (options?.search) {
      return [];
    }
    const queryBuilder = new BasicSparqlQueryBuilder();
    const { where, selectionTriples, entityOrder } = await this.buildFindAllQueryData(queryBuilder, options);
    if (entityOrder && entityOrder.length === 0) {
      return [];
    }
    const query = queryBuilder.buildConstructFromEntitySelectQuery(
      where,
      selectionTriples,
      options?.select,
    );
    return await this.executeEntitySelectQuery(query, options?.relations, entityOrder);
  }

  private async buildFindAllQueryData(
    queryBuilder: BasicSparqlQueryBuilder,
    options?: FindAllOptions,
  ): Promise<{ where: Pattern[]; selectionTriples: Triple[]; entityOrder?: string[] }> {
    const queryData = queryBuilder.buildEntitySelectPatternsFromOptions(entityVariable, options);
    const entitySelectQuery = queryData.where.length > 0
      ? createSparqlSelectQuery(
        entityVariable,
        queryData.where,
        queryData.orders,
        options?.limit,
        options?.offset,
      )
      : undefined;

    let entityOrder: string[] | undefined;
    if (queryData.orders.length > 0 && options?.limit !== 1 && entitySelectQuery) {
      const entitySelectResponse =
      await this.sparqlQueryExecutor.executeSparqlSelectAndGetData<SelectVariableQueryResult<any>>(entitySelectQuery);
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
    relations?: FindOptionsRelations,
    entityOrder?: string[],
  ): Promise<OrArray<NodeObject>> {
    const responseTriples = await this.sparqlQueryExecutor.executeSparqlSelectAndGetData(query);
    return await triplesToJsonld(responseTriples, relations, entityOrder);
  }

  public async findAllBy(where: FindOptionsWhere): Promise<Entity[]> {
    return this.findAll({ where });
  }

  public async exists(options: FindAllOptions): Promise<boolean> {
    const queryBuilder = new BasicSparqlQueryBuilder();
    const { where } = await this.buildFindAllQueryData(queryBuilder, options);
    const query = creteSparqlAskQuery(where);
    return await this.sparqlQueryExecutor.executeAskQueryAndGetResponse(query);
  }

  public async count(options: FindAllOptions): Promise<number> {
    const queryBuilder = new BasicSparqlQueryBuilder();
    const { where } = await this.buildFindAllQueryData(queryBuilder, options);
    const query = createSparqlCountSelectQuery(entityVariable, where);
    return await this.sparqlQueryExecutor.executeSelectCountAndGetResponse(query);
  }

  public async save(entity: Entity): Promise<Entity>;
  public async save(entities: Entity[]): Promise<Entity[]>;
  public async save(entityOrEntities: Entity | Entity[]): Promise<Entity | Entity[]> {
    const queryBuilder = new SparqlUpdateBuilder({ setTimestamps: this.setTimestamps });
    const query = queryBuilder.buildUpdate(entityOrEntities);
    await this.sparqlQueryExecutor.executeSparqlUpdate(query);
    return entityOrEntities;
  }

  public async destroy(entity: Entity): Promise<Entity>;
  public async destroy(entities: Entity[]): Promise<Entity[]>;
  public async destroy(entityOrEntities: Entity | Entity[]): Promise<Entity | Entity[]> {
    const queryBuilder = new SparqlUpdateBuilder();
    const query = queryBuilder.buildDelete(entityOrEntities);
    await this.sparqlQueryExecutor.executeSparqlUpdate(query);
    return entityOrEntities;
  }

  public async destroyAll(): Promise<void> {
    const queryBuilder = new SparqlUpdateBuilder();
    const query = queryBuilder.buildDeleteAll();
    await this.sparqlQueryExecutor.executeSparqlUpdate(query);
  }
}
