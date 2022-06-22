import * as fs from 'fs';
import * as yaml from 'js-yaml';

export type Parameter = ExampleXORExamples & SchemaXORContent & ParameterLocation;
// Schema and content are mutually exclusive, at least one is required
export type SchemaXORContent =
 | Record<string, unknown>
 | Record<string, unknown>;

// Parameter location
export type ParameterLocation =
 | {
   in?: 'path';
   style?: 'matrix' | 'label' | 'simple';
   required: true;
   [k: string]: unknown;
 }
 | {
   in?: 'query';
   style?: 'form' | 'spaceDelimited' | 'pipeDelimited' | 'deepObject';
   [k: string]: unknown;
 }
 | {
   in?: 'header';
   style?: 'simple';
   [k: string]: unknown;
 }
 | {
   in?: 'cookie';
   style?: 'form';
   [k: string]: unknown;
 };
export type MediaType = ExampleXORExamples;
export type Header = ExampleXORExamples & SchemaXORContent;
export type SecurityScheme =
 | APIKeySecurityScheme
 | HTTPSecurityScheme
 | OAuth2SecurityScheme
 | OpenIdConnectSecurityScheme;
export type HTTPSecurityScheme =
 | {
   scheme?: string;
   [k: string]: unknown;
 }
 | {
   scheme?: Record<string, unknown>;
   [k: string]: unknown;
 };

// Validation schema for OpenAPI Specification 3.0.X.
export interface OpenApi {
  openapi: string;
  info: Info;
  externalDocs?: ExternalDocumentation;
  servers?: Server[];
  security?: SecurityRequirement[];
  tags?: Tag[];
  paths: Paths;
  components?: Components;
  /**
  * This interface was referenced by `OpenApi`'s JSON-Schema definition
  * via the `patternProperty` "^x-".
  */
  [k: string]: unknown;
}
export interface Info {
  title: string;
  description?: string;
  termsOfService?: string;
  contact?: Contact;
  license?: License;
  version: string;
  /**
  * This interface was referenced by `Info`'s JSON-Schema definition
  * via the `patternProperty` "^x-".
  */
  [k: string]: unknown;
}
export interface Contact {
  name?: string;
  url?: string;
  email?: string;
  /**
  * This interface was referenced by `Contact`'s JSON-Schema definition
  * via the `patternProperty` "^x-".
  */
  [k: string]: unknown;
}
export interface License {
  name: string;
  url?: string;
  /**
  * This interface was referenced by `License`'s JSON-Schema definition
  * via the `patternProperty` "^x-".
  */
  [k: string]: unknown;
}
export interface ExternalDocumentation {
  description?: string;
  url: string;
  /**
  * This interface was referenced by `ExternalDocumentation`'s JSON-Schema definition
  * via the `patternProperty` "^x-".
  */
  [k: string]: unknown;
}
export interface Server {
  url: string;
  description?: string;
  variables?: Record<string, ServerVariable>;
  /**
  * This interface was referenced by `Server`'s JSON-Schema definition
  * via the `patternProperty` "^x-".
  */
  [k: string]: unknown;
}
export interface ServerVariable {
  enum?: string[];
  default: string;
  description?: string;
  /**
  * This interface was referenced by `ServerVariable`'s JSON-Schema definition
  * via the `patternProperty` "^x-".
  */
  [k: string]: unknown;
}
export type SecurityRequirement = Record<string, string[]>;

export interface Tag {
  name: string;
  description?: string;
  externalDocs?: ExternalDocumentation;
  /**
  * This interface was referenced by `Tag`'s JSON-Schema definition
  * via the `patternProperty` "^x-".
  */
  [k: string]: unknown;
}
export interface Paths {}
/**
 * This interface was referenced by `Paths`'s JSON-Schema definition
 * via the `patternProperty` "^\/".
 */
export interface PathItem {
  $ref?: string;
  summary?: string;
  description?: string;
  servers?: Server[];
  parameters?: (Parameter | Reference)[];
}
// Example and examples are mutually exclusive
export type ExampleXORExamples = Record<string, unknown>;

/**
 * This interface was referenced by `Reference`'s JSON-Schema definition
 * via the `patternProperty` "^\$ref$".
 */
export type Reference = Record<string, string>;

/**
 * This interface was referenced by `PathItem`'s JSON-Schema definition
 * via the `patternProperty` "^(get|put|post|delete|options|head|patch|trace)$".
 */
export interface Operation {
  tags?: string[];
  summary?: string;
  description?: string;
  externalDocs?: ExternalDocumentation;
  operationId?: string;
  parameters?: (Parameter | Reference)[];
  requestBody?: RequestBody | Reference;
  responses: Responses;
  callbacks?: Record<string, Callback | Reference>;
  deprecated?: boolean;
  security?: SecurityRequirement[];
  servers?: Server[];
  /**
   * This interface was referenced by `Operation`'s JSON-Schema definition
   * via the `patternProperty` "^x-".
   */
  [k: string]: unknown;
}

export interface RequestBody {
  description?: string;
  content: Record<string, MediaType>;
  required?: boolean;
  /**
   * This interface was referenced by `RequestBody`'s JSON-Schema definition
   * via the `patternProperty` "^x-".
   */
  [k: string]: unknown;
}

export interface Responses {
  default?: Response | Reference;
}
export interface Response {
  description: string;
  headers?: Record<string, Header | Reference>;
  content?: Record<string, MediaType>;
  links?: Record<string, Link | Reference>;
  /**
   * This interface was referenced by `Response`'s JSON-Schema definition
   * via the `patternProperty` "^x-".
   */
  [k: string]: unknown;
}

export interface Link {
  operationId?: string;
  operationRef?: string;
  parameters?: Record<string, unknown>;
  requestBody?: unknown;
  description?: string;
  server?: Server;
  /**
   * This interface was referenced by `Link`'s JSON-Schema definition
   * via the `patternProperty` "^x-".
   */
  [k: string]: unknown;
}

export type Callback = Record<string, PathItem>;

export interface Components {
  /**
   * This interface was referenced by `undefined`'s JSON-Schema definition
   * via the `patternProperty` "^[a-zA-Z0-9\.\-_]+$".
   */
  schemas?: Record<string, Schema | Reference>;
  /**
   * This interface was referenced by `undefined`'s JSON-Schema definition
   * via the `patternProperty` "^[a-zA-Z0-9\.\-_]+$".
   */
  responses?: Record<string, Reference | Response>;
  /**
   * This interface was referenced by `undefined`'s JSON-Schema definition
   * via the `patternProperty` "^[a-zA-Z0-9\.\-_]+$".
   */
  parameters?: Record<string, Reference | Parameter>;
  /**
   * This interface was referenced by `undefined`'s JSON-Schema definition
   * via the `patternProperty` "^[a-zA-Z0-9\.\-_]+$".
   */
  examples?: Record<string, Reference | Example>;
  /**
   * This interface was referenced by `undefined`'s JSON-Schema definition
   * via the `patternProperty` "^[a-zA-Z0-9\.\-_]+$".
   */
  requestBodies?: Record<string, Reference | RequestBody>;
  /**
   * This interface was referenced by `undefined`'s JSON-Schema definition
   * via the `patternProperty` "^[a-zA-Z0-9\.\-_]+$".
   */
  headers?: Record<string, Reference | Header>;
  /**
   * This interface was referenced by `undefined`'s JSON-Schema definition
   * via the `patternProperty` "^[a-zA-Z0-9\.\-_]+$".
   */
  securitySchemes?: Record<string, Reference | SecurityScheme>;
  /**
   * This interface was referenced by `undefined`'s JSON-Schema definition
   * via the `patternProperty` "^[a-zA-Z0-9\.\-_]+$".
   */
  links?: Record<string, Reference | Link>;
  /**
   * This interface was referenced by `undefined`'s JSON-Schema definition
   * via the `patternProperty` "^[a-zA-Z0-9\.\-_]+$".
   */
  callbacks?: Record<string, Reference | Callback>;
  /**
   * This interface was referenced by `Components`'s JSON-Schema definition
   * via the `patternProperty` "^x-".
   */
  [k: string]: unknown;
}

export interface Schema {
  title?: string;
  multipleOf?: number;
  maximum?: number;
  exclusiveMaximum?: boolean;
  minimum?: number;
  exclusiveMinimum?: boolean;
  maxLength?: number;
  minLength?: number;
  pattern?: string;
  maxItems?: number;
  minItems?: number;
  uniqueItems?: boolean;
  maxProperties?: number;
  minProperties?: number;
  required?: [string, ...string[]];
  enum?: [unknown, ...unknown[]];
  type?: 'array' | 'boolean' | 'integer' | 'number' | 'object' | 'string';
  not?: Schema | Reference;
  allOf?: (Schema | Reference)[];
  oneOf?: (Schema | Reference)[];
  anyOf?: (Schema | Reference)[];
  items?: Schema | Reference;
  properties?: Record<string, Schema | Reference>;
  additionalProperties?: Schema | Reference | boolean;
  description?: string;
  format?: string;
  default?: unknown;
  nullable?: boolean;
  discriminator?: Discriminator;
  readOnly?: boolean;
  writeOnly?: boolean;
  example?: unknown;
  externalDocs?: ExternalDocumentation;
  deprecated?: boolean;
  xml?: XML;
  /**
   * This interface was referenced by `Schema`'s JSON-Schema definition
   * via the `patternProperty` "^x-".
   */
  [k: string]: unknown;
}

export interface Discriminator {
  propertyName: string;
  mapping?: Record<string, string>;
  [k: string]: unknown;
}

export interface XML {
  name?: string;
  namespace?: string;
  prefix?: string;
  attribute?: boolean;
  wrapped?: boolean;
  /**
   * This interface was referenced by `XML`'s JSON-Schema definition
   * via the `patternProperty` "^x-".
   */
  [k: string]: unknown;
}

export interface Example {
  summary?: string;
  description?: string;
  value?: unknown;
  externalValue?: string;
  /**
   * This interface was referenced by `Example`'s JSON-Schema definition
   * via the `patternProperty` "^x-".
   */
  [k: string]: unknown;
}

export interface APIKeySecurityScheme {
  type: 'apiKey';
  name: string;
  in: 'header' | 'query' | 'cookie';
  description?: string;
  /**
   * This interface was referenced by `APIKeySecurityScheme`'s JSON-Schema definition
   * via the `patternProperty` "^x-".
   */
  [k: string]: unknown;
}

export interface OAuth2SecurityScheme {
  type: 'oauth2';
  flows: OAuthFlows;
  description?: string;
  /**
   * This interface was referenced by `OAuth2SecurityScheme`'s JSON-Schema definition
   * via the `patternProperty` "^x-".
   */
  [k: string]: unknown;
}

export interface OAuthFlows {
  implicit?: ImplicitOAuthFlow;
  password?: PasswordOAuthFlow;
  clientCredentials?: ClientCredentialsFlow;
  authorizationCode?: AuthorizationCodeOAuthFlow;
  /**
   * This interface was referenced by `OAuthFlows`'s JSON-Schema definition
   * via the `patternProperty` "^x-".
   */
  [k: string]: unknown;
}

export interface ImplicitOAuthFlow {
  authorizationUrl: string;
  refreshUrl?: string;
  scopes: Record<string, string>;
  /**
   * This interface was referenced by `ImplicitOAuthFlow`'s JSON-Schema definition
   * via the `patternProperty` "^x-".
   */
  [k: string]: unknown;
}

export interface PasswordOAuthFlow {
  tokenUrl: string;
  refreshUrl?: string;
  scopes: Record<string, string>;
  /**
   * This interface was referenced by `PasswordOAuthFlow`'s JSON-Schema definition
   * via the `patternProperty` "^x-".
   */
  [k: string]: unknown;
}

export interface ClientCredentialsFlow {
  tokenUrl: string;
  refreshUrl?: string;
  scopes: Record<string, string>;
  /**
   * This interface was referenced by `ClientCredentialsFlow`'s JSON-Schema definition
   * via the `patternProperty` "^x-".
   */
  [k: string]: unknown;
}

export interface AuthorizationCodeOAuthFlow {
  authorizationUrl: string;
  tokenUrl: string;
  refreshUrl?: string;
  scopes: Record<string, string>;
  /**
   * This interface was referenced by `AuthorizationCodeOAuthFlow`'s JSON-Schema definition
   * via the `patternProperty` "^x-".
   */
  [k: string]: unknown;
}

export interface OpenIdConnectSecurityScheme {
  type: 'openIdConnect';
  openIdConnectUrl: string;
  description?: string;
  /**
   * This interface was referenced by `OpenIdConnectSecurityScheme`'s JSON-Schema definition
   * via the `patternProperty` "^x-".
   */
  [k: string]: unknown;
}

export class OpenApiSchemaConfiguration implements OpenApi {
  public readonly openapi: string;
  public readonly info: Info;
  public readonly externalDocs?: ExternalDocumentation;
  public readonly servers?: Server[];
  public readonly security?: SecurityRequirement[];
  public readonly tags?: Tag[];
  public readonly paths: Paths;
  public readonly components?: Components;
  // eslint-disable-next-line no-undef
  [k: string]: unknown;

  public constructor(openApiFilePath: string) {
    /* eslint-disable-next-line  no-sync */
    const openApiFile: string = fs.readFileSync(openApiFilePath, 'utf8');
    const openApiConfig: OpenApi = yaml.load(openApiFile) as OpenApi;
    this.openapi = openApiConfig.openapi;
    this.info = openApiConfig.info;
    this.externalDocs = openApiConfig.externalDocs;
    this.servers = openApiConfig.servers;
    this.security = openApiConfig.security;
    this.tags = openApiConfig.tags;
    this.paths = openApiConfig.paths;
    this.components = openApiConfig.components;
  }
}
