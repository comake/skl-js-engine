import globalAxios from 'axios';
import type { AxiosPromise, AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import type { OpenApiAxiosParamFactory, RequestArgs } from './OpenApiAxiosParamFactory';
import type { OpenApiClientConfiguration } from './OpenApiClientConfiguration';

/**
 * Factory that generates an Axios request for an OpenApi operation
 */
export class OpenApiAxiosRequestFactory {
  private readonly paramFactory: OpenApiAxiosParamFactory;
  private readonly configuration?: OpenApiClientConfiguration;

  public constructor(
    paramFactory: OpenApiAxiosParamFactory,
    configuration?: OpenApiClientConfiguration,
  ) {
    this.configuration = configuration;
    this.paramFactory = paramFactory;
  }

  public async createRequest(
    args?: any,
    options?: AxiosRequestConfig,
  ): Promise<(axios?: AxiosInstance, basePath?: string) => AxiosPromise> {
    const axiosArgs = await this.paramFactory.createParams(args, options);
    return this.createRequestFunction(axiosArgs, '');
  }

  private createRequestFunction(
    axiosArgs: RequestArgs,
    basePath: string,
  ): (axios?: AxiosInstance, basePath?: string) => AxiosPromise {
    return <T = unknown, TR = AxiosResponse<T>>(
      axios: AxiosInstance = globalAxios,
      /* eslint-disable-next-line @typescript-eslint/naming-convention */
      BASE_PATH: string = basePath,
    ): Promise<TR> => {
      const axiosRequestArgs = {
        ...axiosArgs.options,
        url: (this.configuration?.basePath ?? BASE_PATH) + axiosArgs.url,
      };
      return axios.request<T, TR>(axiosRequestArgs);
    };
  }
}
