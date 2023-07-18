export type QueryAdapterType = 'memory' | 'sparql';

export interface BaseQueryAdapterOptions {
  /**
   * Query Adapter type. This value is required.
   */
  readonly type: QueryAdapterType;
  /**
   * An object containing files keyed on their title that can be used in mappings.
   */
  readonly inputFiles?: Record<string, string>;
  /**
   * Whether to set Dublic Core created and modified timestamps on saved entities. Defaults to false.
   */
  readonly setTimestamps?: boolean;
}

