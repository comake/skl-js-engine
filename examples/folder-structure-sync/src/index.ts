/* eslint-disable @typescript-eslint/naming-convention, no-console, @typescript-eslint/no-floating-promises */
import { SKQL, SKL } from '@comake/skql-js-engine';
import { executeSequentially, frameAndCombineSchemas } from './Util';

const account = 'https://skl.standard.storage/data/DropboxAccount1';
const rootFolder = {
  '@type': 'https://skl.standard.storage/nouns/Folder',
  name: 'Dropbox',
  sourceId: '',
};
const maxDepth = 1;

async function getAllFolderChildren(folder: any): Promise<any[]> {
  let nextPageToken;
  let isFirstPage = true;
  let children: any[] = [];

  while (isFirstPage || nextPageToken) {
    let records: any;
    ({ records, nextPageToken } = await SKQL.getFilesInFolder({ account, folder, token: nextPageToken }));
    children = [ ...children, ...records ];
    isFirstPage = false;
  }

  return children;
}

async function syncFolder(folder: any, depth = 0): Promise<any[]> {
  const children = await getAllFolderChildren(folder);
  if (depth < maxDepth) {
    const childSyncPromises = children
      .filter((child: any): boolean => child['@type'] === SKL.folderNoun)
      .map((child: any): () => Promise<void> => async(): Promise<void> => {
        child.children = await syncFolder(child, depth + 1);
      });
    await executeSequentially(childSyncPromises);
  }

  return children;
}

async function run(): Promise<void> {
  const schema = await frameAndCombineSchemas([
    './schemas/schema.jsonld',
    './schemas/verbs.jsonld',
    './schemas/dropbox.jsonld',
    './schemas/integrations-and-accounts.jsonld',
  ]);
  await SKQL.setSchema({ schema });
  const heirarchy = await syncFolder(rootFolder);
  console.log(heirarchy);
}

run();
