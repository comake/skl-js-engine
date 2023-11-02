/* eslint-disable jest/no-disabled-tests */
/* eslint-disable @typescript-eslint/naming-convention */
import type { NodeObject } from 'jsonld';
import { SKLEngine } from '../../src/SklEngine';
import { getValueIfDefined } from '../../src/util/Util';
import { frameAndCombineSchemas } from '../util/Util';

describe('An SKL engine with user supplied functions', (): void => {
  it.skip('can execute mappings using the supplied functions.', async(): Promise<void> => {
    const schemaFiles = [
      './test/assets/schemas/divide-function.json',
    ];
    const schemas = await frameAndCombineSchemas(schemaFiles);
    const functions = {
      'http://example.com/idlab/function/divide'(data: Record<string | number, any>): number {
        const numerator = Number.parseFloat(data['http://example.com/idlab/function/numerator']);
        const denominator = Number.parseFloat(data['http://example.com/idlab/function/denominator']);
        return numerator / denominator;
      },
    };
    const engine = new SKLEngine({ type: 'memory', functions });
    await engine.save(schemas);
    const response = await engine.verb.divide<NodeObject>({
      noun: 'https://standardknowledge.com/ontologies/core/Equation',
      numerator: 10,
      denominator: 5,
    });
    expect(getValueIfDefined(response['https://example.com/answer'])).toBe(2);
  });
});
