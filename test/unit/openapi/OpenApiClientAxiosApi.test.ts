import globalAxios from 'axios';
import type { OpenApiAxiosParamFactory } from '../../../src/openapi/OpenApiAxiosParamFactory';
import { OpenApiClientAxiosApi } from '../../../src/openapi/OpenApiClientAxiosApi';

jest.mock('axios');

describe('An OpenApiAxiosRequestFactory', (): void => {
  const basePath = '/example/base/path';
  let axios: any;
  let paramsFactory: OpenApiAxiosParamFactory;
  let openApiClientAxiosApi: OpenApiClientAxiosApi;

  beforeEach(async(): Promise<void> => {
    axios = { request: jest.fn() };
    paramsFactory = {
      createParams: jest.fn().mockResolvedValue({
        options: { foo: 'bar' },
        url: '/api/endpoint',
      }),
    } as any;
  });

  it('creates an axios request function with the user supplied axios.', async(): Promise<void> => {
    openApiClientAxiosApi = new OpenApiClientAxiosApi(paramsFactory, basePath, axios);
    await openApiClientAxiosApi.sendRequest();
    expect(axios.request).toHaveBeenCalledWith({
      foo: 'bar',
      url: '/example/base/path/api/endpoint',
    });
  });

  it('creates an axios request function with the global axios if axios is not supplied.', async(): Promise<void> => {
    openApiClientAxiosApi = new OpenApiClientAxiosApi(paramsFactory, basePath);
    await openApiClientAxiosApi.sendRequest();
    expect(globalAxios.request).toHaveBeenCalledWith({
      foo: 'bar',
      url: '/example/base/path/api/endpoint',
    });
  });
});
