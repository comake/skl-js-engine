/* eslint-disable @typescript-eslint/naming-convention */
import * as RmlParser from '@comake/rmlmapper-js';
import type { NodeObject } from 'jsonld';
import jsonld from 'jsonld';
import type { OrArray } from '../util/Types';
import type { JSONObject } from '../util/Util';

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
    return await this.frame(result, frame);
  }

  private async doMapping(data: JSONObject, mapping: OrArray<NodeObject>): Promise<NodeObject[]> {
    const mappingAsQuads = await this.jsonLdToQuads(mapping);
    const sources = { 'input.json': JSON.stringify(data) };
    const options = { functions: this.functions };
    return await RmlParser.parse(mappingAsQuads, sources, options) as NodeObject[];
  }

  private async frame(
    jsonldDoc: any[],
    overrideFrame: Record<string, any>,
  ): Promise<NodeObject> {
    let frame: Record<string, any> = {
      '@context': {},
      '@embed': '@always',
    };
    frame = {
      ...frame,
      ...overrideFrame,
      '@context': { ...frame['@context'], ...overrideFrame?.['@context'] },
    };
    return await jsonld.frame(jsonldDoc, frame);
  }

  private async jsonLdToQuads(jsonldDoc: OrArray<NodeObject>): Promise<string> {
    return (await jsonld.toRDF(jsonldDoc, { format: 'application/n-quads' })) as unknown as string;
  }
}
