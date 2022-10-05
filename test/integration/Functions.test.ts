/* eslint-disable @typescript-eslint/naming-convention */
import { Skql } from '../../src/Skql';
import { frameAndCombineSchemas } from '../util/Util';

describe('An Skql engine with user supplied functions', (): void => {
  it('can execute mappings using the supplied functions.', async(): Promise<void> => {
    const schemas = [
      './test/assets/schemas/divide-function.json',
    ];
    const schema = await frameAndCombineSchemas(schemas);
    const functions = {
      'http://example.com/idlab/function/divide'(data: Record<string | number, any>): number {
        const numerator = Number.parseFloat(data['http://example.com/idlab/function/numerator']);
        const denominator = Number.parseFloat(data['http://example.com/idlab/function/denominator']);
        return numerator / denominator;
      },
    };
    const skql = new Skql({ schema, functions });
    const response = await skql.do.divide({
      noun: 'https://skl.standard.storage/nouns/Equation',
      numerator: 10,
      denominator: 5,
    });
    expect(response['https://skl.standard.storage/properties/answer']).toBe(2);
  });
});
