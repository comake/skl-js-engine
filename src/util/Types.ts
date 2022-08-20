import type { NodeObject } from 'jsonld';

export type SchemaNodeObject = Partial<NodeObject> & Required<Pick<NodeObject, '@type' | '@id'>>;

export type NodeObjectWithId = Partial<NodeObject> & Required<Pick<NodeObject, '@id'>>;

export type UnsavedSchemaNodeObject = Omit<SchemaNodeObject, '@id'>;
