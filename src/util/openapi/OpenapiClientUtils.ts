import { OpenApiClientConfiguration } from "./OpenapiClientConfiguration";
import { RequiredError, RequestArgs } from "./OpenapiClientAxiosApi";
import { AxiosInstance, AxiosResponse } from 'axios';

export const DUMMY_BASE_URL = 'https://example.com'

export const assertParamExists = function (functionName: string, paramName: string, paramValue: unknown) {
  if (paramValue === null || paramValue === undefined) {
    throw new RequiredError(paramName, `Required parameter ${paramName} was null or undefined when calling ${functionName}.`);
  }
}

export const setApiKeyToObject = async function (object: any, keyParamName: string, configuration?: OpenApiClientConfiguration) {
  if (configuration && configuration.apiKey) {
    const localVarApiKeyValue = typeof configuration.apiKey === 'function'
      ? await configuration.apiKey(keyParamName)
      : await configuration.apiKey;
    object[keyParamName] = localVarApiKeyValue;
  }
}

export const setBasicAuthToObject = function (object: any, configuration?: OpenApiClientConfiguration) {
  if (configuration && (configuration.username || configuration.password)) {
    object["auth"] = { username: configuration.username, password: configuration.password };
  }
}

export const setBearerAuthToObject = async function (object: any, configuration?: OpenApiClientConfiguration) {
  if (configuration && configuration.accessToken) {
    const accessToken = typeof configuration.accessToken === 'function'
      ? await configuration.accessToken()
      : await configuration.accessToken;
    object["Authorization"] = "Bearer " + accessToken;
  }
}

export const setOAuthToObject = async function (object: any, name: string, scopes: string[], configuration?: OpenApiClientConfiguration) {
  if (configuration && configuration.accessToken) {
    const localVarAccessTokenValue = typeof configuration.accessToken === 'function'
      ? await configuration.accessToken(name, scopes)
      : await configuration.accessToken;
    object["Authorization"] = "Bearer " + localVarAccessTokenValue;
  }
}

export const setSearchParams = function (url: URL, ...objects: any[]) {
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

export const serializeDataIfNeeded = function (value: any, requestOptions: any, configuration?: OpenApiClientConfiguration) {
  const nonString = typeof value !== 'string';
  const needsSerialization = nonString && configuration && configuration.isJsonMime
    ? configuration.isJsonMime(requestOptions.headers['Content-Type'])
    : nonString;
  return needsSerialization
    ? JSON.stringify(value !== undefined ? value : {})
    : (value || "");
}

export const toPathString = function (url: URL) {
  return url.pathname + url.search + url.hash
}

export const createRequestFunction = function (axiosArgs: RequestArgs, globalAxios: AxiosInstance, BASE_PATH: string, configuration?: OpenApiClientConfiguration) {
  return <T = unknown, R = AxiosResponse<T>>(axios: AxiosInstance = globalAxios, basePath: string = BASE_PATH) => {
    const axiosRequestArgs = {...axiosArgs.options, url: (configuration?.basePath || basePath) + axiosArgs.url};
    return axios.request<T, R>(axiosRequestArgs);
  };
}
