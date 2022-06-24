import type { AxiosRequestConfig } from 'axios';
import type { OpenApiClientConfiguration } from './OpenApiClientConfiguration';
import { DUMMY_BASE_URL, toPathString, setSearchParams } from './OpenApiClientUtils';
import type { OperationWithPathInfo } from './OpenApiOperationExecutor';
import type { SecurityRequirement } from './OpenApiSchemaConfiguration';

export interface RequestArgs {
  url: string;
  options: AxiosRequestConfig;
}

/**
 * Factory that generates a RequestArgs object for an {@link OpenApiAxiosRequestFactory}
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

  public async createParams(args?: any, options: AxiosRequestConfig = {}): Promise<RequestArgs> {
    // Use dummy base URL string because the URL constructor only accepts absolute URLs.
    const urlObj = new URL(this.pathName, DUMMY_BASE_URL);
    const { baseOptions } = this.configuration ?? {};
    const requestOptions = { method: this.pathReqMethod, ...baseOptions, ...options };
    const headerParameter = {} as any;
    const queryParameter = {} as any;

    // Authentication oAuth required
    if (this.security && this.security.length > 0) {
      const oAuthSecurityType = this.security[0].oAuth;
      if (oAuthSecurityType) {
        await this.setOAuthToObject(headerParameter, 'oAuth', oAuthSecurityType);
      }
    }

    headerParameter['Content-Type'] = 'application/json';

    setSearchParams(urlObj, queryParameter);
    const headersFromBaseOptions = baseOptions?.headers ?? {};
    requestOptions.headers = { ...headerParameter, ...headersFromBaseOptions, ...options.headers };
    requestOptions.data = this.serializeDataIfNeeded(args, requestOptions);

    return {
      url: toPathString(urlObj),
      options: requestOptions,
    };
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
   * Helper that serializes data into a string if necessary.
   *
   * @param value - The value to be serialized
   * @param requestOptions - The request options from which to determine if the value should be serialized
   * @returns value or a serialized representation of value
   */
  private serializeDataIfNeeded(
    value: any,
    requestOptions: any,
  ): string {
    const nonString = typeof value !== 'string';
    const needsSerialization = nonString && this.configuration && this.configuration.isJsonMime
      ? this.configuration.isJsonMime(requestOptions.headers['Content-Type'])
      : nonString;
    return needsSerialization
      ? JSON.stringify(value !== undefined ? value : {})
      : value || '';
  }
}
