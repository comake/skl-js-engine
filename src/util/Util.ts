import * as jsonld from 'jsonld';
import type { NodeObject, ValueObject } from 'jsonld';
import { Parser, Store } from 'n3';
import type { EntityFieldSingularValue, EntityFieldValue } from './Types';

export type JSONPrimitive =
  | string
  | number
  | boolean
  | null;
export type JSONObject = Record<string, JSONValue>;
export interface JSONArray extends Array<JSONValue> {}

export type JSONValue =
  | JSONPrimitive
  | {[x: string]: JSONValue }
  | JSONValue[];

export async function convertJsonLdToQuads(jsonldDoc: any): Promise<Store> {
  const nquads = await jsonld.toRDF(jsonldDoc, { format: 'application/n-quads' }) as unknown as string;
  const turtleParser = new Parser({ format: 'application/n-quads' });
  const store = new Store();
  turtleParser.parse(nquads).forEach((quad): void => {
    store.addQuad(quad);
  });
  return store;
}

export function toJSON(jsonLd: NodeObject, convertBeyondFirstLevel = true): JSONObject {
  [ '@context', '@id', '@type' ].forEach((key): void => {
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete jsonLd[key];
  });
  if (convertBeyondFirstLevel) {
    Object.keys(jsonLd).forEach((key): void => {
      if (Array.isArray(jsonLd[key])) {
        (jsonLd[key] as any[])!.forEach((item, index): void => {
          if (typeof item === 'object') {
            (jsonLd[key] as any[])[index] = toJSON(item);
          }
        });
      } else if (typeof jsonLd[key] === 'object') {
        jsonLd[key] = toJSON(jsonLd[key] as NodeObject);
      }
    });
  }
  return jsonLd as JSONObject;
}

export function ensureArray<T>(arrayable: T | T[]): T[] {
  if (arrayable !== null && arrayable !== undefined) {
    return Array.isArray(arrayable) ? arrayable : [ arrayable ];
  }
  return [];
}

export function getValueIfDefined<T>(fieldValue?: EntityFieldValue): T | undefined {
  if (fieldValue && Array.isArray(fieldValue)) {
    const values = fieldValue.map((valueItem): EntityFieldSingularValue =>
      getValueIfDefined<EntityFieldSingularValue>(valueItem)!);
    return (values.length === 1 ? values[0] : values) as unknown as T;
  }
  if (fieldValue && typeof fieldValue === 'object') {
    return (fieldValue as ValueObject)['@value'] as unknown as T;
  }
  if (fieldValue !== undefined && fieldValue !== null) {
    return fieldValue as unknown as T;
  }
}

export function isUrl(value: any): boolean {
  if (typeof value !== 'string') {
    return false;
  }
  try {
    // eslint-disable-next-line no-new
    new URL(value);
    return true;
  } catch {
    return false;
  }
}
