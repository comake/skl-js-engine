import type { SparqlQueryAdapterOptions } from './storage/query-adapter/sparql/SparqlQueryAdapterOptions';
import type { Callbacks } from './util/Types';

export type SklEngineOptions = SparqlQueryAdapterOptions & {
  /**
   * Callbacks to execute upon events.
   */
  readonly callbacks?: Callbacks;
  /**
   * Manually defined functions which can be used in mappings.
   */
  readonly functions?: Record<string, (args: any | any[]) => any>;
  /**
   * When true, disables validation of verb parameters and return values according to schemas
   */
  readonly disableValidation?: boolean;
  /**
   * An object containing files keyed on their title that can be used in mappings.
   */
  readonly inputFiles?: Record<string, string>;

  readonly debugMode?: boolean;
};
