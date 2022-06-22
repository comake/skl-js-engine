"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.executePromisesSequentially = void 0;
/* eslint-disable @typescript-eslint/naming-convention */
const fs = __importStar(require("fs"));
const skql_js_engine_1 = require("@comake/skql-js-engine");
const jsonld = __importStar(require("jsonld"));
const account = 'https://skl.standard.storage/data/DropboxAccount1';
const rootFolder = {
    '@type': 'https://skl.standard.storage/nouns/Folder',
    name: 'Dropbox',
    sourceId: '',
};
const maxDepth = 0;
async function executePromisesSequentially(arrayOfFnWrappedPromises, returnedValues = []) {
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
exports.executePromisesSequentially = executePromisesSequentially;
async function getAllChildren(folder) {
    let { records: children, nextPageToken } = await skql_js_engine_1.SKQL.getFilesInFolder({ account, folder });
    while (nextPageToken) {
        let records;
        ({ records, nextPageToken } = await skql_js_engine_1.SKQL.getFilesInFolder({ account, folder, token: nextPageToken }));
        children = [...children, ...records];
    }
    return children;
}
async function getFilesRecursive(folder, depth = 0) {
    const children = await getAllChildren(folder);
    if (depth < maxDepth) {
        return executePromisesSequentially(children.map((child) => async () => {
            if (child['@type'] === skql_js_engine_1.SKL.folderNoun) {
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
    await skql_js_engine_1.SKQL.setSchema({ schema });
    const heirarchy = await getFilesRecursive(rootFolder);
    for (const toplevel of heirarchy) {
        // eslint-disable-next-line no-console
        console.log(toplevel);
    }
}
// eslint-disable-next-line @typescript-eslint/no-floating-promises
run();
