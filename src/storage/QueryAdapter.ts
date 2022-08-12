/* eslint-disable capitalized-comments */
import type { SchemaNodeObject } from '../util/Types';

export interface FindQuery {
  type?: string;
  id?: string;
  [k: string]: string | undefined;
}

/**
 * Adapts SKQL CRUD operations to a specific persistence layer.
 */
export interface QueryAdapter {

  find: (query: FindQuery) => Promise<SchemaNodeObject | undefined>;

  findAll: (query: FindQuery) => Promise<SchemaNodeObject[]>;

  // update: (record: NodeObject) => Promise<void>;

  // updateAll: (records: NodeObject[]) => Promise<void>;

  // delete: () => Promise<void>;
}
