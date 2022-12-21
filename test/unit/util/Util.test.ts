/* eslint-disable @typescript-eslint/naming-convention */
import { Quad, NamedNode } from 'n3';
import {
  constructUri,
  convertJsonLdToQuads,
  toJSON,
  ensureArray,
  isUrl,
  getValueOfFieldInNodeObject,
} from '../../../src/util/Util';

describe('Util', (): void => {
  describe('#constructUri', (): void => {
    it('returns a string with the base param prepended to the local param.', (): void => {
      expect(constructUri('https://example.com/', 'property')).toBe('https://example.com/property');
    });
  });

  describe('#convertJsonLdToQuads', (): void => {
    it('converts the input jsonLd to a store of quads.', async(): Promise<void> => {
      const jsonld = [{
        '@id': 'https://skl.standard.storage/data/123',
        '@type': 'https://skl.standard.storage/File',
      }];
      const res = await convertJsonLdToQuads(jsonld);
      expect(res.size).toBe(1);
      expect(res.has(new Quad(
        new NamedNode('https://skl.standard.storage/data/123'),
        new NamedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
        new NamedNode('https://skl.standard.storage/File'),
      ))).toBe(true);
    });
  });

  describe('#toJSON', (): void => {
    it('removes @context, @id, and @type keys from the jsonLd NodeObject.', (): void => {
      const jsonld = {
        '@context': {
          name: 'https://skl.standard.storage/name',
        },
        '@id': 'https://skl.standard.storage/data/123',
        '@type': 'https://skl.standard.storage/File',
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
            name: 'https://skl.standard.storage/name',
          },
          '@id': 'https://skl.standard.storage/data/123',
          '@type': 'https://skl.standard.storage/File',
          name: 'image.jpeg',
          subFileArr: [
            {
              '@id': 'https://skl.standard.storage/data/123',
              '@type': 'https://skl.standard.storage/File',
              md5: 'abc123',
            },
          ],
          subFileObj: {
            '@id': 'https://skl.standard.storage/data/123',
            '@type': 'https://skl.standard.storage/File',
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

  describe('#getValueOfFieldInNodeObject', (): void => {
    it('returns undefined if the field is not in the object.', (): void => {
      expect(getValueOfFieldInNodeObject({}, 'https://example.com/predicate')).toBeUndefined();
    });

    it('returns the field value if it is not an object.', (): void => {
      expect(getValueOfFieldInNodeObject(
        { 'https://example.com/predicate': 'string' },
        'https://example.com/predicate',
      )).toBe('string');
    });

    it('returns the value of the field value if it is an object.', (): void => {
      expect(getValueOfFieldInNodeObject(
        { 'https://example.com/predicate': { '@value': 'string' }},
        'https://example.com/predicate',
      )).toBe('string');
    });
  });

  describe('#isUrl', (): void => {
    it('returns true for urls.', (): void => {
      expect(isUrl('https://example.com#hashThing')).toBe(true);
      expect(isUrl('http://example.org')).toBe(true);
      expect(isUrl('ftp://user:password@host:21/URI?queryParameters')).toBe(true);
    });

    it('returns false for non urls.', (): void => {
      expect(isUrl('example.com#hashThing')).toBe(false);
      expect(isUrl('http://')).toBe(false);
      expect(isUrl('/URI?queryParameters')).toBe(false);
      expect(isUrl('https://example.com hashThing')).toBe(false);
      expect(isUrl(1)).toBe(false);
      expect(isUrl(true)).toBe(false);
    });
  });
});
