import type { Entity } from '../../util/Types';
import type { BaseQueryAdapterOptions } from '../BaseQueryAdapterOptions';

export interface MemoryQueryAdapterOptions extends BaseQueryAdapterOptions {
  /**
   * Query Adapter type.
   */
  readonly type: 'memory';
  /**
   * Schema to initialize in memory.
   */
  readonly schemas?: Entity[];
}
