/* eslint-disable @typescript-eslint/naming-convention, unicorn/expiring-todo-comments */
import * as RmlParser from '@comake/rmlmapper-js';
import * as jsonld from 'jsonld';
import { stringToBoolean, stringToInteger } from '../util/Util';
import { SKL, XSD } from '../util/Vocabularies';

export interface MapperArgs {
  functions?: Record<string, (args: any | any[]) => any>;
}

export class Mapper {
  private readonly functions?: Record<string, (args: any | any[]) => any>;

  public constructor(args?: MapperArgs) {
    this.functions = args?.functions;
  }

  public async apply(
    data: jsonld.NodeObject,
    mapping: jsonld.NodeObject,
    frame: Record<string, any>,
  ): Promise<jsonld.NodeObject> {
    const result = await this.doMapping(data, mapping);
    return await this.frameAndConvertToNativeTypes(result, frame);
  }

  public async applyAndFrameSklProperties(
    data: jsonld.NodeObject,
    mapping: jsonld.NodeObject,
    frame: Record<string, any>,
  ): Promise<jsonld.NodeObject> {
    const result = await this.doMapping(data, mapping);
    return await this.frameSklProertiesAndConvertToNativeTypes(result, frame);
  }

  private async doMapping(data: jsonld.NodeObject, mapping: jsonld.NodeObject): Promise<jsonld.NodeObject[]> {
    const mappingAsQuads = await this.jsonLdToQuads(mapping);
    const sources = { 'input.json': JSON.stringify(data) };
    const options = { functions: this.functions };
    // TODO always return arrays...
    return await RmlParser.parse(mappingAsQuads, sources, options) as jsonld.NodeObject[];
  }

  private async frameAndConvertToNativeTypes(
    jsonldDoc: any[],
    overrideFrame: Record<string, any>,
  ): Promise<jsonld.NodeObject> {
    let frame: Record<string, any> = {
      '@context': {},
      '@embed': '@always',
    };
    this.addDefaultTopLevelContextAndConvertNativeValues(jsonldDoc, frame);
    frame = { ...frame, ...overrideFrame };
    return await jsonld.frame(jsonldDoc, frame);
  }

  private addDefaultTopLevelContextAndConvertNativeValues(
    jsonldDoc: any[],
    frame: Record<string, any>,
  ): void {
    jsonldDoc.forEach(async(subDoc: any): Promise<void> => {
      Object.keys(subDoc).forEach((key: string): void => {
        const value = subDoc[key];
        if (Array.isArray(value) && typeof value[0] === 'object' && '@type' in value[0]) {
          frame['@context'][key] = { '@type': value[0]['@type'] };
          if (value.length > 1) {
            frame['@context'][key]['@container'] = '@set';
          }
          subDoc[key] = subDoc[key].map((valueItem: any): void => this.convertToNativeValue(valueItem));
        } else if (Array.isArray(value) && typeof value[0] === 'object' && '@id' in value[0]) {
          frame['@context'][key] = { '@type': '@id' };
          if (value.length > 1) {
            frame['@context'][key]['@container'] = '@set';
          }
        } else if (typeof value === 'object' && '@type' in value) {
          frame['@context'][key] = { '@type': value['@type'] };
          subDoc[key] = this.convertToNativeValue(subDoc[key]);
        } else if (typeof value === 'object' && '@id' in value) {
          frame['@context'][key] = { '@type': '@id' };
        }
      });
    });
  }

  private async frameSklProertiesAndConvertToNativeTypes(
    jsonldDoc: any[],
    overrideFrame: Record<string, any>,
  ): Promise<jsonld.NodeObject> {
    let frame: Record<string, any> = {
      '@context': {},
      '@embed': '@always',
    };
    this.addDefaultTopLevelContextWithSKLPropertiesAndConvertNativeValues(jsonldDoc, frame);
    frame = { ...frame, ...overrideFrame };
    return await jsonld.frame(jsonldDoc, frame);
  }

  private addDefaultTopLevelContextWithSKLPropertiesAndConvertNativeValues(
    jsonldDoc: any[],
    frame: Record<string, any>,
  ): void {
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
