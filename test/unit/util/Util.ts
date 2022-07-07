import { promises as fs } from 'fs';
import jsonld from 'jsonld';

export async function frameAndCombineSchemas(filePaths: string[]): Promise<jsonld.NodeObject[]> {
  const schemas = await Promise.all(
    filePaths.map(async(filePath: string): Promise<jsonld.NodeObject[]> => {
      const schema = await fs.readFile(filePath, { encoding: 'utf8' });
      const expandedSchema = await jsonld.expand(JSON.parse(schema));
      return (await jsonld.frame(expandedSchema, {}))['@graph'] as jsonld.NodeObject[];
    }),
  );
  return schemas.flat();
}
