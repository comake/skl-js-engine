import DataFactory from '@rdfjs/data-model';
import type { Quad } from '@rdfjs/types';
import SparqlClient from 'sparql-http-client';
import type {
  Update,
  Query,
  SparqlGenerator,
} from 'sparqljs';
import { Generator } from 'sparqljs';
import { triplesToJsonld } from '../../util/TripleUtil';
import type { Entity } from '../../util/Types';
import type { QueryAdapter, FindOneOptions, FindAllOptions, FindOptionsWhere } from '../QueryAdapter';
import { SparqlQueryBuilder } from './SparqlQueryBuilder';
import { SparqlUpdateBuilder } from './SparqlUpdateBuilder';

export interface SparqlQueryAdapterArgs {
  endpointUrl: string;
  updateUrl?: string;
}

/**
 * A {@link QueryAdapter} that stores data in a database through a sparql endpoint.
 */
export class SparqlQueryAdapter implements QueryAdapter {
  private readonly sparqlClient: SparqlClient;
  private readonly sparqlGenerator: SparqlGenerator;

  public constructor(args: SparqlQueryAdapterArgs) {
    this.sparqlClient = new SparqlClient({
      endpointUrl: args.endpointUrl,
      updateUrl: args.updateUrl ?? args.endpointUrl,
    });
    this.sparqlGenerator = new Generator();
  }

  public async find(options?: FindOneOptions): Promise<Entity | null> {
    const queryBuilder = new SparqlQueryBuilder();
    const query = queryBuilder.buildQuery({ ...options, limit: 1 });
    const responseTriples = await this.executeQueryAndGetData(query);
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
    const query = queryBuilder.buildQuery(options);
    const responseTriples = await this.executeQueryAndGetData(query);
    if (responseTriples.length === 0) {
      return [];
    }
    const jsonld = await triplesToJsonld(responseTriples);
    return jsonld as any;
  }

  public async findAllBy(where: FindOptionsWhere): Promise<Entity[]> {
    return this.findAll({ where });
  }

  public async save(entity: Entity): Promise<Entity>;
  public async save(entities: Entity[]): Promise<Entity[]>;
  public async save(entityOrEntities: Entity | Entity[]): Promise<Entity | Entity[]> {
    const queryBuilder = new SparqlUpdateBuilder();
    const query = queryBuilder.buildUpdate(entityOrEntities);
    await this.executeUpdate(query);
    return entityOrEntities;
  }

  public async destroy(entity: Entity): Promise<Entity>;
  public async destroy(entities: Entity[]): Promise<Entity[]>;
  public async destroy(entityOrEntities: Entity | Entity[]): Promise<Entity | Entity[]> {
    const queryBuilder = new SparqlUpdateBuilder();
    const query = queryBuilder.buildDelete(entityOrEntities);
    await this.executeUpdate(query);
    return entityOrEntities;
  }

  private async executeQueryAndGetData(query: Query): Promise<Quad[]> {
    const generatedQuery = this.sparqlGenerator.stringify(query);
    const stream = await this.sparqlClient.query.select(generatedQuery);
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

  private async executeUpdate(query: Update): Promise<void> {
    const generatedQuery = this.sparqlGenerator.stringify(query);
    await this.sparqlClient.query.update(generatedQuery);
  }
}
