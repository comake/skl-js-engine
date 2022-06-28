import { promises as fs } from 'fs';
import * as jsonld from 'jsonld';
import { Parser, Store } from 'n3';

export type JSONValue =
  | string
  | number
  | boolean
  | {[x: string]: JSONValue }
  | JSONValue[];

export function constructUri(base: string, local: string): string {
  return `${base}${local}`;
}

export function stringToBoolean(value: string): boolean | string {
  if (value === 'true') {
    return true;
  }
  if (value === 'false') {
    return false;
  }
  return value;
}

export function stringToInteger(value: string): number | string {
  const i = Number.parseInt(value, 10);
  if (i.toFixed(0) === value) {
    return i;
  }
  return value;
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

export function toJSON(jsonLd: jsonld.NodeObject): Record<string, JSONValue> {
  [ '@context', '@id', '@type' ].forEach((key): void => {
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete jsonLd[key];
  });
  return jsonLd as Record<string, JSONValue>;
}

export async function frameAndCombineSchemas(filePaths: string[]): Promise<jsonld.NodeObject[]> {
  const schemas = await Promise.all(
    filePaths.map(async(filePath: string): Promise<jsonld.NodeObject[]> => {
      const schema = await fs.readFile(filePath, { encoding: 'utf-8' });
      const expandedSchema = await jsonld.expand(JSON.parse(schema));
      return (await jsonld.frame(expandedSchema, {}))['@graph'] as jsonld.NodeObject[];
    }),
  );
  return schemas.flat();
}
