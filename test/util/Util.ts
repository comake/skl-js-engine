import { promises as fs } from 'fs';
import jsonld from 'jsonld';
import type { SchemaNodeObject } from '../../src/util/Types';

export function describeIf(envFlag: string, name: string, fn: () => void): void {
  const flag = `TEST_${envFlag.toUpperCase()}`;
  const enabled = !/^(|0|false)$/iu.test(process.env[flag] ?? '');
  // eslint-disable-next-line jest/valid-describe-callback, jest/valid-title, jest/no-disabled-tests
  return enabled ? describe(name, fn) : describe.skip(name, fn);
}

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

export async function expandJsonLd(json: jsonld.JsonLdDocument): Promise<jsonld.JsonLdDocument> {
  return await jsonld.expand(json);
}
