/* eslint-disable @typescript-eslint/method-signature-style */
import type { GraphObject } from 'jsonld';
import type { Frame } from 'jsonld/jsonld-spec';
import type { Entity } from '../util/Types';
import type { FindAllOptions, FindCountOptions, FindOneOptions, FindOptionsWhere } from './FindOptionsTypes';

export type RawQueryResult = Record<string, number | boolean | string>;

/**
 * Adapts CRUD operations to a specific persistence layer.
 */

export interface QueryAdapter {
  /**
   * Performs a raw query for data matching the query.
   */
  executeRawQuery<T extends RawQueryResult>(query: string): Promise<T[]>;
  /**
   * Performs a raw query for entities matching the query. The query must be a CONSTRUCT query.
   */
  executeRawEntityQuery(query: string, frame?: Frame): Promise<GraphObject>;
  /**
   * Finds first entity by a given find options.
   * If entity was not found in the database - returns null.
   */
  find(options?: FindOneOptions): Promise<Entity | null>;
  /**
   * Finds first entity that matches given where condition.
   * If entity was not found in the database - returns null.
   */
  findBy(where: FindOptionsWhere): Promise<Entity | null>;
  /**
   * Finds entities that match given find options.
   */
  findAll(options?: FindAllOptions): Promise<Entity[]>;
  /**
   * Finds entities that match given where condition.
   */
  findAllBy(where: FindOptionsWhere): Promise<Entity[]>;
  /**
   * Determines if an entity matching the given where condition exists in the database.
   */
  exists(options?: FindCountOptions): Promise<boolean>;
  /**
   * Returns a count of entities matching the given where condition in the database.
   */
  count(options?: FindCountOptions): Promise<number>;
  /**
   * Saves a given entity in the database.
   * If entity does not exist in the database then inserts, otherwise updates.
   */
  save(entity: Entity): Promise<Entity>;
  /**
   * Saves all given entities in the database.
   * If entities do not exist in the database then inserts, otherwise updates.
   */
  save(entities: Entity[]): Promise<Entity[]>;
  /**
   * Updates an entity partially.
   */
  update(id: string, attributes: Partial<Entity>): Promise<void>;
  /**
   * Updates multiple entities partially.
   */
  update(ids: string[], attributes: Partial<Entity>): Promise<void>;
  /**
   * Removes a given entity from the database.
   */
  destroy(entity: Entity): Promise<Entity>;
  /**
   * Removes given entities from the database.
   */
  destroy(entities: Entity[]): Promise<Entity[]>;
  /**
   * Deletes entities by a given criteria.
   * Unlike destroy method executes a primitive operation without cascades, relations and other operations included.
   */
  // delete(criteria: UpdateOrDeleteCriteria): Promise<void>;
  /**
   * Removes all entities from the database.
   */
  destroyAll(): Promise<void>;
}
