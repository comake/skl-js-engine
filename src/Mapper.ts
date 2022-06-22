import RMLMapperWrapper from '@rmlio/rmlmapper-java-wrapper';
import * as jsonld from 'jsonld';
import { isNumeric, stringToBoolean, stringToInteger } from './util/Util';
import { SKL, RDF, XSD } from './util/Vocabularies';

const rmlmapperPath = './lib/rmlmapper-5.0.0-r362-all.jar';
const tempFolderPath = './tmp';

export class Mapper {
  private readonly rmlMapper: typeof RMLMapperWrapper;

  public constructor() {
    this.rmlMapper = new RMLMapperWrapper(rmlmapperPath, tempFolderPath, true);
  }

  public async apply(data: Record<string, any>, mapping: any): Promise<jsonld.NodeObject> {
    // eslint-disable-next-line @typescript-eslint/naming-convention
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

  private convertRdfTypeToJsonLdType(jsonldDoc: any): void {
    for (const subDoc of jsonldDoc) {
      if (RDF.type in subDoc) {
        if (subDoc[RDF.type].length > 1) {
          subDoc['@type'] = subDoc[RDF.type].map((type: any): any => type['@value']);
        } else {
          subDoc['@type'] = subDoc[RDF.type][0]['@value'];
          // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
          delete subDoc[RDF.type];
        }
      }
    }

    return jsonldDoc;
  }

  private async frameJsonLdAndConvertToNativeTypes(jsonldDoc: any[]): Promise<jsonld.NodeObject> {
    const frame: any = {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      '@context': {},
      // eslint-disable-next-line @typescript-eslint/naming-convention
      '@type': 'https://skl.standard.storage/mappings/frameObject',
    };

    jsonldDoc.forEach(async(subDoc: any): Promise<void> => {
      Object.keys(subDoc).forEach((key: string): void => {
        if (key.startsWith(SKL.properties)) {
          const argName = key.slice(SKL.properties.length);
          const value = subDoc[key];
          if (Array.isArray(value) && typeof value[0] === 'object' && '@type' in value[0]) {
            // eslint-disable-next-line @typescript-eslint/naming-convention
            frame['@context'][argName] = { '@id': key, '@type': value[0]['@type'] };
            if (value.length > 1) {
              frame['@context'][argName]['@container'] = '@set';
            }
            value.forEach((valueItem: any, index: number): void => {
              this.setNativeValue(subDoc[key][index], valueItem['@type']);
            });
          } else if (typeof value === 'object' && '@type' in value) {
            // eslint-disable-next-line @typescript-eslint/naming-convention
            frame['@context'][argName] = { '@id': key, '@type': value['@type'] };
            this.setNativeValue(subDoc[key], value['@type']);
          } else {
            frame['@context'][argName] = key;
          }
        }
      });
    });

    return await jsonld.frame(jsonldDoc, frame);
  }

  private setNativeValue(jsonLdTerm: any, type: string): void {
    if (type === XSD.boolean) {
      jsonLdTerm['@value'] = stringToBoolean(jsonLdTerm['@value']);
    } else if (isNumeric(jsonLdTerm['@value'])) {
      if (type === XSD.integer) {
        jsonLdTerm['@value'] = stringToInteger(jsonLdTerm['@value']);
      } else if (type === XSD.double) {
        jsonLdTerm['@value'] = Number.parseFloat(jsonLdTerm['@value']);
      }
    }
  }
}
