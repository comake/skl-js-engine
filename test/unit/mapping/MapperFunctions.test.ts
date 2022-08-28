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
      jest.setSystemTime(new Date('2022-08-12T00:00:00.000Z'));
    });

    afterAll((): void => {
      jest.useRealTimers();
    });

    it('returns the current time as an ISO datetime string.', (): void => {
      expect(functions[GREL.dateNow]({})).toBe('2022-08-12T00:00:00.000Z');
    });
  });

  describe('grel:date_inc', (): void => {
    it('returns a date with the specified unit added or subtracted.', (): void => {
      expect(functions[GREL.dateInc]({
        [GREL.pDateD]: '2022-08-12T00:00:00.000Z',
        [GREL.pDecN]: 2,
        [GREL.pStringUnit]: 'year',
      }))
        .toBe('2024-08-12T00:00:00.000Z');
      expect(functions[GREL.dateInc]({
        [GREL.pDateD]: '2022-08-12T00:00:00.000Z',
        [GREL.pDecN]: -2,
        [GREL.pStringUnit]: 'year',
      }))
        .toBe('2020-08-12T00:00:00.000Z');
      expect(functions[GREL.dateInc]({
        [GREL.pDateD]: '2022-08-12T00:00:00.000Z',
        [GREL.pDecN]: 1,
        [GREL.pStringUnit]: 'month',
      }))
        .toBe('2022-09-12T00:00:00.000Z');
      expect(functions[GREL.dateInc]({
        [GREL.pDateD]: '2022-08-12T00:00:00.000Z',
        [GREL.pDecN]: -3,
        [GREL.pStringUnit]: 'day',
      }))
        .toBe('2022-08-09T00:00:00.000Z');
      expect(functions[GREL.dateInc]({
        [GREL.pDateD]: '2022-08-12T00:00:00.000Z',
        [GREL.pDecN]: 5,
        [GREL.pStringUnit]: 'hour',
      }))
        .toBe('2022-08-12T05:00:00.000Z');
      expect(functions[GREL.dateInc]({
        [GREL.pDateD]: '2022-08-12T00:00:00.000Z',
        [GREL.pDecN]: 30,
        [GREL.pStringUnit]: 'minute',
      }))
        .toBe('2022-08-12T00:30:00.000Z');
      expect(functions[GREL.dateInc]({
        [GREL.pDateD]: '2022-08-12T00:00:00.000Z',
        [GREL.pDecN]: 59,
        [GREL.pStringUnit]: 'second',
      }))
        .toBe('2022-08-12T00:00:59.000Z');
    });
  });

  describe('grel:array_sum', (): void => {
    it('returns the sum of the arguments.', (): void => {
      expect(functions[GREL.arraySum]({ [GREL.pArrayA]: [ 1, 2, 3 ]})).toBe(6);
    });

    it('returns the p_array_a arg if it is not an array.', (): void => {
      expect(functions[GREL.arraySum]({ [GREL.pArrayA]: 3 })).toBe(3);
    });
  });

  describe('grel:array_product', (): void => {
    it('returns the product of the arguments.', (): void => {
      expect(functions[GREL.arrayProduct]({ [GREL.pArrayA]: [ 4, 2, 3 ]})).toBe(24);
    });

    it('returns the p_array_a arg if it is not an array.', (): void => {
      expect(functions[GREL.arrayProduct]({ [GREL.pArrayA]: 3 })).toBe(3);
    });
  });

  describe('grel:boolean_not', (): void => {
    it('returns false if the bool_b value is the string "true".', (): void => {
      expect(functions[GREL.booleanNot]({ [GREL.boolB]: 'true' })).toBe(false);
    });

    it('returns false if the bool_b value is the boolean true.', (): void => {
      expect(functions[GREL.booleanNot]({ [GREL.boolB]: true })).toBe(false);
    });

    it('returns true if the bool_b value is a string not equaling "true".', (): void => {
      expect(functions[GREL.booleanNot]({ [GREL.boolB]: 'example' })).toBe(true);
    });

    it('returns true if the bool_b value the boolean false.', (): void => {
      expect(functions[GREL.booleanNot]({ [GREL.boolB]: false })).toBe(true);
    });

    it('returns true if the bool_b value is not a string or boolean.', (): void => {
      expect(functions[GREL.booleanNot]({ [GREL.boolB]: 1 })).toBe(true);
    });
  });

  describe('grel:boolean_and', (): void => {
    it('returns false not all param_rep_b values are true.', (): void => {
      expect(functions[GREL.booleanAnd]([ false ])).toBe(false);
      expect(functions[GREL.booleanAnd]([ 'false' ])).toBe(false);
      expect(functions[GREL.booleanAnd]([ 'true', true, false ])).toBe(false);
      expect(functions[GREL.booleanAnd]([ true, false ])).toBe(false);
      expect(functions[GREL.booleanAnd]([ 'abc' ])).toBe(false);
    });

    it('returns true if all param_rep_b calues are true.', (): void => {
      expect(functions[GREL.booleanAnd]([ true ])).toBe(true);
      expect(functions[GREL.booleanAnd]([ 'true' ])).toBe(true);
      expect(functions[GREL.booleanAnd]([ 'true', true ])).toBe(true);
    });
  });

  describe('grel:boolean_or', (): void => {
    it('returns false none of the param_rep_b values are true.', (): void => {
      expect(functions[GREL.booleanOr]([ false ])).toBe(false);
      expect(functions[GREL.booleanOr]([ 'false' ])).toBe(false);
      expect(functions[GREL.booleanOr]([ false, '123' ])).toBe(false);
      expect(functions[GREL.booleanOr]([ 'has true in it' ])).toBe(false);
      expect(functions[GREL.booleanOr]([ 1 ])).toBe(false);
    });

    it('returns true if any of the param_rep_b calues are true.', (): void => {
      expect(functions[GREL.booleanOr]([ true ])).toBe(true);
      expect(functions[GREL.booleanOr]([ true, false ])).toBe(true);
      expect(functions[GREL.booleanOr]([ 'false', 'true' ])).toBe(true);
      expect(functions[GREL.booleanOr]([ 'abc', 123, 'true' ])).toBe(true);
    });
  });

  describe('grel:array_get', (): void => {
    it(`returns the element at index equal to the param_int_i_from arg
      if param_int_i_opt_to is not defined.`,
    (): void => {
      expect(functions[GREL.arrayGet]({
        [GREL.pArrayA]: [ 1, 2, 3 ],
        [GREL.paramIntIFrom]: 1,
      })).toBe(2);
    });

    it(`returns an array of the elements between indexes equalling the param_int_i_from arg
      and the param_int_i_opt_to arg.`,
    (): void => {
      expect(functions[GREL.arrayGet]({
        [GREL.pArrayA]: [ 1, 2, 3 ],
        [GREL.paramIntIFrom]: 1,
        [GREL.paramIntIOptTo]: 3,
      })).toEqual([ 2, 3 ]);
      expect(functions[GREL.arrayGet]({
        [GREL.pArrayA]: [ 1, 2, 3 ],
        [GREL.paramIntIFrom]: 0,
        [GREL.paramIntIOptTo]: 1,
      })).toEqual([ 1 ]);
    });
  });

  describe('grel:string_split', (): void => {
    it('returns the string split into an array on the separator.', (): void => {
      expect(functions[GREL.stringSplit]({
        [GREL.valueParameter]: 'my mother mary',
        [GREL.pStringSep]: ' ',
      })).toEqual([ 'my', 'mother', 'mary' ]);
    });
  });

  describe('grel:math_max', (): void => {
    it('returns the maximum of two numbers.', (): void => {
      expect(functions[GREL.max]({ [GREL.pDecN]: 3, [GREL.paramN2]: 2 })).toBe(3);
      expect(functions[GREL.max]({ [GREL.pDecN]: 34, [GREL.paramN2]: 43 })).toBe(43);
    });
  });

  describe('grel:math_min', (): void => {
    it('returns the minimum of two numbers.', (): void => {
      expect(functions[GREL.min]({ [GREL.pDecN]: 3, [GREL.paramN2]: 2 })).toBe(2);
      expect(functions[GREL.min]({ [GREL.pDecN]: 34, [GREL.paramN2]: 43 })).toBe(34);
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

  describe('idlab:concat', (): void => {
    it('returns the str and otherStr args joined by the delimiter.', (): void => {
      expect(functions[IDLAB.concat]({
        [IDLAB.str]: 'hello',
        [IDLAB.otherStr]: 'world',
        [IDLAB.delimiter]: ' ',
      })).toBe('hello world');
    });

    it('returns the str and otherStr args joined if no delimiter is supplied.', (): void => {
      expect(functions[IDLAB.concat]({
        [IDLAB.str]: 'hello',
        [IDLAB.otherStr]: 'world',
      })).toBe('helloworld');
    });
  });
});
