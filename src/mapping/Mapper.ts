/* eslint-disable @typescript-eslint/naming-convention, unicorn/expiring-todo-comments */
import * as RmlParser from '@comake/rmlmapper-js';
import type { NodeObject } from 'jsonld';
import jsonld from 'jsonld';
import type { OrArray } from '../util/Types';
import type { JSONObject } from '../util/Util';
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
    data: JSONObject,
    mapping: OrArray<NodeObject>,
    frame: Record<string, any>,
  ): Promise<NodeObject> {
    const result = await this.doMapping(data, mapping);
    return await this.frameAndConvertToNativeTypes(result, frame);
  }

  public async applyAndFrameSklProperties(
    data: JSONObject,
    mapping: OrArray<NodeObject>,
    frame: Record<string, any>,
  ): Promise<NodeObject> {
    const result = await this.doMapping(data, mapping);
    return await this.frameSklPropertiesAndConvertToNativeTypes(result, frame);
  }

  private async doMapping(data: JSONObject, mapping: OrArray<NodeObject>): Promise<NodeObject[]> {
    const mappingAsQuads = await this.jsonLdToQuads(mapping);
    const sources = { 'input.json': JSON.stringify(data) };
    const options = { functions: this.functions };
    // TODO always return arrays...
    return await RmlParser.parse(mappingAsQuads, sources, options) as NodeObject[];
  }

  private async frameAndConvertToNativeTypes(
    jsonldDoc: any[],
    overrideFrame: Record<string, any>,
  ): Promise<NodeObject> {
    let frame: Record<string, any> = {
      '@context': {},
      '@embed': '@always',
    };
    this.addDefaultTopLevelContextAndConvertNativeValues(jsonldDoc, frame);
    frame = {
      ...frame,
      ...overrideFrame,
      '@context': { ...frame['@context'], ...overrideFrame?.['@context'] },
    };
    return await jsonld.frame(jsonldDoc, frame);
  }

  private addDefaultTopLevelContextAndConvertNativeValues(
    jsonldDoc: any[],
    frame: Record<string, any>,
  ): void {
    for (const subDoc of jsonldDoc) {
      Object.keys(subDoc).forEach((key: string): void => {
        const value = subDoc[key];
        if (Array.isArray(value) && typeof value[0] === 'object' && '@type' in value[0]) {
          frame['@context'][key] = { '@type': value[0]['@type'] };
          subDoc[key] = subDoc[key].map((valueItem: any): void => this.convertToNativeValue(valueItem));
        } else if (Array.isArray(value) && typeof value[0] === 'object' && '@id' in value[0]) {
          frame['@context'][key] = { '@type': '@id' };
        } else if (typeof value === 'object' && '@type' in value) {
          frame['@context'][key] = { '@type': value['@type'] };
          subDoc[key] = this.convertToNativeValue(subDoc[key]);
        } else if (typeof value === 'object' && '@id' in value) {
          frame['@context'][key] = { '@type': '@id' };
        }
      });
    }
  }

  private async frameSklPropertiesAndConvertToNativeTypes(
    jsonldDoc: any[],
    overrideFrame: Record<string, any>,
  ): Promise<NodeObject> {
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
    for (const subDoc of jsonldDoc) {
      Object.keys(subDoc).forEach((key: string): void => {
        if (key.startsWith(SKL.properties)) {
          const argName = key.slice(SKL.properties.length);
          const value = subDoc[key];
          if (Array.isArray(value) && typeof value[0] === 'object' && '@type' in value[0]) {
            frame['@context'][argName] = { '@id': key, '@type': value[0]['@type'] };
            subDoc[key] = subDoc[key].map((valueItem: any): void =>
              this.convertToNativeValue(valueItem));
          } else if (Array.isArray(value) && typeof value[0] === 'object' && '@id' in value[0]) {
            frame['@context'][argName] = { '@id': key, '@type': '@id' };
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
    }
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

  private async jsonLdToQuads(jsonldDoc: OrArray<NodeObject>): Promise<string> {
    return (await jsonld.toRDF(jsonldDoc, { format: 'application/n-quads' })) as unknown as string;
  }
}
