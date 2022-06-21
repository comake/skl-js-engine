import { OpenApiClientConfiguration } from './OpenapiClientConfiguration';
import { Operation } from './OpenapiSchemaConfiguration'
import globalAxios, { AxiosPromise, AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
// Some imports not used depending on template conditions
// @ts-ignore
import { DUMMY_BASE_URL, setOAuthToObject, setSearchParams, serializeDataIfNeeded, toPathString, createRequestFunction } from './OpenapiClientUtils';
// @ts-ignore

export const COLLECTION_FORMATS = {
  csv: ",",
  ssv: " ",
  tsv: "\t",
  pipes: "|",
};

export interface RequestArgs {
  url: string;
  options: AxiosRequestConfig;
}

export interface OpenApiClientOperations {
  [k: string]: (args?: any, options?: any) => AxiosPromise
}

export class RequiredError extends Error {
    name: "RequiredError" = "RequiredError";
    constructor(public field: string, msg?: string) {
        super(msg);
    }
}

export const OpenApiAxiosOperationFactory = function(pathName: string, pathReqMethod: string, operation: Operation, configuration: OpenApiClientConfiguration, basePath: string, axios?: AxiosInstance) {
  const requestFactory = OpenApiAxiosRequestFactory(pathName, pathReqMethod, operation, configuration)

  return async function(args?: any, options?: any): Promise<AxiosPromise> {
    const request = await requestFactory(args, options)
    return request(axios, basePath);
  }
};

const OpenApiAxiosRequestFactory = function(pathName: string, pathReqMethod: string, operation: Operation, configuration?: OpenApiClientConfiguration) {
  const paramFactory = OpenApiAxiosParamFactory(pathName, pathReqMethod, operation, configuration)

  return async function(args?: any, options?: AxiosRequestConfig): Promise<(axios?: AxiosInstance, basePath?: string) => AxiosPromise> {
    const axiosArgs = await paramFactory(args, options);
    return createRequestFunction(axiosArgs, globalAxios, "", configuration);
  }
};

const OpenApiAxiosParamFactory = function (pathName: string, pathReqMethod: string, operation: Operation, configuration?: OpenApiClientConfiguration) {
  return async function(args?: any, options: AxiosRequestConfig = {}): Promise<RequestArgs> {
    // use dummy base URL string because the URL constructor only accepts absolute URLs.
    const urlObj = new URL(pathName, DUMMY_BASE_URL);
    let baseOptions: any;
    if (configuration) {
        baseOptions = configuration.baseOptions;
    }

    const requestOptions = { method: pathReqMethod, ...baseOptions, ...options};
    const headerParameter = {} as any;
    const queryParameter = {} as any;

    // authentication oAuth required
    // oauth required
    if (operation.security && operation.security.length > 0) {
      const oAuthSecurityType = operation.security[0]['oAuth']
      if (oAuthSecurityType) {
        await setOAuthToObject(headerParameter, 'oAuth', oAuthSecurityType, configuration)
      }
    }

    // TODO may vary?
    headerParameter['Content-Type'] = 'application/json';

    setSearchParams(urlObj, queryParameter);
    let headersFromBaseOptions = baseOptions && baseOptions.headers ? baseOptions.headers : {};
    requestOptions.headers = {...headerParameter, ...headersFromBaseOptions, ...options.headers};
    requestOptions.data = serializeDataIfNeeded(args, requestOptions, configuration)

    return {
      url: toPathString(urlObj),
      options: requestOptions,
    };
  }
};
