import * as path from 'path'
import { AxiosRequestConfig } from 'axios';
import { OpenApiClientConfiguration, ConfigurationParameters } from './OpenapiClientConfiguration'
import { OpenApiSchemaConfiguration, PathItem, Operation } from './OpenapiSchemaConfiguration'
import { OpenApiAxiosOperationFactory } from './OpenapiClientAxiosApi'

// TODO: cache openapi config
export async function executeOpenApiOperation(
  operationId: string,
  openApiFileName: string,
  configurationParams: ConfigurationParameters,
  args?: any,
  options?: AxiosRequestConfig
) {
  const openApiFilePath = path.resolve(__dirname, `../../../data/${openApiFileName}`);
  const configuration = new OpenApiClientConfiguration(configurationParams);
  const openApiConfig = new OpenApiSchemaConfiguration(openApiFilePath);
  const operationFunction = await buildOperationFunction(operationId, configuration, openApiConfig);
  if (operationFunction) {
    return operationFunction(args, options);
  }

  throw new Error(`No OpenApi operation called ${operationId} was found in ${openApiFileName}.`)
}

async function buildOperationFunction(operationId: string, configuration: OpenApiClientConfiguration, openApiConfig: OpenApiSchemaConfiguration) {
  const basePath = constructBasePath(openApiConfig);

  for(const pathName in openApiConfig.paths) {
    const path: PathItem = (openApiConfig.paths as any)[pathName];

    for(const pathReqMethod in path) {
      const operation: Operation = (path as any)[pathReqMethod]
      if (operation.operationId === operationId) {
        return OpenApiAxiosOperationFactory(pathName, pathReqMethod, operation, configuration, basePath);
      }
    }
  }
}

function constructBasePath(openApiConfig: OpenApiSchemaConfiguration) {
  if (openApiConfig.servers && openApiConfig.servers.length > 0) {
    // TODO support server variables in url
    return openApiConfig.servers[0].url.replace(/\/+$/, "");
  }
  return ''
}
