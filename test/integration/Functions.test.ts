/* eslint-disable @typescript-eslint/naming-convention */
import { Skql } from '../../src/Skql';
import { getValueIfDefined } from '../../src/util/Util';
import { frameAndCombineSchemas } from '../util/Util';

describe('An Skql engine with user supplied functions', (): void => {
  it('can execute mappings using the supplied functions.', async(): Promise<void> => {
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
    const skql = new Skql({ type: 'memory', schemas, functions });
    const response = await skql.verb.divide({
      noun: 'https://standardknowledge.com/ontologies/core/Equation',
      numerator: 10,
      denominator: 5,
    });
    expect(getValueIfDefined(response['https://example.com/answer'])).toBe(2);
  });
});
