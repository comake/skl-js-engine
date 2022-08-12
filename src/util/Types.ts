import type { NodeObject } from 'jsonld';

export type SchemaNodeObject = Partial<NodeObject> & Required<Pick<NodeObject, '@type' | '@id'>>;
