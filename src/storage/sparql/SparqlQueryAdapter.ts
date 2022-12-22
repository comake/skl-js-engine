import DataFactory from '@rdfjs/data-model';
import type { Quad } from '@rdfjs/types';
import SparqlClient from 'sparql-http-client';
import type {
  Update,
  SparqlGenerator,
  AskQuery,
} from 'sparqljs';
import { Generator } from 'sparqljs';
import { triplesToJsonld } from '../../util/TripleUtil';
import type { Entity } from '../../util/Types';
import type { FindOneOptions, FindAllOptions, FindOptionsWhere } from '../FindOptionsTypes';
import type { QueryAdapter } from '../QueryAdapter';
import type { SparqlQueryAdapterOptions } from './SparqlQueryAdapterOptions';
import { SparqlQueryBuilder } from './SparqlQueryBuilder';
import { SparqlUpdateBuilder } from './SparqlUpdateBuilder';

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

  public async query(query: string): Promise<any> {
    const responseTriples = await this.executeSparqlConstructAndGetData(query);
    if (responseTriples.length === 0) {
      return [];
    }
    const jsonld = await triplesToJsonld(responseTriples);
    return jsonld as any;
  }

  public async find(options?: FindOneOptions): Promise<Entity | null> {
    const queryBuilder = new SparqlQueryBuilder();
    const query = queryBuilder.buildEntityQuery({ ...options, limit: 1 });
    const generatedQuery = this.sparqlGenerator.stringify(query);
    const responseTriples = await this.executeSparqlConstructAndGetData(generatedQuery);
    if (responseTriples.length === 0) {
      return null;
    }
    const jsonld = await triplesToJsonld(responseTriples);
    return jsonld as any;
  }

  public async findBy(where: FindOptionsWhere): Promise<Entity | null> {
    return this.find({ where });
  }

  public async findAll(options?: FindAllOptions): Promise<Entity[]> {
    const queryBuilder = new SparqlQueryBuilder();
    const query = queryBuilder.buildEntityQuery(options);
    const generatedQuery = this.sparqlGenerator.stringify(query);
    const responseTriples = await this.executeSparqlConstructAndGetData(generatedQuery);
    if (responseTriples.length === 0) {
      return [];
    }
    const jsonld = await triplesToJsonld(responseTriples);
    return jsonld as any;
  }

  public async findAllBy(where: FindOptionsWhere): Promise<Entity[]> {
    return this.findAll({ where });
  }

  public async exists(where: FindOptionsWhere): Promise<boolean> {
    const queryBuilder = new SparqlQueryBuilder();
    const query = queryBuilder.buildEntityExistQuery(where);
    return await this.executeAskQueryAndGetResponse(query);
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

  private async executeSparqlConstructAndGetData(query: string): Promise<Quad[]> {
    const stream = await this.sparqlClient.query.select(query);
    return new Promise((resolve, reject): void => {
      const data: Quad[] = [];
      stream.on('data', (row): void => {
        data.push(DataFactory.triple(row.subject, row.predicate, row.object));
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
}
