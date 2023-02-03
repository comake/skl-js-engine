/* eslint-disable @typescript-eslint/naming-convention */
import { Quad, NamedNode } from 'n3';
import {
  convertJsonLdToQuads,
  toJSON,
  ensureArray,
  isUrl,
  getValueIfDefined,
} from '../../../src/util/Util';

describe('Util', (): void => {
  describe('#convertJsonLdToQuads', (): void => {
    it('converts the input jsonLd to a store of quads.', async(): Promise<void> => {
      const jsonld = [{
        '@id': 'https://example.com/data/123',
        '@type': 'https://standardknowledge.com/ontologies/core/File',
      }];
      const res = await convertJsonLdToQuads(jsonld);
      expect(res.size).toBe(1);
      expect(res.has(new Quad(
        new NamedNode('https://example.com/data/123'),
        new NamedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
        new NamedNode('https://standardknowledge.com/ontologies/core/File'),
      ))).toBe(true);
    });
  });

  describe('#toJSON', (): void => {
    it('removes @context, @id, and @type keys from the jsonLd NodeObject.', (): void => {
      const jsonld = {
        '@context': {
          label: 'http://www.w3.org/2000/01/rdf-schema#label',
        },
        '@id': 'https://example.com/data/123',
        '@type': 'https://standardknowledge.com/ontologies/core/File',
        label: 'image.jpeg',
      };
      expect(toJSON(jsonld)).toEqual({
        label: 'image.jpeg',
      });
    });
    it('removes @context, @id, and @type keys from all nested objects if convertBeyondFirstLevel is true.',
      (): void => {
        const jsonld = {
          '@context': {
            label: 'http://www.w3.org/2000/01/rdf-schema#label',
          },
          '@id': 'https://example.com/data/123',
          '@type': 'https://standardknowledge.com/ontologies/core/File',
          label: 'image.jpeg',
          subFileArr: [
            {
              '@id': 'https://example.com/data/123',
              '@type': 'https://standardknowledge.com/ontologies/core/File',
              md5: 'abc123',
            },
          ],
          subFileObj: {
            '@id': 'https://example.com/data/123',
            '@type': 'https://standardknowledge.com/ontologies/core/File',
            md5: 'abc123',
          },
        };
        expect(toJSON(jsonld, true)).toEqual({
          label: 'image.jpeg',
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

  describe('#getValueIfDefined', (): void => {
    it('returns the value at the @value key of the nodeObject if it\'s defined.', (): void => {
      expect(getValueIfDefined({ '@value': { alpha: 1 }})).toEqual({ alpha: 1 });
      expect(getValueIfDefined({ '@value': 1 })).toBe(1);
      expect(getValueIfDefined({ '@value': false })).toBe(false);
      expect(getValueIfDefined({})).toBeUndefined();
    });

    it('returns null if the nodeObject is not defined or null.', (): void => {
      expect(getValueIfDefined(undefined)).toBeUndefined();
      expect(getValueIfDefined(null)).toBeUndefined();
    });

    it('returns all values from an array of value objects.', (): void => {
      expect(
        getValueIfDefined([
          { '@value': 1 },
          { '@value': 2 },
        ]),
      ).toEqual([ 1, 2 ]);
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
