import type { AxiosInstance, AxiosResponse } from 'axios';
import { RequiredError } from './OpenapiClientAxiosApi';
import type { RequestArgs } from './OpenapiClientAxiosApi';
import type { OpenApiClientConfiguration } from './OpenapiClientConfiguration';

export const DUMMY_BASE_URL = 'https://example.com';

export function assertParamExists(functionName: string, paramName: string, paramValue: unknown): void {
  if (paramValue === null || paramValue === undefined) {
    throw new RequiredError(
      paramName,
      `Required parameter ${paramName} was null or undefined when calling ${functionName}.`,
    );
  }
}

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

export function setBasicAuthToObject(object: any, configuration?: OpenApiClientConfiguration): void {
  if (configuration && (configuration.username ?? configuration.password)) {
    object.auth = { username: configuration.username, password: configuration.password };
  }
}

export async function setBearerAuthToObject(object: any, configuration?: OpenApiClientConfiguration): Promise<void> {
  if (configuration?.accessToken) {
    const accessToken = typeof configuration.accessToken === 'function'
      ? await configuration.accessToken()
      : await configuration.accessToken;
    object.Authorization = `Bearer ${accessToken}`;
  }
}

export async function setOAuthToObject(
  object: any,
  name: string,
  scopes: string[],
  configuration?: OpenApiClientConfiguration,
): Promise<void> {
  if (configuration?.accessToken) {
    const localVarAccessTokenValue = typeof configuration.accessToken === 'function'
      ? await configuration.accessToken(name, scopes)
      : await configuration.accessToken;
    object.Authorization = `Bearer ${localVarAccessTokenValue}`;
  }
}

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

export function serializeDataIfNeeded(
  value: any,
  requestOptions: any,
  configuration?: OpenApiClientConfiguration,
): string {
  const nonString = typeof value !== 'string';
  const needsSerialization = nonString && configuration && configuration.isJsonMime
    ? configuration.isJsonMime(requestOptions.headers['Content-Type'])
    : nonString;
  return needsSerialization
    ? JSON.stringify(value !== undefined ? value : {})
    : value || '';
}

export function toPathString(url: URL): string {
  return `${url.pathname}${url.search}${url.hash}`;
}

export function createRequestFunction(
  axiosArgs: RequestArgs,
  globalAxios: AxiosInstance,
  basePath: string,
  configuration?: OpenApiClientConfiguration,
): (axios: AxiosInstance, basePath: string) => Promise<any> {
  return <T = unknown, TR = AxiosResponse<T>>(
    axios: AxiosInstance = globalAxios,
    /* eslint-disable-next-line @typescript-eslint/naming-convention */
    BASE_PATH: string = basePath,
  ): Promise<TR> => {
    const axiosRequestArgs = { ...axiosArgs.options, url: (configuration?.basePath ?? BASE_PATH) + axiosArgs.url };
    return axios.request<T, TR>(axiosRequestArgs);
  };
}
