export type QueryAdapterType = 'memory' | 'sparql';

export interface BaseQueryAdapterOptions {
  /**
   * Query Adapter type. This value is required.
   */
  readonly type: QueryAdapterType;
  /**
   * Whether to set Dublic Core created and modified timestamps on saved entities. Defaults to false.
   */
  readonly setTimestamps?: boolean;
}

