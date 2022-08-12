import { v4 as uuid } from 'uuid';
import { functions } from '../../../src/mapping/MapperFunctions';
import { GREL, IDLAB } from '../../../src/util/Vocabularies';

jest.mock('uuid', (): any => ({ v4: jest.fn().mockReturnValue('abc123') }));

describe('mapper functions', (): void => {
  describe('grel:array_join', (): void => {
    it('joins an array with a separator.', (): void => {
      expect(functions[GREL.arrayJoin]([ ',', 'a', 'b', 'c' ])).toBe('a,b,c');
    });
  });

  describe('grel:controls_if', (): void => {
    it('returns the any_true value if the bool_b value is the string "true".', (): void => {
      expect(functions[GREL.controlsIf]({
        [GREL.boolB]: 'true',
        [GREL.anyTrue]: 'it was true',
        [GREL.anyFalse]: 'it was false',
      })).toBe('it was true');
    });

    it('returns the any_true value if the bool_b value is the boolean true.', (): void => {
      expect(functions[GREL.controlsIf]({
        [GREL.boolB]: true,
        [GREL.anyTrue]: 'it was true',
        [GREL.anyFalse]: 'it was false',
      })).toBe('it was true');
    });

    it('returns the any_false value if the bool_b value is a string not equaling "true".', (): void => {
      expect(functions[GREL.controlsIf]({
        [GREL.boolB]: 'example',
        [GREL.anyTrue]: 'it was true',
        [GREL.anyFalse]: 'it was false',
      })).toBe('it was false');
    });

    it('returns the any_false value if the bool_b value the boolean false.', (): void => {
      expect(functions[GREL.controlsIf]({
        [GREL.boolB]: false,
        [GREL.anyTrue]: 'it was true',
        [GREL.anyFalse]: 'it was false',
      })).toBe('it was false');
    });

    it('returns the any_false value if the bool_b value is not a string or boolean.', (): void => {
      expect(functions[GREL.controlsIf]({
        [GREL.boolB]: 1,
        [GREL.anyTrue]: 'it was true',
        [GREL.anyFalse]: 'it was false',
      })).toBe('it was false');
    });

    it(`returns null if the any_false value is undefined
      and the bool_b value is not the "true" string or true boolean.`,
    (): void => {
      expect(functions[GREL.controlsIf]({
        [GREL.boolB]: 'example',
        [GREL.anyTrue]: 'it was true',
      })).toBeNull();
    });
  });

  describe('grel:string_endsWith', (): void => {
    it('returns true if the string_sub parameter ends with the valueParameter.', (): void => {
      expect(functions[GREL.stringEndsWith]({
        [GREL.stringSub]: 'ample',
        [GREL.valueParameter]: 'example',
      })).toBe(true);
    });

    it('returns false if the string_sub parameter does not end with the valueParameter.', (): void => {
      expect(functions[GREL.stringEndsWith]({
        [GREL.stringSub]: 'apple',
        [GREL.valueParameter]: 'example',
      })).toBe(false);
    });

    it('returns false if the string_sub parameter is not a string.', (): void => {
      expect(functions[GREL.stringEndsWith]({
        [GREL.stringSub]: 1234,
        [GREL.valueParameter]: 'example',
      })).toBe(false);
    });
  });

  describe('grel:string_replace', (): void => {
    it(`replaces all occurances of the p_string_find parameter with
      the p_string_replace parameter in the valueParameter.`,
    (): void => {
      expect(functions[GREL.stringReplace]({
        [GREL.pStringFind]: 'peter',
        [GREL.pStringReplace]: 'beth',
        [GREL.valueParameter]: 'peter was walking',
      })).toBe('beth was walking');
    });
  });

  describe('grel:date_now', (): void => {
    beforeAll((): void => {
      jest.useFakeTimers('modern');
      jest.setSystemTime(new Date(2022, 7, 12));
    });

    afterAll((): void => {
      jest.useRealTimers();
    });

    it('returns the current time as an ISO datetime string.', (): void => {
      expect(functions[GREL.dateNow]({})).toBe('2022-08-12T07:00:00.000Z');
    });
  });

  describe('idlab:equal', (): void => {
    it('returns true if the two args are equal.', (): void => {
      expect(functions[IDLAB.equal]([ 'abc', 'abc' ])).toBe(true);
      expect(functions[IDLAB.equal]([ 123, 123 ])).toBe(true);
      expect(functions[IDLAB.equal]([ 1.1234, 1.1234 ])).toBe(true);
      expect(functions[IDLAB.equal]([ true, true ])).toBe(true);
    });

    it('returns false if the two args are unequal.', (): void => {
      expect(functions[IDLAB.equal]([ 'abc', 'cba' ])).toBe(false);
      expect(functions[IDLAB.equal]([ true, 'true' ])).toBe(false);
      expect(functions[IDLAB.equal]([ 1, '1' ])).toBe(false);
    });
  });

  describe('idlab:notEqual', (): void => {
    it('returns false if the two args are equal.', (): void => {
      expect(functions[IDLAB.notEqual]([ 'abc', 'abc' ])).toBe(false);
      expect(functions[IDLAB.notEqual]([ 123, 123 ])).toBe(false);
      expect(functions[IDLAB.notEqual]([ 1.1234, 1.1234 ])).toBe(false);
      expect(functions[IDLAB.notEqual]([ true, true ])).toBe(false);
    });

    it('returns true if the two args are unequal.', (): void => {
      expect(functions[IDLAB.notEqual]([ 'abc', 'cba' ])).toBe(true);
      expect(functions[IDLAB.notEqual]([ true, 'true' ])).toBe(true);
      expect(functions[IDLAB.notEqual]([ 1, '1' ])).toBe(true);
    });
  });

  describe('idlab:getMimeType', (): void => {
    it('returns an mime type based on the filename string parameter.', (): void => {
      expect(functions[IDLAB.getMimeType]({ [IDLAB.str]: 'final_final.jpg' })).toBe('image/jpeg');
    });
  });

  describe('idlab:isNull', (): void => {
    it('returns true if the string parameter is an empty array.', (): void => {
      expect(functions[IDLAB.isNull]({ [IDLAB.str]: []})).toBe(true);
    });

    it('returns true if the string parameter is null.', (): void => {
      expect(functions[IDLAB.isNull]({ [IDLAB.str]: null })).toBe(true);
    });

    it('returns false if the string parameter is a non empty array.', (): void => {
      expect(functions[IDLAB.isNull]({ [IDLAB.str]: [ 'abc' ]})).toBe(false);
    });

    it('returns false if the string parameter is a non null value.', (): void => {
      expect(functions[IDLAB.isNull]({ [IDLAB.str]: 'abc' })).toBe(false);
    });
  });

  describe('idlab:random', (): void => {
    it('returns a random uuid.', (): void => {
      expect(functions[IDLAB.random]({})).toBe('abc123');
      expect(uuid).toHaveBeenCalledTimes(1);
    });
  });
});
