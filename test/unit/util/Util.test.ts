/* eslint-disable @typescript-eslint/naming-convention */
import { Quad, NamedNode } from 'n3';
import {
  constructUri,
  stringToBoolean,
  stringToInteger,
  convertJsonLdToQuads,
  toJSON,
  ensureArray,
} from '../../../src/util/Util';

describe('Util', (): void => {
  describe('#constructUri', (): void => {
    it('returns a string with the base param prepended to the local param.', (): void => {
      expect(constructUri('https://example.com/', 'property')).toBe('https://example.com/property');
    });
  });

  describe('#stringToBoolean', (): void => {
    it('returns true if the value is the "true" string.', (): void => {
      expect(stringToBoolean('true')).toBe(true);
    });

    it('returns false if the value is the "false" string.', (): void => {
      expect(stringToBoolean('false')).toBe(false);
    });

    it('returns the value if the value is not the "true" or "false" string.', (): void => {
      expect(stringToBoolean('abc')).toBe('abc');
    });
  });

  describe('#stringToInteger', (): void => {
    it('returns the value as an integer if it is a string encoded integer.', (): void => {
      expect(stringToInteger('123')).toBe(123);
      expect(stringToInteger('1')).toBe(1);
    });

    it('returns string if it is not a string encoded integer.', (): void => {
      expect(stringToInteger('1.4')).toBe('1.4');
      expect(stringToInteger('123.45')).toBe('123.45');
      expect(stringToInteger('abc')).toBe('abc');
      expect(stringToInteger('abc123')).toBe('abc123');
    });
  });

  describe('#convertJsonLdToQuads', (): void => {
    it('converts the input jsonLd to a store of quads.', async(): Promise<void> => {
      const jsonld = [{
        '@id': 'https://skl.standard.storage/data/123',
        '@type': 'https://skl.standard.storage/nouns/File',
      }];
      const res = await convertJsonLdToQuads(jsonld);
      expect(res.size).toBe(1);
      expect(res.has(new Quad(
        new NamedNode('https://skl.standard.storage/data/123'),
        new NamedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
        new NamedNode('https://skl.standard.storage/nouns/File'),
      ))).toBe(true);
    });
  });

  describe('#toJSON', (): void => {
    it('removes @context, @id, and @type keys from the jsonLd NodeObject.', (): void => {
      const jsonld = {
        '@context': {
          name: 'https://skl.standard.storage/properties/name',
        },
        '@id': 'https://skl.standard.storage/data/123',
        '@type': 'https://skl.standard.storage/nouns/File',
        name: 'image.jpeg',
      };
      expect(toJSON(jsonld)).toEqual({
        name: 'image.jpeg',
      });
    });
    it('removes @context, @id, and @type keys from all nested objects if convertBeyondFirstLevel is true.',
      (): void => {
        const jsonld = {
          '@context': {
            name: 'https://skl.standard.storage/properties/name',
          },
          '@id': 'https://skl.standard.storage/data/123',
          '@type': 'https://skl.standard.storage/nouns/File',
          name: 'image.jpeg',
          subFileArr: [
            {
              '@id': 'https://skl.standard.storage/data/123',
              '@type': 'https://skl.standard.storage/nouns/File',
              md5: 'abc123',
            },
          ],
          subFileObj: {
            '@id': 'https://skl.standard.storage/data/123',
            '@type': 'https://skl.standard.storage/nouns/File',
            md5: 'abc123',
          },
        };
        expect(toJSON(jsonld, true)).toEqual({
          name: 'image.jpeg',
          subFileArr: [
            { md5: 'abc123' },
          ],
          subFileObj: { md5: 'abc123' },
        });
      });
  });

  describe('#ensureArray', (): void => {
    it('returns an empty array if the arrayable is null or undefined.', (): void => {
      expect(ensureArray(null)).toEqual([]);
      expect(ensureArray(undefined)).toEqual([]);
    });

    it('returns the arrayable if it is an array.', (): void => {
      expect(ensureArray([ 'a' ])).toEqual([ 'a' ]);
    });

    it('returns an array with the arrayable as the only value if the arrayable is not an array.',
      (): void => {
        expect(ensureArray('a')).toEqual([ 'a' ]);
      });
  });
});
