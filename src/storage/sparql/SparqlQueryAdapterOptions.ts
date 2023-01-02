import type { BaseQueryAdapterOptions } from '../BaseQueryAdapterOptions';

export interface SparqlQueryAdapterOptions extends BaseQueryAdapterOptions {
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
