export interface OpenApiClientConfiguration {
  /**
  * Parameter for apiKey security
  * @param name - security name
  */
  apiKey?: string | Promise<string> | ((name: string) => string) | ((name: string) => Promise<string>);
  /**
  * Parameter for basic security
  */
  username?: string;
  /**
  * Parameter for basic security
  */
  password?: string;
  /**
  * Parameter for oauth2 security
  * @param name - security name
  * @param scopes - oauth2 scope
  */
  accessToken?: string | Promise<string>
  | ((name?: string, scopes?: string[]) => string)
  | ((name?: string, scopes?: string[]) => Promise<string>);

  /**
  * Override base path
  */
  basePath?: string;
  /**
  * Base options for axios calls
  */
  baseOptions?: any;
  /**
  * The FormData constructor that will be used to create multipart form data
  * requests. You can inject this here so that execution environments that
  * do not support the FormData class can still run the generated client.
  */
  formDataCtor?: new () => any;
}
