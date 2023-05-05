import { promises as fs } from 'fs';
import type { ReadableOptions } from 'stream';
import { Readable } from 'stream';
import jsonld from 'jsonld';
import type { Entity } from '../../src/util/Types';

export function describeIf(envFlag: string, name: string, fn: () => void): void {
  const flag = `TEST_${envFlag.toUpperCase()}`;
  const enabled = !/^(|0|false)$/iu.test(process.env[flag] ?? '');
  // eslint-disable-next-line jest/valid-describe-callback, jest/valid-title, jest/no-disabled-tests
  return enabled ? describe(name, fn) : describe.skip(name, fn);
}

export async function frameAndCombineSchemas(
  filePaths: string[],
  env: Record<string, string> = {},
): Promise<Entity[]> {
  const schemas = await Promise.all(
    filePaths.map(async(filePath: string): Promise<jsonld.NodeObject[]> => {
      let schema = await fs.readFile(filePath, { encoding: 'utf8' });
      Object.keys(env).forEach((envVar: string): void => {
        schema = schema.replace(`ENV_${envVar}`, env[envVar]);
      });
      return await jsonld.expand(JSON.parse(schema));
    }),
  );
  const flat = schemas.flat();
  const compacted = await Promise.all(
    flat.map((schema): Promise<Entity> => jsonld.compact(schema, {}) as Promise<Entity>),
  );
  return compacted;
}

export async function expandJsonLd(json: jsonld.JsonLdDocument): Promise<jsonld.JsonLdDocument> {
  return await jsonld.expand(json);
}

/**
 * Converts a string or array to a stream and applies an error guard so that it is {@link Guarded}.
 * @param contents - Data to stream.
 * @param options - Options to pass to the Readable constructor. See {@link Readable.from}.
 */
export function streamFrom(contents: string | Iterable<any>, options?: ReadableOptions): Readable {
  return Readable.from(typeof contents === 'string' ? [ contents ] : contents, options);
}
