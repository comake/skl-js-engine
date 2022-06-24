import type { OpenApiClientConfiguration } from './OpenApiClientConfiguration';

export const DUMMY_BASE_URL = 'https://example.com';

/**
 * Defines a new error type signifying that a field is required.
 */
export class RequiredError extends Error {
  public readonly name: 'RequiredError' = 'RequiredError';

  public constructor(public field: string, msg?: string) {
    super(msg);
  }
}

/**
 * Throws a RequiredError if paramName or paramValue are not set.
 *
 * @param functionName - The name of the function who's parameters are being validated
 * @param paramName - The name of the parameter
 * @param paramValue - The value of the parameter
 */
export function assertParamExists(functionName: string, paramName: string, paramValue: unknown): void {
  if (paramValue === null || paramValue === undefined) {
    throw new RequiredError(
      paramName,
      `Required parameter ${paramName} was null or undefined when calling ${functionName}.`,
    );
  }
}

/**
 * Sets an api key field of an object to the apiKey value in the {@link OpenApiClientConfiguration}.
 *
 * @param object - The object
 * @param keyParamName - The name of the key parameter to set
 * @param configuration - The OpenApiClientConfiguration
 */
export async function setApiKeyToObject(
  object: any,
  keyParamName: string,
  configuration?: OpenApiClientConfiguration,
): Promise<void> {
  if (configuration?.apiKey) {
    const localVarApiKeyValue = typeof configuration.apiKey === 'function'
      ? await configuration.apiKey(keyParamName)
      : await configuration.apiKey;
    object[keyParamName] = localVarApiKeyValue;
  }
}

/**
 * Sets the auth field of an object to the auth information of an {@link OpenApiClientConfiguration}.
 *
 * @param object - The object
 * @param configuration - The OpenApiClientConfiguration
 */
export function setBasicAuthToObject(object: any, configuration?: OpenApiClientConfiguration): void {
  if (configuration && (configuration.username ?? configuration.password)) {
    object.auth = { username: configuration.username, password: configuration.password };
  }
}

/**
 * Sets the search field of a URL object to supplied object(s).
 *
 * @param url - The URL object
 * @param objects - An array of objects
 */
export function setSearchParams(url: URL, ...objects: any[]): void {
  const searchParams = new URLSearchParams(url.search);
  for (const object of objects) {
    for (const key in object) {
      if (Array.isArray(object[key])) {
        searchParams.delete(key);
        for (const item of object[key]) {
          searchParams.append(key, item);
        }
      } else {
        searchParams.set(key, object[key]);
      }
    }
  }
  url.search = searchParams.toString();
}

/**
 * Transforms a URL object into a string containing it's path, search, and hash.
 *
 * @param url - The URL object
 * @returns A string with the URL object's pathName, search, and hash concatenated
 */
export function toPathString(url: URL): string {
  return `${url.pathname}${url.search}${url.hash}`;
}

/**
 * Check if the given MIME is a JSON MIME.
 * JSON MIME examples:
 *   application/json
 *   application/json; charset=UTF8
 *   APPLICATION/JSON
 *   application/vnd.company+json
 * @param mime - MIME (Multipurpose Internet Mail Extensions)
 * @returns True if the given MIME is JSON, false otherwise.
 */
export function isJsonMime(mime: string): boolean {
  const jsonMime = /^(application\/json|[^;/ \t]+\/[^;/ \t]+[+]json)[ \t]*(;.*)?$/iu;
  return mime !== null && (jsonMime.test(mime) || mime.toLowerCase() === 'application/json-patch+json');
}

/**
 * Helper that serializes data into a string if necessary.
 *
 * @param value - The value to be serialized
 * @param mimeType - The target mime type used to determine if the value should be serialized
 * @returns value or a serialized representation of value
 */
export function serializeDataIfNeeded(value: any, mimeType: string): string {
  const isString = typeof value === 'string';
  const needsSerialization = !isString && isJsonMime(mimeType);
  return needsSerialization
    ? JSON.stringify(value !== undefined ? value : {})
    : value || '';
}
