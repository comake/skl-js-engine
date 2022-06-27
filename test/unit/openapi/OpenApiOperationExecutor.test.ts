/* eslint-disable @typescript-eslint/naming-convention */
import { OpenApiAxiosParamFactory } from '../../../src/openapi/OpenApiAxiosParamFactory';
import { OpenApiClientAxiosApi } from '../../../src/openapi/OpenApiClientAxiosApi';
import { OpenApiOperationExecutor } from '../../../src/openapi/OpenApiOperationExecutor';
import type { OpenApi } from '../../../src/openapi/OpenApiSchemaConfiguration';

jest.mock('../../../src/openapi/OpenApiAxiosParamFactory');
jest.mock('../../../src/openapi/OpenApiClientAxiosApi');

describe('An OpenApiOperationExecutor', (): void => {
  const openApiDescription: OpenApi = {
    openapi: '3.0.3',
    info: {
      title: 'Dropbox v2 REST API',
      version: '1.0.0',
    },
    paths: {
      '/path/to/example': {
        post: {
          summary: 'Files - Get Metadata',
          description: 'Returns the metadata for a file or folder.\nNote: Metadata for the root folder is unsupported.',
          operationId: 'FilesGetMetadata',
          security: [{ oAuth: [ 'files.metadata.read' ]}],
        },
      },
    },
  };

  let configuration: any;
  let executor: any;
  let paramFactory: any;
  let sendRequest: any;

  beforeEach(async(): Promise<void> => {
    configuration = {};
    paramFactory = {};
    sendRequest = jest.fn().mockResolvedValue('request response');
    (OpenApiAxiosParamFactory as jest.Mock).mockReturnValue(paramFactory);
    (OpenApiClientAxiosApi as jest.Mock).mockReturnValue({ sendRequest });
  });

  it('executes the operation with the operationId in the configuration.', async(): Promise<void> => {
    configuration.basePath = '/example/base/path';
    executor = new OpenApiOperationExecutor(openApiDescription);
    const response = await executor.executeOperation(
      'FilesGetMetadata',
      configuration,
      { arg: 'abc' },
      { option: 123 },
    );
    expect(response).toBe('request response');
    expect(OpenApiClientAxiosApi).toHaveBeenCalledWith(paramFactory, '/example/base/path');
    expect(sendRequest).toHaveBeenCalledWith({ arg: 'abc' }, { option: 123 });
  });

  it(`uses the openApiDescription server url with any slashes removed from the
    end if no basePath is specified in the configuration.`,
  async(): Promise<void> => {
    openApiDescription.servers = [{ url: '/default/server/url/' }];
    executor = new OpenApiOperationExecutor(openApiDescription);
    const response = await executor.executeOperation('FilesGetMetadata', configuration);
    expect(response).toBe('request response');
    expect(OpenApiClientAxiosApi).toHaveBeenCalledWith(paramFactory, '/default/server/url');
  });

  it('throws an error if the operation cannot be found.', async(): Promise<void> => {
    executor = new OpenApiOperationExecutor(openApiDescription);
    await expect(executor.executeOperation('NonExistentOperationId', configuration))
      .rejects.toThrow(Error);
    await expect(executor.executeOperation('NonExistentOperationId', configuration))
      .rejects.toThrow('No OpenApi operation called NonExistentOperationId was found in Openapi description.');
  });
});
