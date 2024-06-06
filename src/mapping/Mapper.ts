/* eslint-disable @typescript-eslint/naming-convention */
import * as RmlParser from '@comake/rmlmapper-js';
import type { NodeObject } from 'jsonld';
import jsonld from 'jsonld';
import { Logger } from '../logger';
import type { OrArray, JSONValue } from '../util/Types';

export interface MapperArgs {
  functions?: Record<string, (args: any | any[]) => any>;
}

export class Mapper {
  private readonly functions?: Record<string, (args: any | any[]) => any>;

  public constructor(args?: MapperArgs) {
    this.functions = args?.functions;
  }

  public async apply(
    data: JSONValue,
    mapping: OrArray<NodeObject>,
    frame: Record<string, any>,
  ): Promise<NodeObject> {
    const result = await this.doMapping(data, mapping);
    Logger.getInstance().log('Mapping result', JSON.stringify(result));
    const frameResult = await this.frame(result, frame);
    Logger.getInstance().log('Frame Result', JSON.stringify(frameResult));
    return frameResult;
  }

  private async doMapping(data: JSONValue, mapping: OrArray<NodeObject>): Promise<NodeObject[]> {
    const sources = { 'input.json': JSON.stringify(data) };
    const options = { functions: this.functions };
    const mappingNodeObject = Array.isArray(mapping)
      ? { '@graph': mapping }
      : mapping;
    return await RmlParser.parseJsonLd(mappingNodeObject, sources, options) as NodeObject[];
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
}
