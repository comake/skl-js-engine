/* eslint-disable @typescript-eslint/naming-convention */
import type {
  OpenApi,
  OpenApiClientConfiguration,
} from '@comake/openapi-operation-executor';
import { OpenApiOperationExecutor } from '@comake/openapi-operation-executor';
import type { ReferenceNodeObject } from '@comake/rmlmapper-js';
import axios from 'axios';
import type { AxiosError, AxiosResponse } from 'axios';
import type { ContextDefinition, GraphObject, NodeObject } from 'jsonld';
import type { Frame } from 'jsonld/jsonld-spec';
import SHACLValidator from 'rdf-validate-shacl';
import type ValidationReport from 'rdf-validate-shacl/src/validation-report';
import { Mapper } from './mapping/Mapper';
import type { FindAllOptions, FindOneOptions, FindOptionsWhere } from './storage/FindOptionsTypes';
import { MemoryQueryAdapter } from './storage/memory/MemoryQueryAdapter';
import type { MemoryQueryAdapterOptions } from './storage/memory/MemoryQueryAdapterOptions';
import type { QueryAdapter, RawQueryResult } from './storage/QueryAdapter';
import { SparqlQueryAdapter } from './storage/sparql/SparqlQueryAdapter';
import type { SparqlQueryAdapterOptions } from './storage/sparql/SparqlQueryAdapterOptions';
import type { OrArray, Entity } from './util/Types';
import {
  convertJsonLdToQuads,
  toJSON,
  getValueIfDefined,
} from './util/Util';
import type { JSONObject } from './util/Util';
import { SKL, SHACL, RDFS } from './util/Vocabularies';

export type VerbHandler = (args: JSONObject) => Promise<NodeObject>;
export type VerbInterface = Record<string, VerbHandler>;

export type MappingResponseOption<T extends boolean> = T extends true ? JSONObject : NodeObject;

export type SKLEngineOptions = MemoryQueryAdapterOptions | SparqlQueryAdapterOptions;

export interface ErrorMatcher {
  status: number;
  messageRegex: string;
}

export interface OperationResponse extends JSONObject {
  data: JSONObject;
  args: JSONObject;
}

export class SKLEngine {
  private readonly mapper: Mapper;
  private readonly adapter: QueryAdapter;
  private readonly inputFiles?: Record<string, string>;
  public readonly verb: VerbInterface;

  public constructor(options: SKLEngineOptions) {
    switch (options.type) {
      case 'memory':
        this.adapter = new MemoryQueryAdapter(options);
        break;
      case 'sparql':
        this.adapter = new SparqlQueryAdapter(options);
        break;
      default:
        throw new Error('No schema source found in setSchema args.');
    }

    this.inputFiles = options.inputFiles;
    this.mapper = new Mapper({ functions: options.functions });

    // eslint-disable-next-line func-style
    const getVerbHandler = (getTarget: VerbInterface, property: string): VerbHandler =>
      async(verbArgs: JSONObject): Promise<NodeObject> =>
        this.handleVerb(property, verbArgs);
    this.verb = new Proxy({} as VerbInterface, { get: getVerbHandler });
  }

  public async executeRawQuery<T extends RawQueryResult>(query: string): Promise<T[]> {
    return await this.adapter.executeRawQuery<T>(query);
  }

  public async executeRawEntityQuery(query: string, frame?: Frame): Promise<GraphObject> {
    return await this.adapter.executeRawEntityQuery(query, frame);
  }

  public async find(options?: FindOneOptions): Promise<Entity> {
    const entity = await this.adapter.find(options);
    if (entity) {
      return entity;
    }
    throw new Error(`No schema found with fields matching ${JSON.stringify(options)}`);
  }

  public async findBy(where: FindOptionsWhere): Promise<Entity> {
    const entity = await this.adapter.findBy(where);
    if (entity) {
      return entity;
    }
    throw new Error(`No schema found with fields matching ${JSON.stringify(where)}`);
  }

  public async findAll(options?: FindAllOptions): Promise<Entity[]> {
    return await this.adapter.findAll(options);
  }

  public async findAllBy(where: FindOptionsWhere): Promise<Entity[]> {
    return await this.adapter.findAllBy(where);
  }

  public async exists(where: FindOptionsWhere): Promise<boolean> {
    return await this.adapter.exists(where);
  }

  public async count(where?: FindOptionsWhere): Promise<number> {
    return await this.adapter.count(where);
  }

  public async save(entity: Entity): Promise<Entity>;
  public async save(entities: Entity[]): Promise<Entity[]>;
  public async save(entityOrEntities: Entity | Entity[]): Promise<Entity | Entity[]> {
    if (Array.isArray(entityOrEntities)) {
      return await this.adapter.save(entityOrEntities);
    }
    return await this.adapter.save(entityOrEntities);
  }

  public async destroy(entity: Entity): Promise<Entity>;
  public async destroy(entities: Entity[]): Promise<Entity[]>;
  public async destroy(entityOrEntities: Entity | Entity[]): Promise<Entity | Entity[]> {
    if (Array.isArray(entityOrEntities)) {
      return await this.adapter.destroy(entityOrEntities);
    }
    return await this.adapter.destroy(entityOrEntities);
  }

  public async destroyAll(): Promise<void> {
    return await this.adapter.destroyAll();
  }

  public async performMapping(
    args: JSONObject,
    mapping: OrArray<NodeObject>,
    frame?: Record<string, any>,
  ): Promise<NodeObject> {
    const nonReferenceMappings = await this.resolveMappingReferences(mapping);
    return await this.mapper.apply(args, nonReferenceMappings, frame ?? {});
  }

  public async performMappingAndConvertToJSON(
    args: JSONObject,
    mapping: OrArray<NodeObject>,
    frame?: Record<string, any>,
    convertToJsonDeep = true,
  ): Promise<JSONObject> {
    const nonReferenceMappings = await this.resolveMappingReferences(mapping);
    const jsonLd = await this.mapper.apply(
      args,
      nonReferenceMappings,
      frame ?? {},
    );
    return toJSON(jsonLd, convertToJsonDeep);
  }

  private async handleVerb(verbName: string, verbArgs: JSONObject): Promise<NodeObject> {
    const verb = await this.findVerbWithName(verbName);
    if (verbArgs.noun) {
      return this.handleNounMappingVerb(verb, verbArgs);
    }
    if (verbArgs.account) {
      return this.handleIntegrationVerb(verb, verbArgs);
    }

    throw new Error(`Verb parameters must include either a noun or an account.`);
  }

  private async findVerbWithName(verbName: string): Promise<Entity> {
    try {
      return await this.findBy({ type: SKL.Verb, [RDFS.label]: verbName });
    } catch {
      throw new Error(`Failed to find the verb ${verbName} in the schema.`);
    }
  }

  private async handleIntegrationVerb(verb: Entity, args: JSONObject): Promise<NodeObject> {
    await this.assertVerbParamsMatchParameterSchemas(args, verb);
    const account = await this.findBy({ id: args.account as string });
    const integrationId = (account[SKL.integration] as ReferenceNodeObject)['@id'];
    const mapping = await this.findVerbIntegrationMapping(verb['@id'], integrationId);
    const operationArgs = await this.performParameterMappingOnArgsIfDefined(args, mapping);
    const operationInfo = await this.performOperationMappingWithArgs(args, mapping);
    const rawReturnValue = await this.performOperation(operationInfo, operationArgs, account);
    if (operationInfo[SKL.schemeName] && rawReturnValue.data.authorizationUrl) {
      return {
        '@type': '@json',
        '@value': rawReturnValue.data,
      };
    }

    if (mapping[SKL.returnValueMapping]) {
      const mappedReturnValue = await this.performReturnValueMappingWithFrame(
        rawReturnValue,
        mapping,
        verb,
      );
      await this.assertVerbReturnValueMatchesReturnTypeSchema(mappedReturnValue, verb);
      return mappedReturnValue;
    }
    return rawReturnValue as unknown as NodeObject;
  }

  private async findVerbIntegrationMapping(verbId: string, integrationId: string): Promise<Entity> {
    return await this.findBy({
      type: SKL.VerbIntegrationMapping,
      [SKL.verb]: verbId,
      [SKL.integration]: integrationId,
    });
  }

  private async performOperationMappingWithArgs(args: JSONObject, mapping: Entity): Promise<NodeObject> {
    return await this.performMapping(args, mapping[SKL.operationMapping] as OrArray<NodeObject>);
  }

  private async performOperation(
    operationInfo: NodeObject,
    operationArgs: JSONObject,
    account: Entity,
  ): Promise<OperationResponse> {
    if (operationInfo[SKL.schemeName]) {
      return await this.performSecuritySchemeStageWithCredentials(operationInfo, operationArgs, account);
    }
    if (operationInfo[SKL.dataSource]) {
      return await this.getDataFromDataSource(
        getValueIfDefined(operationInfo[SKL.dataSource])!,
      );
    }
    if (operationInfo[SKL.operationId]) {
      const response = await this.performOpenapiOperationWithCredentials(
        getValueIfDefined(operationInfo[SKL.operationId])!,
        operationArgs,
        account,
      );
      return { ...response, args: operationArgs } as unknown as OperationResponse;
    }
    throw new Error('Operation not supported.');
  }

  private async performReturnValueMappingWithFrame(
    operationResponse: OperationResponse,
    mapping: Entity,
    verb: Entity,
  ): Promise<NodeObject> {
    return await this.performMapping(
      operationResponse,
      mapping[SKL.returnValueMapping] as OrArray<NodeObject>,
      {
        ...getValueIfDefined<JSONObject>(verb[SKL.returnValueFrame]),
        ...getValueIfDefined<JSONObject>(mapping[SKL.returnValueFrame]),
      },
    );
  }

  private async resolveMappingReferences(mapping: OrArray<NodeObject>): Promise<OrArray<NodeObject>> {
    if (Array.isArray(mapping)) {
      return await Promise.all(
        mapping.map(async(subMapping): Promise<NodeObject> =>
          await this.resolveMappingReferences(subMapping) as NodeObject),
      );
    }
    return mapping;
  }

  private async performParameterMappingOnArgsIfDefined(
    args: JSONObject,
    mapping: Entity,
    convertToJsonDeep = true,
  ): Promise<Record<string, any>> {
    if (mapping[SKL.parameterMapping]) {
      return await this.performMappingAndConvertToJSON(
        args,
        mapping[SKL.parameterMapping] as OrArray<NodeObject>,
        getValueIfDefined(mapping[SKL.parameterMappingFrame]),
        convertToJsonDeep,
      );
    }
    return args;
  }

  private async getOpenApiDescriptionForIntegration(integrationId: string): Promise<OpenApi> {
    const openApiDescriptionSchema = await this.findBy({
      type: SKL.OpenApiDescription,
      [SKL.integration]: integrationId,
    });
    return getValueIfDefined<OpenApi>(openApiDescriptionSchema[SKL.openApiDescription])!;
  }

  private async findSecurityCredentialsForAccount(accountId: string): Promise<Entity> {
    return await this.findBy({
      type: SKL.SecurityCredentials,
      [SKL.account]: accountId,
    });
  }

  private async findSecurityCredentialsForAccountIfDefined(accountId: string): Promise<Entity | undefined> {
    try {
      return await this.findSecurityCredentialsForAccount(accountId);
    } catch {
      return undefined;
    }
  }

  private async createOpenApiOperationExecutorWithSpec(openApiDescription: OpenApi): Promise<OpenApiOperationExecutor> {
    const executor = new OpenApiOperationExecutor();
    await executor.setOpenapiSpec(openApiDescription);
    return executor;
  }

  private async handleNounMappingVerb(verb: Entity, args: JSONObject): Promise<NodeObject> {
    const mapping = await this.findVerbNounMapping(verb['@id'], args.noun as string);
    if (mapping[SKL.returnValueMapping]) {
      return await this.performMapping(
        args,
        mapping[SKL.returnValueMapping] as OrArray<NodeObject>,
        {
          ...getValueIfDefined<JSONObject>(verb[SKL.returnValueFrame]),
          ...getValueIfDefined<JSONObject>(mapping[SKL.returnValueFrame]),
        },
      );
    }
    const verbArgs = await this.performParameterMappingOnArgsIfDefined(args, mapping, false);
    const verbInfoJsonLd = await this.performVerbMappingWithArgs(args, mapping);
    const mappedVerb = await this.findBy({
      id: getValueIfDefined(verbInfoJsonLd[SKL.verb]),
    });
    return this.handleIntegrationVerb(mappedVerb, verbArgs);
  }

  private async findVerbNounMapping(verbId: string, noun: string): Promise<Entity> {
    return await this.findBy({
      type: SKL.VerbNounMapping,
      [SKL.verb]: verbId,
      [SKL.noun]: noun,
    });
  }

  private async performVerbMappingWithArgs(args: JSONObject, mapping: Entity): Promise<NodeObject> {
    return await this.performMapping(args, mapping[SKL.verbMapping] as NodeObject);
  }

  private async assertVerbParamsMatchParameterSchemas(verbParams: any, verb: Entity): Promise<void> {
    const verbParamsAsJsonLd = {
      '@context': getValueIfDefined<ContextDefinition>(verb[SKL.parametersContext]),
      '@type': SKL.Parameters,
      ...verbParams,
    };
    const parametersSchema = verb[SKL.parameters] as NodeObject;
    const report = await this.convertToQuadsAndValidateAgainstShape(verbParamsAsJsonLd, parametersSchema);
    if (!report.conforms) {
      throw new Error(`${verb[RDFS.label]} parameters do not conform to the schema`);
    }
  }

  private async performOpenapiOperationWithCredentials(
    operationId: string,
    operationArgs: JSONObject,
    account: Entity,
  ): Promise<AxiosResponse> {
    const integrationId = (account[SKL.integration] as ReferenceNodeObject)['@id'];
    const openApiDescription = await this.getOpenApiDescriptionForIntegration(integrationId);
    const openApiExecutor = await this.createOpenApiOperationExecutorWithSpec(openApiDescription);
    const securityCredentials = await this.findSecurityCredentialsForAccountIfDefined(account['@id']);
    const configuration = {
      accessToken: securityCredentials
        ? getValueIfDefined<string>(securityCredentials[SKL.accessToken])
        : undefined,
      apiKey: securityCredentials
        ? getValueIfDefined<string>(securityCredentials[SKL.apiKey])
        : undefined,
      basePath: getValueIfDefined<string>(account[SKL.overrideBasePath]),
    };
    return await openApiExecutor.executeOperation(operationId, configuration, operationArgs)
      .catch(async(error: Error | AxiosError): Promise<any> => {
        if (axios.isAxiosError(error) && await this.isInvalidTokenError(error, integrationId) && securityCredentials) {
          const refreshedConfiguration = await this.refreshOpenApiToken(
            securityCredentials,
            openApiExecutor,
            integrationId,
          );
          return await openApiExecutor.executeOperation(operationId, refreshedConfiguration, operationArgs);
        }
        throw error;
      });
  }

  private async isInvalidTokenError(error: AxiosError, integrationId: string): Promise<boolean> {
    const integration = await this.findBy({ id: integrationId });
    const errorMatcher = getValueIfDefined<ErrorMatcher>(
      integration[SKL.invalidTokenErrorMatcher],
    );
    if (errorMatcher && (error.response?.status === errorMatcher.status)) {
      if (!errorMatcher.messageRegex) {
        return true;
      }

      if (
        error.response?.statusText &&
        new RegExp(errorMatcher.messageRegex, 'u').test(error.response?.statusText)
      ) {
        return true;
      }
    }

    return false;
  }

  private async refreshOpenApiToken(
    securityCredentialsSchema: Entity,
    openApiExecutor: OpenApiOperationExecutor,
    integrationId: string,
  ): Promise<OpenApiClientConfiguration> {
    const getOauthTokenVerb = await this.findBy({ type: SKL.Verb, [RDFS.label]: 'getOauthTokens' });
    const mapping = await this.findVerbIntegrationMapping(getOauthTokenVerb['@id'], integrationId);
    const operationArgs = await this.performParameterMappingOnArgsIfDefined(
      { refreshToken: getValueIfDefined<string>(securityCredentialsSchema[SKL.refreshToken])! },
      mapping,
    );
    const operationInfoJsonLd = await this.performOperationMappingWithArgs({}, mapping);
    const configuration = this.getConfigurationFromSecurityCredentials(securityCredentialsSchema);
    const rawReturnValue = await openApiExecutor.executeSecuritySchemeStage(
      getValueIfDefined(operationInfoJsonLd[SKL.schemeName])!,
      getValueIfDefined(operationInfoJsonLd[SKL.oauthFlow])!,
      getValueIfDefined(operationInfoJsonLd[SKL.stage])!,
      configuration,
      operationArgs,
    // Assert AxiosResponse here because this cannot be a code authorization url request
    ) as AxiosResponse;
    const mappedReturnValue = await this.performReturnValueMappingWithFrame(
      { ...rawReturnValue, args: operationArgs } as unknown as OperationResponse,
      mapping,
      getOauthTokenVerb,
    );
    await this.assertVerbReturnValueMatchesReturnTypeSchema(mappedReturnValue, getOauthTokenVerb);
    securityCredentialsSchema[SKL.accessToken] = getValueIfDefined(mappedReturnValue[SKL.accessToken]);
    securityCredentialsSchema[SKL.refreshToken] = getValueIfDefined(mappedReturnValue[SKL.refreshToken]);
    await this.save(securityCredentialsSchema);
    return { accessToken: getValueIfDefined(securityCredentialsSchema[SKL.accessToken]) };
  }

  private getConfigurationFromSecurityCredentials(
    securityCredentialsSchema: Entity,
  ): OpenApiClientConfiguration {
    const username = getValueIfDefined<string>(securityCredentialsSchema[SKL.clientId]);
    const password = getValueIfDefined<string>(securityCredentialsSchema[SKL.clientSecret]);
    const accessToken = getValueIfDefined<string>(securityCredentialsSchema[SKL.accessToken]);
    return { username, password, accessToken };
  }

  private async assertVerbReturnValueMatchesReturnTypeSchema(
    returnValue: NodeObject,
    verb: Entity,
  ): Promise<void> {
    const returnTypeSchemaObject = verb[SKL.returnValue] as NodeObject;

    let report: ValidationReport | undefined;
    if (returnValue && Object.keys(returnValue).length > 0 && returnTypeSchemaObject) {
      if (returnValue['@id']) {
        returnTypeSchemaObject[SHACL.targetNode] = { '@id': returnValue['@id'] };
      } else {
        returnTypeSchemaObject[SHACL.targetClass] = { '@id': returnValue['@type'] };
      }
      report = await this.convertToQuadsAndValidateAgainstShape(returnValue, returnTypeSchemaObject);
    }

    if (report && !report?.conforms) {
      throw new Error(`Return value ${returnValue['@id']} does not conform to the schema`);
    }
  }

  private async convertToQuadsAndValidateAgainstShape(
    value: NodeObject,
    shape: NodeObject,
  ): Promise<ValidationReport> {
    const valueAsQuads = await convertJsonLdToQuads([ value ]);
    const shapeQuads = await convertJsonLdToQuads(shape);
    const validator = new SHACLValidator(shapeQuads);
    return validator.validate(valueAsQuads);
  }

  private async performSecuritySchemeStageWithCredentials(
    operationInfo: NodeObject,
    operationArgs: JSONObject,
    account: Entity,
  ): Promise<OperationResponse> {
    const integrationId = (account[SKL.integration] as ReferenceNodeObject)['@id'];
    const openApiDescription = await this.getOpenApiDescriptionForIntegration(integrationId);
    const securityCredentialsSchema = await this.findSecurityCredentialsForAccountIfDefined(account['@id']);
    let configuration: OpenApiClientConfiguration;
    if (securityCredentialsSchema) {
      configuration = this.getConfigurationFromSecurityCredentials(securityCredentialsSchema);
      operationArgs.client_id = getValueIfDefined<string>(securityCredentialsSchema[SKL.clientId])!;
    } else {
      configuration = {};
    }
    const openApiExecutor = await this.createOpenApiOperationExecutorWithSpec(openApiDescription);
    const response = await openApiExecutor.executeSecuritySchemeStage(
      getValueIfDefined(operationInfo[SKL.schemeName])!,
      getValueIfDefined(operationInfo[SKL.oauthFlow])!,
      getValueIfDefined(operationInfo[SKL.stage])!,
      configuration,
      operationArgs,
    );
    if ('codeVerifier' in response && 'authorizationUrl' in response) {
      return {
        data: response as unknown as JSONObject,
        args: operationArgs,
      };
    }
    return {
      ...response,
      args: operationArgs,
    } as unknown as OperationResponse;
  }

  private async getDataFromDataSource(dataSourceId: string): Promise<OperationResponse> {
    const dataSource = await this.findBy({ id: dataSourceId });
    if (dataSource['@type'] === SKL.JsonDataSource) {
      const data = this.getDataFromJsonDataSource(dataSource);
      return { data, args: {}};
    }
    throw new Error(`DataSource type ${dataSource['@type']} is not supported.`);
  }

  private getDataFromJsonDataSource(dataSource: NodeObject): JSONObject {
    if (dataSource[SKL.source]) {
      const sourceValue = getValueIfDefined<string>(dataSource[SKL.source])!;
      return this.getJsonDataFromSource(sourceValue);
    }
    return getValueIfDefined<JSONObject>(dataSource[SKL.data])!;
  }

  private getJsonDataFromSource(source: string): JSONObject {
    if (this.inputFiles && source in this.inputFiles) {
      const file = this.inputFiles[source];
      return JSON.parse(file);
    }
    // eslint-disable-next-line unicorn/expiring-todo-comments
    // TODO add support for remote sources
    throw new Error(`Failed to get data from source ${source}`);
  }
}
