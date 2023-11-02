export type QueryAdapterType = 'memory' | 'sparql';

interface BaseQueryAdapterOptions {
  /**
   * Query Adapter type. This value is required.
   */
  readonly type: QueryAdapterType;
  /**
   * Whether to set Dublic Core created and modified timestamps on saved entities. Defaults to false.
   */
  readonly setTimestamps?: boolean;
}

interface SparqlEndpointQueryAdapterOptions extends BaseQueryAdapterOptions {
  /**
   * Query Adapter type.
   */
  readonly type: 'sparql';
  /**
   * The location of the SPARQL endpoint. This value is required.
   */
  readonly endpointUrl: string;
  /**
   * The location of the SPARQL update endpoint. Defaults to the value of endpointUrl if not set.
   */
  readonly updateUrl?: string;
}

interface MemorySparqlQueryAdapterOptions extends BaseQueryAdapterOptions {
  /**
   * Query Adapter type.
   */
  readonly type: 'memory';
}

export type SparqlQueryAdapterOptions =
| MemorySparqlQueryAdapterOptions
| SparqlEndpointQueryAdapterOptions;
