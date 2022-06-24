import type { AxiosRequestConfig } from 'axios';
import type { OpenApiClientConfiguration } from './OpenApiClientConfiguration';
import { DUMMY_BASE_URL, toPathString, serializeDataIfNeeded } from './OpenApiClientUtils';
import type { OperationWithPathInfo } from './OpenApiOperationExecutor';
import type { SecurityRequirement } from './OpenApiSchemaConfiguration';

export interface AxiosRequestParams {
  url: string;
  options: AxiosRequestConfig;
}

/**
 * Factory that generates a RequestParams object for an {@link OpenApiAxiosRequestFactory}
 */
export class OpenApiAxiosParamFactory {
  private readonly pathName: string;
  private readonly pathReqMethod: string;
  private readonly security?: SecurityRequirement[];
  private readonly configuration?: OpenApiClientConfiguration;

  public constructor(
    operationWithPathInfo: OperationWithPathInfo,
    configuration?: OpenApiClientConfiguration,
  ) {
    this.pathName = operationWithPathInfo.pathName;
    this.pathReqMethod = operationWithPathInfo.pathReqMethod;
    this.security = operationWithPathInfo.security;
    this.configuration = configuration;
  }

  public async createParams(args?: any, options: AxiosRequestConfig = {}): Promise<AxiosRequestParams> {
    // Use dummy base URL string because the URL constructor only accepts absolute URLs.
    const urlObj = new URL(this.pathName, DUMMY_BASE_URL);
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const headerParameter = { 'Content-Type': 'application/json' };
    await this.setOAuthSecurityIfNeeded(headerParameter);

    return {
      url: toPathString(urlObj),
      options: this.constructRequestOptions(options, headerParameter, args),
    };
  }

  /**
   * Sets the oAuth settings on the headerParameters object if oAuth security is set.
   */
  private async setOAuthSecurityIfNeeded(headerParameter: any): Promise<void> {
    if (this.security && this.security.length > 0) {
      const oAuthSecurityType = this.security[0].oAuth;
      if (oAuthSecurityType) {
        await this.setOAuthToObject(headerParameter, 'oAuth', oAuthSecurityType);
      }
    }
  }

  /**
   * Helper that sets the Authorization field of an object. Generates an access token
   * if the configuration specifies an access token generation function, just uses the value if not.
   *
   * @param object - The object
   * @param name - The security name used to generate an access token
   * @param scopes - oauth2 scopes used to generate an access token
   */
  private async setOAuthToObject(
    object: any,
    name: string,
    scopes: string[],
  ): Promise<void> {
    if (this.configuration?.accessToken) {
      const localVarAccessTokenValue = typeof this.configuration.accessToken === 'function'
        ? await this.configuration.accessToken(name, scopes)
        : await this.configuration.accessToken;
      object.Authorization = `Bearer ${localVarAccessTokenValue}`;
    }
  }

  /**
   * Helper that constructs the request options.
   *
   * @param options - The AxiosRequestConfig options object
   * @param headerParameter - The header parameter object
   * @param args - The operation arguments
   * @returns The request options object
   */
  private constructRequestOptions(
    options: AxiosRequestConfig,
    headerParameter: any,
    args?: any,
  ): AxiosRequestConfig {
    const { baseOptions } = this.configuration ?? {};
    const requestOptions = {
      method: this.pathReqMethod,
      ...baseOptions,
      ...options,
      headers: {
        ...headerParameter,
        ...baseOptions?.headers,
        ...options.headers,
      },
    };
    requestOptions.data = serializeDataIfNeeded(args, requestOptions.headers['Content-Type']);
    return requestOptions;
  }
}
