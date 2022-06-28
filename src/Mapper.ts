/* eslint-disable @typescript-eslint/naming-convention */
import * as path from 'path';
import RMLMapperWrapper from '@rmlio/rmlmapper-java-wrapper';
import * as jsonld from 'jsonld';
import { stringToBoolean, stringToInteger } from './util/Util';
import { SKL, RDF, XSD } from './util/Vocabularies';

const rmlmapperPath = path.join(__dirname, '/../lib/rmlmapper-5.0.0-r362-all.jar');
const tempFolderPath = './tmp';

export class Mapper {
  private readonly rmlMapper: typeof RMLMapperWrapper;

  public constructor() {
    this.rmlMapper = new RMLMapperWrapper(rmlmapperPath, tempFolderPath, true);
  }

  public async apply(data: JSON, mapping: jsonld.JsonLdDocument): Promise<jsonld.NodeObject> {
    const sources = { 'input.json': JSON.stringify(data) };
    const mappingQuads = await jsonld.toRDF(mapping, { format: 'application/n-quads' });
    const result = await this.rmlMapper.execute(
      mappingQuads,
      {
        sources,
        generateMetadata: false,
        serialization: 'jsonld',
      },
    );

    const jsonldDoc = JSON.parse(result.output);
    this.convertRdfTypeToJsonLdType(jsonldDoc);
    return await this.frameJsonLdAndConvertToNativeTypes(jsonldDoc);
  }

  private convertRdfTypeToJsonLdType(jsonldDoc: jsonld.NodeObject[]): void {
    for (const subDoc of jsonldDoc) {
      if (RDF.type in subDoc && (subDoc[RDF.type] as any[]).length > 1) {
        subDoc['@type'] = [
          ...subDoc['@type'] as string[] || [],
          ...(subDoc[RDF.type] as any[]).map((type: any): any => type['@value']),
        ];
      } else if (RDF.type in subDoc) {
        subDoc['@type'] = [
          ...subDoc['@type'] as string[] || [],
          (subDoc[RDF.type] as any[])[0]['@value'],
        ];
      }
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete subDoc[RDF.type];
    }
  }

  private async frameJsonLdAndConvertToNativeTypes(jsonldDoc: any[]): Promise<jsonld.NodeObject> {
    const frame: any = {
      '@context': {},
      '@type': 'https://skl.standard.storage/mappings/frameObject',
    };

    jsonldDoc.forEach(async(subDoc: any): Promise<void> => {
      Object.keys(subDoc).forEach((key: string): void => {
        if (key.startsWith(SKL.properties)) {
          const argName = key.slice(SKL.properties.length);
          const value = subDoc[key];
          if (Array.isArray(value) && typeof value[0] === 'object' && '@type' in value[0]) {
            frame['@context'][argName] = { '@id': key, '@type': value[0]['@type'] };
            if (value.length > 1) {
              frame['@context'][argName]['@container'] = '@set';
            }

            subDoc[key] = subDoc[key].map((valueItem: any): void =>
              this.convertToNativeValue(valueItem));
          } else if (Array.isArray(value) && typeof value[0] === 'object' && '@id' in value[0]) {
            frame['@context'][argName] = { '@id': key, '@type': '@id' };
            if (value.length > 1) {
              frame['@context'][argName]['@container'] = '@set';
            }
          } else if (typeof value === 'object' && '@type' in value) {
            // I don't think it's possible for this block to run.
            // frame['@context'][argName] = { '@id': key, '@type': value['@type'] };
            // subDoc[key] = this.convertToNativeValue(subDoc[key]);
          } else if (typeof value === 'object' && '@id' in value) {
            frame['@context'][argName] = {
              '@id': key,
              '@type': '@id',
            };
          } else {
            frame['@context'][argName] = key;
          }
        }
      });
    });

    return await jsonld.frame(jsonldDoc, frame);
  }

  private convertToNativeValue(jsonLdTerm: any): any {
    if (jsonLdTerm['@type'] === XSD.boolean) {
      jsonLdTerm['@value'] = stringToBoolean(jsonLdTerm['@value']);
    } else if (jsonLdTerm['@type'] === XSD.integer) {
      jsonLdTerm['@value'] = stringToInteger(jsonLdTerm['@value']);
    } else if (jsonLdTerm['@type'] === XSD.double) {
      jsonLdTerm['@value'] = Number.parseFloat(jsonLdTerm['@value']);
    }
    return jsonLdTerm;
  }
}
