/* eslint-disable @typescript-eslint/naming-convention */
import type { OrArray } from '@comake/rmlmapper-js';
import type { Quad, Literal, NamedNode } from '@rdfjs/types';
import type { GraphObject, NodeObject } from 'jsonld';
import type { Frame } from 'jsonld/jsonld-spec';
import SparqlClient from 'sparql-http-client';
import type {
  Update,
  SparqlGenerator,
  AskQuery,
  SelectQuery,
  Pattern,
  Variable,
  GraphPattern,
  IriTerm,
  Ordering,
  GroupPattern,
} from 'sparqljs';
import { Generator } from 'sparqljs';
import {
  countVariable,
  entityVariable,
  toJSValueFromDataType,
  triplesToJsonld,
  triplesToJsonldWithFrame,
} from '../../util/TripleUtil';
import type { Entity } from '../../util/Types';
import type { FindOneOptions, FindAllOptions, FindOptionsWhere } from '../FindOptionsTypes';
import type { QueryAdapter, RawQueryResult } from '../QueryAdapter';
import type { SparqlQueryAdapterOptions } from './SparqlQueryAdapterOptions';
import type { SelectQueryData } from './SparqlQueryBuilder';
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
    const jsonld = await this.findAllAsJsonLd({ ...options, limit: 1 });
    if (Array.isArray(jsonld) && jsonld.length === 0) {
      return null;
    }
    return jsonld as Entity;
  }

  private constructSparqlSelect(
    variables: Variable[],
    where: Pattern[],
    order: Ordering[],
    limit?: number,
    offset?: number,
  ): SelectQuery {
    return {
      type: 'query',
      queryType: 'SELECT',
      variables,
      where,
      order: order.length > 0 ? order : undefined,
      limit,
      offset,
      prefixes: {},
    };
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
    const selectQueryData = queryBuilder.buildPatternsFromQueryOptions(
      entityVariable,
      options?.where,
      options?.order,
      options?.relations,
    );
    const entitySelectVariables = [ entityVariable, ...selectQueryData.variables ];
    const entitySelectQuery = this.constructSparqlSelect(
      entitySelectVariables,
      selectQueryData.where,
      selectQueryData.orders,
      options?.limit,
      options?.offset,
    );

    if (selectQueryData.orders.length > 0 && options?.limit !== 1) {
      return await this.findAllWithOrder(
        queryBuilder,
        entitySelectQuery,
        selectQueryData,
        options,
      );
    }
    return await this.findAllWithoutOrder(
      queryBuilder,
      entitySelectQuery,
      selectQueryData,
      options,
    );
  }

  private async findAllWithOrder(
    queryBuilder: SparqlQueryBuilder,
    entitySelectQuery: SelectQuery,
    selectQueryData: SelectQueryData,
    options?: FindAllOptions,
  ): Promise<OrArray<NodeObject>> {
    // We need to execute the entity select query here first to get ordered results.
    const generatedEntitySelectQuery = this.sparqlGenerator.stringify(entitySelectQuery);
    const entitySelectResponse =
      await this.executeSparqlSelectAndGetData<SelectVariableQueryResult<any>>(generatedEntitySelectQuery);
    const valuesByVariable = this.groupByKey(entitySelectResponse);
    const orderedEntities = this.getEntityVariableValuesFromVariables(valuesByVariable);
    if (orderedEntities.length === 0) {
      return [];
    }
    const variableValueFilter = queryBuilder.buildInFilterForVariables(valuesByVariable);
    selectQueryData.graphWhere.push(variableValueFilter);
    return await this.executeEntitySelectQuery(
      queryBuilder,
      selectQueryData,
      options,
      orderedEntities,
    );
  }

  private async findAllWithoutOrder(
    queryBuilder: SparqlQueryBuilder,
    entitySelectQuery: SelectQuery,
    selectQueryData: SelectQueryData,
    options?: FindAllOptions,
  ): Promise<OrArray<NodeObject>> {
    const entitySelectGroupQuery = this.sparqlSelectGroup([ entitySelectQuery ]);
    selectQueryData.graphWhere.unshift(entitySelectGroupQuery);
    return await this.executeEntitySelectQuery(
      queryBuilder,
      selectQueryData,
      options,
    );
  }

  private async executeEntitySelectQuery(
    queryBuilder: SparqlQueryBuilder,
    selectQueryData: SelectQueryData,
    options?: FindAllOptions,
    orderedEntities?: string[],
  ): Promise<OrArray<NodeObject>> {
    const query = queryBuilder.buildConstructFromEntitySelectQuery(
      selectQueryData.graphWhere,
      selectQueryData.variables,
      options?.select,
    );
    const generatedQuery = this.sparqlGenerator.stringify(query);
    const responseTriples = await this.executeSparqlSelectAndGetData(generatedQuery);
    return await triplesToJsonld(responseTriples, options?.relations, orderedEntities);
  }

  private getEntityVariableValuesFromVariables(variables: Record<string, (Literal | NamedNode)[]>): string[] {
    if (!(entityVariable.value in variables)) {
      return [];
    }
    return (variables[entityVariable.value] as NamedNode[])
      .map((namedNode: NamedNode): string => namedNode.value);
  }

  private groupByKey(
    entitySelectResponse: SelectVariableQueryResult<any>[],
  ): Record<string, (NamedNode | Literal)[]> {
    return entitySelectResponse
      .reduce((obj: Record<string, (NamedNode | Literal)[]>, result): Record<string, (NamedNode | Literal)[]> => {
        for (const [ key, value ] of Object.entries(result)) {
          if (!(key in obj)) {
            obj[key] = [ value ];
          } else {
            obj[key].push(value);
          }
        }
        return obj;
      }, {});
  }

  private sparqlSelectGroup(patterns: Pattern[]): GroupPattern {
    return {
      type: 'group',
      patterns,
    };
  }

  public async findAllBy(where: FindOptionsWhere): Promise<Entity[]> {
    return this.findAll({ where });
  }

  public async exists(where: FindOptionsWhere): Promise<boolean> {
    const queryBuilder = new SparqlQueryBuilder();
    const selectQueryData = queryBuilder.buildPatternsFromQueryOptions(entityVariable, where);
    const query = this.sparqlAsk(selectQueryData.where);
    return await this.executeAskQueryAndGetResponse(query);
  }

  private sparqlAsk(where: Pattern[]): AskQuery {
    return {
      type: 'query',
      queryType: 'ASK',
      where,
      prefixes: {},
    };
  }

  public async count(where?: FindOptionsWhere): Promise<number> {
    const queryBuilder = new SparqlQueryBuilder();
    const selectQueryData = queryBuilder.buildPatternsFromQueryOptions(entityVariable, where);
    const query = this.sparqlCountSelect(selectQueryData.where, selectQueryData.graphWhere);
    return await this.executeSelectCountAndGetResponse(query);
  }

  private sparqlCountSelect(where: Pattern[], graphWhere: Pattern[]): SelectQuery {
    return {
      type: 'query',
      queryType: 'SELECT',
      variables: [{
        expression: {
          type: 'aggregate',
          aggregation: 'count',
          distinct: true,
          expression: entityVariable,
        },
        variable: countVariable,
      }],
      where: [
        this.sparqlSelectGraph(entityVariable, where),
        ...graphWhere,
      ],
      prefixes: {},
    };
  }

  private sparqlSelectGraph(name: Variable | NamedNode, patterns: Pattern[]): GraphPattern {
    return {
      type: 'graph',
      name: name as IriTerm,
      patterns,
    };
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
