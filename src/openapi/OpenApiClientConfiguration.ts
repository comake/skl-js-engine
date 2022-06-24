/**
 * Dropbox v2 REST API
 * Dropbox\'s v2 REST API.
 *
 * The version of the OpenAPI document: 1.0.0
 */

export interface ConfigurationParameters {
  apiKey?: string | Promise<string> | ((name: string) => string) | ((name: string) => Promise<string>);
  username?: string;
  password?: string;
  accessToken?: string
  | Promise<string>
  | ((name?: string, scopes?: string[]) => string)
  | ((name?: string, scopes?: string[]) => Promise<string>);
  basePath?: string;
  baseOptions?: any;
  formDataCtor?: new () => any;
}

export class OpenApiClientConfiguration {
  /**
  * Parameter for apiKey security
  * @param name - security name
  */
  public apiKey?: string | Promise<string> | ((name: string) => string) | ((name: string) => Promise<string>);
  /**
  * Parameter for basic security
  */
  public username?: string;
  /**
  * Parameter for basic security
  */
  public password?: string;
  /**
  * Parameter for oauth2 security
  * @param name - security name
  * @param scopes - oauth2 scope
  */
  public accessToken?: string | Promise<string>
  | ((name?: string, scopes?: string[]) => string)
  | ((name?: string, scopes?: string[]) => Promise<string>);

  /**
  * Override base path
  */
  public basePath?: string;
  /**
  * Base options for axios calls
  */
  public baseOptions?: any;
  /**
  * The FormData constructor that will be used to create multipart form data
  * requests. You can inject this here so that execution environments that
  * do not support the FormData class can still run the generated client.
  */
  public formDataCtor?: new () => any;

  public constructor(param: ConfigurationParameters = {}) {
    this.apiKey = param.apiKey;
    this.username = param.username;
    this.password = param.password;
    this.accessToken = param.accessToken;
    this.basePath = param.basePath;
    this.baseOptions = param.baseOptions;
    this.formDataCtor = param.formDataCtor;
  }

  /**
   * Check if the given MIME is a JSON MIME.
   * JSON MIME examples:
   *   application/json
   *   application/json; charset=UTF8
   *   APPLICATION/JSON
   *   application/vnd.company+json
   * @param mime - MIME (Multipurpose Internet Mail Extensions)
   * @returns True if the given MIME is JSON, false otherwise.
   */
  public isJsonMime(mime: string): boolean {
    const jsonMime = /^(application\/json|[^;/ \t]+\/[^;/ \t]+[+]json)[ \t]*(;.*)?$/iu;
    return mime !== null && (jsonMime.test(mime) || mime.toLowerCase() === 'application/json-patch+json');
  }
}
