import { promises as fs } from 'fs';
import jsonld from 'jsonld';

export async function frameAndCombineSchemas(filePaths: string[]): Promise<jsonld.NodeObject[]> {
  const schemas = await Promise.all(
    filePaths.map(async(filePath: string): Promise<jsonld.NodeObject[]> => {
      const schema = await fs.readFile(filePath, { encoding: 'utf8' });
      return await jsonld.expand(JSON.parse(schema));
    }),
  );
  const expandedSchema = schemas.flat();
  const framedSchema = await jsonld.frame(expandedSchema, {});
  return framedSchema['@graph'] as jsonld.NodeObject[];
}
