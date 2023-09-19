import type { Callbacks } from './Callbacks';
import type { MemoryQueryAdapterOptions } from './storage/memory/MemoryQueryAdapterOptions';
import type { SparqlQueryAdapterOptions } from './storage/sparql/SparqlQueryAdapterOptions';

export type SklEngineStorageOptions =
| MemoryQueryAdapterOptions
| SparqlQueryAdapterOptions;

export type SklEngineOptions = SklEngineStorageOptions & {
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
};
