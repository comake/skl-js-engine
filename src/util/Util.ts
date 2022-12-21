import * as jsonld from 'jsonld';
import type { NodeObject } from 'jsonld';
import { Parser, Store } from 'n3';

export type JSONObject = Record<string, JSONValue>;

export type JSONValue =
  | string
  | number
  | boolean
  | {[x: string]: JSONValue }
  | JSONValue[];

export function constructUri(base: string, local: string): string {
  return `${base}${local}`;
}

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

export function getValueOfFieldInNodeObject<T>(object: NodeObject, field: string): T | undefined {
  if (object[field]) {
    if (typeof object[field] === 'object') {
      return (object[field] as NodeObject)!['@value'] as unknown as T;
    }
    return object[field] as unknown as T;
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
