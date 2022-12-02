/* eslint-disable unicorn/expiring-todo-comments */
/* eslint-disable @typescript-eslint/method-signature-style */

import type { Entity } from '../util/Types';

/* eslint-disable @typescript-eslint/naming-convention */
export type FindOptionsSelectByString = string[];

export type FindOptionsRelationsByString = string[];

export interface FindOneOptions {
  select?: FindOptionsSelect | FindOptionsSelectByString;
  where?: FindOptionsWhere;
  relations?: FindOptionsRelations;
  order?: FindOptionsOrder;
}

export interface FindOptionsSelect {
  [k: string]: boolean | FindOptionsSelect;
}

export interface FindOptionsRelations {
  [k: string]: boolean | FindOptionsRelations;
}

export type FindOptionsOrderValue = 'ASC' | 'DESC' | 'asc' | 'desc' | 1 | -1;

export type FindOptionsOrder = Record<string, FindOptionsOrderValue>;

// TODO add find operators
export interface FindOptionsWhere {
  type?: string;
  id?: string;
  [k: string]: boolean | number | string | FindOptionsWhere | undefined;
}

export interface FindAllOptions extends FindOneOptions {
  offset?: number;
  limit?: number;
}

export type updateOrDeleteCriteria = string | string[] | FindOptionsWhere;

/**
 * Adapts SKQL CRUD operations to a specific persistence layer.
 */
export interface QueryAdapter {
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
   * Updates entity partially. Entity can be found by a given conditions.
   * Unlike save method executes a primitive operation without cascades, relations and other operations included
   */
  // update(criteria: updateOrDeleteCriteria, partialEntity: Partial<Entity>): Promise<void>;
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
  // delete(criteria: updateOrDeleteCriteria): Promise<void>;
}
