import type { AxiosRequestConfig, AxiosPromise } from 'axios';
import { OpenApiAxiosParamFactory } from './OpenApiAxiosParamFactory';
import { OpenApiClientAxiosApi } from './OpenApiClientAxiosApi';
import type { PathItem, Operation, OpenApi } from './OpenApiSchemaConfiguration';

export interface OpenApiClientConfiguration {
  /**
  * Parameter for apiKey security
  * @param name - security name
  */
  apiKey?: string | Promise<string> | ((name: string) => string) | ((name: string) => Promise<string>);
  /**
  * Parameter for basic security
  */
  username?: string;
  /**
  * Parameter for basic security
  */
  password?: string;
  /**
  * Parameter for oauth2 security
  * @param name - security name
  * @param scopes - oauth2 scope
  */
  accessToken?: string | Promise<string>
  | ((name?: string, scopes?: string[]) => string)
  | ((name?: string, scopes?: string[]) => Promise<string>);

  /**
  * Override base path
  */
  basePath?: string;
  /**
  * Base options for axios calls
  */
  baseOptions?: any;
  /**
  * The FormData constructor that will be used to create multipart form data
  * requests. You can inject this here so that execution environments that
  * do not support the FormData class can still run the generated client.
  */
  formDataCtor?: new () => any;
}

export interface PathInfo {
  pathName: string;
  pathReqMethod: string;
}

export type OperationWithPathInfo = Operation & PathInfo;

export class OpenApiOperationExecutor {
  private readonly openApiDescription: OpenApi;

  public constructor(openApiDescription: OpenApi) {
    this.openApiDescription = openApiDescription;
  }

  public async executeOperation(
    operationId: string,
    configuration: OpenApiClientConfiguration,
    args?: any,
    options?: AxiosRequestConfig,
  ): Promise<AxiosPromise> {
    const basePath = this.constructBasePath();
    const operationAndPathInfo = this.getOperationWithPathInfoMatchingOperationId(operationId);
    const paramFactory = new OpenApiAxiosParamFactory(operationAndPathInfo, configuration);
    const openApiClientApi = new OpenApiClientAxiosApi(paramFactory, configuration.basePath ?? basePath);
    return openApiClientApi.sendRequest(args, options);
  }

  private constructBasePath(): string {
    // eslint-disable-next-line unicorn/expiring-todo-comments
    // TODO support server variables in url
    if (this.openApiDescription.servers && this.openApiDescription.servers.length > 0) {
      return this.openApiDescription.servers[0].url.replace(/\/+$/u, '');
    }
    return '';
  }

  private getOperationWithPathInfoMatchingOperationId(operationId: string): OperationWithPathInfo {
    for (const pathName in this.openApiDescription.paths) {
      /* eslint-disable-next-line unicorn/prefer-object-has-own */
      if (Object.prototype.hasOwnProperty.call(this.openApiDescription.paths, pathName)) {
        const pathItem: PathItem = (this.openApiDescription.paths as any)[pathName];
        for (const pathReqMethod in pathItem) {
          /* eslint-disable-next-line unicorn/prefer-object-has-own */
          if (Object.prototype.hasOwnProperty.call(pathItem, pathReqMethod)) {
            const operation = (pathItem as any)[pathReqMethod];
            if (operation?.operationId === operationId) {
              return { ...(pathItem as any)[pathReqMethod], pathName, pathReqMethod };
            }
          }
        }
      }
    }

    throw new Error(`No OpenApi operation called ${operationId} was found in Openapi description.`);
  }
}
