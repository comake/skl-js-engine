/* eslint-disable @typescript-eslint/naming-convention, unicorn/expiring-todo-comments */
import * as RmlParser from '@comake/rmlmapper-js';
import * as jsonld from 'jsonld';
import { functions } from './MapperFunctions';
import { stringToBoolean, stringToInteger } from './util/Util';
import { SKL, RDF, XSD } from './util/Vocabularies';

export class Mapper {
  public async apply(data: jsonld.NodeObject, mapping: jsonld.NodeObject): Promise<jsonld.NodeObject> {
    const mappingAsQuads = await this.jsonLdToQuads(mapping);
    const sources = { 'input.json': JSON.stringify(data) };
    // TODO always return arrays...
    const result = await RmlParser.parse(mappingAsQuads, sources, { functions }) as jsonld.NodeObject[];
    this.convertRdfTypeToJsonLdType(result);
    return await this.frameJsonLdAndConvertToNativeTypes(result);
  }

  private convertRdfTypeToJsonLdType(jsonldDoc: jsonld.NodeObject[]): void {
    for (const subDoc of jsonldDoc) {
      if (RDF.type in subDoc) {
        const rdfTypes = Array.isArray(subDoc[RDF.type])
          ? (subDoc[RDF.type] as any[]).map((type: any): any => type['@id'])
          : [ (subDoc[RDF.type] as any)['@id'] ];
        subDoc['@type'] = [
          ...subDoc['@type'] as string[] || [],
          ...rdfTypes,
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
            frame['@context'][argName] = { '@id': key, '@type': value['@type'] };
            subDoc[key] = this.convertToNativeValue(subDoc[key]);
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

  private async jsonLdToQuads(jsonldDoc: jsonld.NodeObject): Promise<string> {
    return (await jsonld.toRDF(jsonldDoc, { format: 'application/n-quads' })) as unknown as string;
  }
}
