import { promises as fs } from 'fs';
import type { SchemaNodeObject } from '@comake/skql-js-engine';
import * as jsonld from 'jsonld';

export async function frameAndCombineSchemas(
  filePaths: string[],
  env: Record<string, string> = {},
): Promise<SchemaNodeObject[]> {
  const schemas = await Promise.all(
    filePaths.map(async(filePath: string): Promise<jsonld.NodeObject[]> => {
      let schema = await fs.readFile(filePath, { encoding: 'utf8' });
      Object.keys(env).forEach((envVar: string): void => {
        schema = schema.replace(`ENV_${envVar}`, env[envVar]);
      });
      return await jsonld.expand(JSON.parse(schema));
    }),
  );
  const expandedSchema = schemas.flat();
  const framedSchema = await jsonld.frame(expandedSchema, {});
  return framedSchema['@graph'] as SchemaNodeObject[];
}
