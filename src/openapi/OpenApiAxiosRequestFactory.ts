import globalAxios from 'axios';
import type { AxiosPromise, AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import type { OpenApiAxiosParamFactory, AxiosRequestParams } from './OpenApiAxiosParamFactory';

/**
 * Factory that generates an Axios request for an OpenApi operation
 */
export class OpenApiAxiosRequestFactory {
  private readonly paramFactory: OpenApiAxiosParamFactory;
  private readonly basePath?: string;

  public constructor(
    paramFactory: OpenApiAxiosParamFactory,
    basePath?: string,
  ) {
    this.basePath = basePath;
    this.paramFactory = paramFactory;
  }

  public async createRequest(
    args?: any,
    options?: AxiosRequestConfig,
  ): Promise<(axios?: AxiosInstance, basePath?: string) => AxiosPromise> {
    const axiosRequestParams = await this.paramFactory.createParams(args, options);
    return this.createRequestFunction(axiosRequestParams, '');
  }

  private createRequestFunction(
    axiosRequestParams: AxiosRequestParams,
    basePath: string,
  ): (axios?: AxiosInstance, basePath?: string) => AxiosPromise {
    return <T = unknown, TR = AxiosResponse<T>>(
      axios: AxiosInstance = globalAxios,
      /* eslint-disable-next-line @typescript-eslint/naming-convention */
      BASE_PATH: string = basePath,
    ): Promise<TR> => {
      const axiosRequestParamsWithBasePath = {
        ...axiosRequestParams.options,
        url: (this.basePath ?? BASE_PATH) + axiosRequestParams.url,
      };
      return axios.request<T, TR>(axiosRequestParamsWithBasePath);
    };
  }
}
