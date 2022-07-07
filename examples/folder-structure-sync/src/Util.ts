import { promises as fs } from 'fs';
import * as jsonld from 'jsonld';

export async function executeSequentially(
  arrayOfFnWrappedPromises: (() => Promise<any>)[],
  returnedValues: any[] = [],
): Promise<any[]> {
  const firstPromise = arrayOfFnWrappedPromises.shift();
  if (firstPromise) {
    return firstPromise()
      .then((returnValue: any): Promise<any[]> => {
        returnedValues.push(returnValue);
        return executeSequentially(arrayOfFnWrappedPromises, returnedValues);
      });
  }

  return Promise.resolve(returnedValues);
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
