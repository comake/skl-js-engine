import { promises as fs } from 'fs';
import * as jsonld from 'jsonld';
import type { Entity } from '@comake/skl-js-engine';

export async function frameAndCombineSchemas(
  filePaths: string[],
  env: Record<string, string> = {},
): Promise<Entity[]> {
  const nestedSchemas = await Promise.all(
    filePaths.map(async(filePath: string): Promise<jsonld.NodeObject[]> => {
      let schema = await fs.readFile(filePath, { encoding: 'utf8' });
      Object.keys(env).forEach((envVar: string): void => {
        schema = schema.replace(`ENV_${envVar}`, env[envVar]);
      });
      return await jsonld.expand(JSON.parse(schema));
    }),
  );
  const schemas = nestedSchemas.flat();
  return await Promise.all(
    schemas.map((schema): Promise<Entity> => jsonld.compact(schema, {}) as Promise<Entity>),
  );
}
