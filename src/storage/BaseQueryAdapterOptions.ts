export type QueryAdapterType = 'memory' | 'sparql';

export interface BaseQueryAdapterOptions {
  /**
   * Query Adapter type. This value is required.
   */
  readonly type: QueryAdapterType;
  /**
   * Manually defined functions which can be used in mappings.
   */
  readonly functions?: Record<string, (args: any | any[]) => any>;
  /**
   * Whether to set Dublic Core created and modified timestamps on saved entities. Defaults to false.
   */
  readonly setTimestamps?: boolean;
}
