import { VariableGenerator } from '../../../../src/storage/sparql/VariableGenerator';

describe('A VariableGenerator', (): void => {
  let generator: VariableGenerator;

  beforeEach(async(): Promise<void> => {
    generator = new VariableGenerator();
  });

  it('returns a unique variable upon each call to getNext.', (): void => {
    expect(generator.getNext()).toBe('c1');
    expect(generator.getNext()).toBe('c2');
    expect(generator.getNext()).toBe('c3');
    expect(generator.getNext()).toBe('c4');
    expect(generator.getNext()).toBe('c5');
    expect(generator.getNext()).toBe('c6');
    expect(generator.getNext()).toBe('c7');
    expect(generator.getNext()).toBe('c8');
    expect(generator.getNext()).toBe('c9');
    expect(generator.getNext()).toBe('c10');
    expect(generator.getNext()).toBe('c11');
  });
});
