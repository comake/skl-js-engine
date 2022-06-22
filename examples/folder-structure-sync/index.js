/* eslint-disable @typescript-eslint/naming-convention */
import * as fs from 'fs';
import { SKQL, SKL } from '@comake/skql-js-engine';
import * as jsonld from 'jsonld';
const account = 'https://skl.standard.storage/data/DropboxAccount1';
const rootFolder = {
    '@type': 'https://skl.standard.storage/nouns/Folder',
    name: 'Dropbox',
    sourceId: '',
};
const maxDepth = 0;
export async function executePromisesSequentially(arrayOfFnWrappedPromises, returnedValues = []) {
    const firstPromise = arrayOfFnWrappedPromises.shift();
    if (firstPromise) {
        return firstPromise()
            .then((returnValue) => {
            returnedValues.push(returnValue);
            return executePromisesSequentially(arrayOfFnWrappedPromises, returnedValues);
        });
    }
    return Promise.resolve(returnedValues);
}
async function getAllChildren(folder) {
    let { records: children, nextPageToken } = await SKQL.getFilesInFolder({ account, folder });
    while (nextPageToken) {
        let records;
        ({ records, nextPageToken } = await SKQL.getFilesInFolder({ account, folder, token: nextPageToken }));
        children = [...children, ...records];
    }
    return children;
}
async function getFilesRecursive(folder, depth = 0) {
    const children = await getAllChildren(folder);
    if (depth < maxDepth) {
        return executePromisesSequentially(children.map((child) => async () => {
            if (child['@type'] === SKL.folderNoun) {
                child.children = await getFilesRecursive(child, depth + 1);
            }
            return child;
        }));
    }
    return children;
}
async function run() {
    const sklSchemas = await fs.promises.readFile('./schemas/schema.jsonld', { encoding: 'utf-8' });
    const verbs = await fs.promises.readFile('./schemas/verbs.jsonld', { encoding: 'utf-8' });
    const dropboxMappings = await fs.promises.readFile('./schemas/dropbox.jsonld', { encoding: 'utf-8' });
    const integrationsAndAccountsSchema = await fs.promises.readFile('./schemas/integrations-and-accounts.jsonld', { encoding: 'utf-8' });
    const framedSklSchemas = await jsonld.expand(JSON.parse(sklSchemas));
    const framedIntegrationsAndAccountsSchema = await jsonld.expand(JSON.parse(integrationsAndAccountsSchema));
    const framedVerbs = await jsonld.expand(JSON.parse(verbs));
    const framedDropboxMappings = await jsonld.expand(JSON.parse(dropboxMappings));
    const framedSklSchemasNodeObjects = await jsonld.frame(framedSklSchemas, {});
    const framedIntegrationsAndAccountsSchemaNodeObjects = await jsonld.frame(framedIntegrationsAndAccountsSchema, {});
    const framedVerbsNodeObjects = await jsonld.frame(framedVerbs, {});
    const framedDropboxMappingsNodeObjects = await jsonld.frame(framedDropboxMappings, {});
    const schema = [
        ...framedSklSchemasNodeObjects['@graph'],
        ...framedIntegrationsAndAccountsSchemaNodeObjects['@graph'],
        ...framedVerbsNodeObjects['@graph'],
        ...framedDropboxMappingsNodeObjects['@graph'],
    ];
    await SKQL.setSchema({ schema });
    const heirarchy = await getFilesRecursive(rootFolder);
    for (const toplevel of heirarchy) {
        // eslint-disable-next-line no-console
        console.log(toplevel);
    }
}
// eslint-disable-next-line @typescript-eslint/no-floating-promises
run();
