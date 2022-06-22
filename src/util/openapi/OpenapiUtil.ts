import * as path from 'path';
import type { AxiosRequestConfig, AxiosPromise } from 'axios';
import { OpenApiAxiosOperationFactory } from './OpenapiClientAxiosApi';
import { OpenApiClientConfiguration } from './OpenapiClientConfiguration';
import type { ConfigurationParameters } from './OpenapiClientConfiguration';
import { OpenApiSchemaConfiguration } from './OpenapiSchemaConfiguration';
import type { PathItem, Operation, Paths } from './OpenapiSchemaConfiguration';

function constructBasePath(openApiConfig: OpenApiSchemaConfiguration): string {
  if (openApiConfig.servers && openApiConfig.servers.length > 0) {
    // eslint-disable-next-line unicorn/expiring-todo-comments
    // TODO support server variables in url
    return openApiConfig.servers[0].url.replace(/\/+$/u, '');
  }
  return '';
}

interface OperationAndPathInfo {
  pathName: string;
  pathReqMethod: string;
  operation: Operation;
}

function getOperationAndPathInfoMatchingOperationId(
  paths: Paths,
  operationId: string,
): OperationAndPathInfo {
  for (const pathName in paths) {
    /* eslint-disable-next-line unicorn/prefer-object-has-own */
    if (Object.prototype.hasOwnProperty.call(paths, pathName)) {
      const pathItem: PathItem = (paths as any)[pathName];
      for (const pathReqMethod in pathItem) {
        /* eslint-disable-next-line unicorn/prefer-object-has-own */
        if (Object.prototype.hasOwnProperty.call(pathItem, pathReqMethod) &&
          (path as any)[pathReqMethod].operationId === operationId
        ) {
          return { operation: (path as any)[pathReqMethod], pathName, pathReqMethod };
        }
      }
    }
  }

  throw new Error(`Could not find operation with id ${operationId} in paths`);
}

async function buildOperationFunction(
  operationId: string,
  configuration: OpenApiClientConfiguration,
  openApiConfig: OpenApiSchemaConfiguration,
): Promise<(args?: any, options?: any) => Promise<AxiosPromise>> {
  const basePath = constructBasePath(openApiConfig);
  const operationAndPathInfo = getOperationAndPathInfoMatchingOperationId(
    openApiConfig.paths,
    operationId,
  );
  return OpenApiAxiosOperationFactory(
    operationAndPathInfo.pathName,
    operationAndPathInfo.pathReqMethod,
    operationAndPathInfo.operation,
    configuration,
    basePath,
  );
}

// eslint-disable-next-line unicorn/expiring-todo-comments
// TODO: cache openapi config
export async function executeOpenApiOperation(
  operationId: string,
  openApiFileName: string,
  configurationParams: ConfigurationParameters,
  args?: any,
  options?: AxiosRequestConfig,
): Promise<AxiosPromise> {
  const openApiFilePath = path.resolve(__dirname, `../../../data/${openApiFileName}`);
  const configuration = new OpenApiClientConfiguration(configurationParams);
  const openApiConfig = new OpenApiSchemaConfiguration(openApiFilePath);
  const operationFunction = await buildOperationFunction(operationId, configuration, openApiConfig);
  if (operationFunction) {
    return operationFunction(args, options);
  }

  throw new Error(`No OpenApi operation called ${operationId} was found in ${openApiFileName}.`);
}
