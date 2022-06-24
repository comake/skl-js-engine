import type { AxiosPromise, AxiosInstance } from 'axios';
import type { OpenApiAxiosRequestFactory } from './OpenApiAxiosRequestFactory';

/**
 * Sends Axios requests for OpenApi operations.
 */
export class OpenApiClientAxiosApi {
  private readonly requestFactory: OpenApiAxiosRequestFactory;
  private readonly axios?: AxiosInstance;
  private readonly basePath: string;

  public constructor(
    requestFactory: OpenApiAxiosRequestFactory,
    basePath: string,
    axios?: AxiosInstance,
  ) {
    this.requestFactory = requestFactory;
    this.axios = axios;
    this.basePath = basePath;
  }

  public async sendRequest(args?: any, options?: any): Promise<AxiosPromise> {
    const request = await this.requestFactory.createRequest(args, options);
    return request(this.axios, this.basePath);
  }
}
