import globalAxios from 'axios';
import type { AxiosPromise, AxiosInstance, AxiosRequestConfig } from 'axios';
import type { OpenApiClientConfiguration } from './OpenapiClientConfiguration';
import { DUMMY_BASE_URL, setOAuthToObject, setSearchParams, serializeDataIfNeeded,
  toPathString, createRequestFunction } from './OpenapiClientUtils';
import type { Operation } from './OpenapiSchemaConfiguration';

export const COLLECTION_FORMATS = {
  csv: ',',
  ssv: ' ',
  tsv: '\t',
  pipes: '|',
};

export interface RequestArgs {
  url: string;
  options: AxiosRequestConfig;
}

export type OpenApiClientOperations = Record<string, (args?: any, options?: any) => AxiosPromise>;

export class RequiredError extends Error {
  public readonly name: 'RequiredError' = 'RequiredError';

  public constructor(public field: string, msg?: string) {
    super(msg);
  }
}

/* eslint-disable-next-line @typescript-eslint/naming-convention */
function OpenApiAxiosParamFactory(
  pathName: string,
  pathReqMethod: string,
  operation: Operation,
  configuration?: OpenApiClientConfiguration,
): (args?: any, options?: AxiosRequestConfig) => Promise<RequestArgs> {
  return async function(args?: any, options: AxiosRequestConfig = {}): Promise<RequestArgs> {
    // Use dummy base URL string because the URL constructor only accepts absolute URLs.
    const urlObj = new URL(pathName, DUMMY_BASE_URL);
    const { baseOptions } = configuration ?? {};
    const requestOptions = { method: pathReqMethod, ...baseOptions, ...options };
    const headerParameter = {} as any;
    const queryParameter = {} as any;

    // Authentication oAuth required
    // oauth required
    if (operation.security && operation.security.length > 0) {
      const oAuthSecurityType = operation.security[0].oAuth;
      if (oAuthSecurityType) {
        await setOAuthToObject(headerParameter, 'oAuth', oAuthSecurityType, configuration);
      }
    }

    headerParameter['Content-Type'] = 'application/json';

    setSearchParams(urlObj, queryParameter);
    const headersFromBaseOptions = baseOptions?.headers ?? {};
    requestOptions.headers = { ...headerParameter, ...headersFromBaseOptions, ...options.headers };
    requestOptions.data = serializeDataIfNeeded(args, requestOptions, configuration);

    return {
      url: toPathString(urlObj),
      options: requestOptions,
    };
  };
}

/* eslint-disable-next-line @typescript-eslint/naming-convention */
function OpenApiAxiosRequestFactory(
  pathName: string,
  pathReqMethod: string,
  operation: Operation,
  configuration?: OpenApiClientConfiguration,
): (args?: any, options?: AxiosRequestConfig) => Promise<(axios?: AxiosInstance, basePath?: string) => AxiosPromise> {
  const paramFactory = OpenApiAxiosParamFactory(pathName, pathReqMethod, operation, configuration);

  return async function(
    args?: any,
    options?: AxiosRequestConfig,
  ): Promise<(axios?: AxiosInstance, basePath?: string) => AxiosPromise> {
    const axiosArgs = await paramFactory(args, options);
    return createRequestFunction(axiosArgs, globalAxios, '', configuration);
  };
}

/* eslint-disable-next-line @typescript-eslint/naming-convention */
export function OpenApiAxiosOperationFactory(
  pathName: string,
  pathReqMethod: string,
  operation: Operation,
  configuration: OpenApiClientConfiguration,
  basePath: string,
  axios?: AxiosInstance,
): (args?: any, options?: any) => Promise<AxiosPromise> {
  const requestFactory = OpenApiAxiosRequestFactory(pathName, pathReqMethod, operation, configuration);

  return async function(args?: any, options?: any): Promise<AxiosPromise> {
    const request = await requestFactory(args, options);
    return request(axios, basePath);
  };
}
