/* eslint-disable @typescript-eslint/naming-convention */
import type {
  OpenApi,
  CodeAuthorizationUrlResponse,
  OpenApiClientConfiguration,
} from '@comake/openapi-operation-executor';
import { OpenApiOperationExecutor } from '@comake/openapi-operation-executor';
import type { ReferenceNodeObject } from '@comake/rmlmapper-js';
import axios from 'axios';
import type { AxiosError, AxiosResponse } from 'axios';
import type { ContextDefinition, NodeObject } from 'jsonld';
import SHACLValidator from 'rdf-validate-shacl';
import type ValidationReport from 'rdf-validate-shacl/src/validation-report';
import { Mapper } from './mapping/Mapper';
import { MemoryQueryAdapter } from './storage/MemoryQueryAdapter';
import type { FindAllOptions, FindOneOptions, FindOptionsWhere, QueryAdapter } from './storage/QueryAdapter';
import { SparqlQueryAdapter } from './storage/sparql/SparqlQueryAdapter';
import type { OrArray, Entity } from './util/Types';
import {
  constructUri,
  convertJsonLdToQuads,
  getValueOfFieldInNodeObject,
  toJSON,
} from './util/Util';
import type { JSONObject } from './util/Util';
import { SKL, SHACL } from './util/Vocabularies';

export type VerbHandler = (args: JSONObject) => Promise<NodeObject>;
export type VerbInterface = Record<string, VerbHandler>;

export type MappingResponseOption<T extends boolean> = T extends true ? JSONObject : NodeObject;

export interface SkqlArgs {
  schema?: Entity[];
  sparqlEndpoint?: string;
  functions?: Record<string, (args: any | any[]) => any>;
}

export interface ErrorMatcher {
  status: number;
  messageRegex: string;
}

export interface OperationResponse {
  data: JSONObject;
}

const DEFAULT_MAPPING_FRAME = { '@id': 'https://skl.standard.storage/mappingSubject' };

export class Skql {
  private readonly mapper: Mapper;
  private readonly adapter: QueryAdapter;
  public do: VerbInterface;

  public constructor(args: SkqlArgs) {
    if (args.schema) {
      this.adapter = new MemoryQueryAdapter(args.schema);
    } else if (args.sparqlEndpoint) {
      this.adapter = new SparqlQueryAdapter({ endpointUrl: args.sparqlEndpoint });
    } else {
      throw new Error('No schema source found in setSchema args.');
    }

    this.mapper = new Mapper({ functions: args.functions });

    // eslint-disable-next-line func-style
    const getVerbHandler = (getTarget: VerbInterface, property: string): VerbHandler =>
      async(verbArgs: JSONObject): Promise<NodeObject> =>
        this.handleVerb(property, verbArgs);
    this.do = new Proxy({} as VerbInterface, { get: getVerbHandler });
  }

  public async find(options: FindOneOptions): Promise<Entity> {
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

  public async findAll(options: FindAllOptions): Promise<Entity[]> {
    return await this.adapter.findAll(options);
  }

  public async findAllBy(options: FindOptionsWhere): Promise<Entity[]> {
    return await this.adapter.findAllBy(options);
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

  public async performMapping(
    args: JSONObject,
    mapping: OrArray<NodeObject>,
    frame?: Record<string, any>,
  ): Promise<NodeObject> {
    const nonReferenceMappings = await this.resolveMappingReferences(mapping);
    return await this.mapper.apply(args, nonReferenceMappings, frame ?? DEFAULT_MAPPING_FRAME);
  }

  public async performMappingAndConvertToJSON(
    args: JSONObject,
    mapping: OrArray<NodeObject>,
    convertToJsonDeep = true,
    frame?: Record<string, any>,
  ): Promise<JSONObject> {
    const nonReferenceMappings = await this.resolveMappingReferences(mapping);
    const jsonLd = await this.mapper.applyAndFrameSklProperties(
      args,
      nonReferenceMappings,
      frame ?? DEFAULT_MAPPING_FRAME,
    );
    return toJSON(jsonLd, convertToJsonDeep);
  }

  private async handleVerb(verbName: string, verbArgs: JSONObject): Promise<NodeObject> {
    const verbSchemaId = constructUri(SKL.verbs, verbName);
    let verb;
    try {
      verb = await this.findBy({ id: verbSchemaId });
    } catch {
      throw new Error(`Failed to find the verb ${verbName} in the schema.`);
    }

    if (verbArgs.noun) {
      return this.handleNounMappingVerb(verb, verbArgs);
    }
    if (verbArgs.account) {
      return this.handleIntegrationVerb(verb, verbArgs);
    }

    throw new Error(`Verb parameters must include either a noun or an account.`);
  }

  private async handleIntegrationVerb(verb: Entity, args: JSONObject): Promise<NodeObject> {
    await this.assertVerbParamsMatchParameterSchemas(args, verb);
    const account = await this.findBy({ id: args.account as string });
    const integrationId = (account[SKL.integration] as ReferenceNodeObject)['@id'];
    const mapping = await this.findVerbIntegrationMapping(verb['@id'], integrationId);
    const operationArgs = await this.performParameterMappingOnArgsIfDefined(args, mapping);
    const operationInfo = await this.performOperationMappingWithArgs(args, mapping);
    const rawReturnValue = await this.performOperation(operationInfo, operationArgs, account);
    if (operationInfo[SKL.schemeName] && (rawReturnValue as CodeAuthorizationUrlResponse).authorizationUrl) {
      return {
        '@type': '@json',
        '@value': rawReturnValue as unknown as JSONObject,
      } as NodeObject;
    }

    if (mapping[SKL.returnValueMapping]) {
      const mappedReturnValue = await this.performReturnValueMappingWithFrame(
        (rawReturnValue as OperationResponse).data,
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
  ): Promise<OperationResponse | CodeAuthorizationUrlResponse> {
    if (operationInfo[SKL.schemeName]) {
      return await this.performSecuritySchemeStageWithCredentials(operationInfo, operationArgs, account);
    }
    if (operationInfo[SKL.dataSource]) {
      return await this.getDataFromDataSource(
        getValueOfFieldInNodeObject(operationInfo, SKL.dataSource)!,
      );
    }
    if (operationInfo[SKL.operationId]) {
      return await this.performOpenapiOperationWithCredentials(
        getValueOfFieldInNodeObject(operationInfo, SKL.operationId)!,
        operationArgs,
        account,
      );
    }
    throw new Error('Operation not supported.');
  }

  private async performReturnValueMappingWithFrame(
    data: JSONObject,
    mapping: Entity,
    verb: Entity,
  ): Promise<NodeObject> {
    return await this.performMapping(
      data,
      mapping[SKL.returnValueMapping] as OrArray<NodeObject>,
      {
        ...getValueOfFieldInNodeObject<Record<string, any>>(verb, SKL.returnValueFrame),
        ...getValueOfFieldInNodeObject<Record<string, any> | undefined>(mapping, SKL.returnValueFrame),
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
    return getValueOfFieldInNodeObject<OpenApi>(openApiDescriptionSchema, SKL.openApiDescription)!;
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
    if (mapping[SKL.mapping]) {
      return await this.performMapping(
        args,
        mapping[SKL.mapping] as OrArray<NodeObject>,
        {
          ...getValueOfFieldInNodeObject<Record<string, any>>(verb, SKL.returnValueFrame),
          ...getValueOfFieldInNodeObject<Record<string, any> | undefined>(mapping, SKL.returnValueFrame),
        },
      );
    }
    const verbArgs = await this.performParameterMappingOnArgsIfDefined(args, mapping, false);
    const verbInfoJsonLd = await this.performVerbMappingWithArgs(args, mapping);
    const mappedVerb = await this.findBy({
      id: getValueOfFieldInNodeObject(verbInfoJsonLd, SKL.verb),
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
      '@context': getValueOfFieldInNodeObject<ContextDefinition>(verb, SKL.parametersContext),
      '@type': 'https://skl.standard.storage/nouns/Parameters',
      ...verbParams,
    };
    const parametersSchema = verb[SKL.parameters] as NodeObject;
    const report = await this.convertToQuadsAndValidateAgainstShape(verbParamsAsJsonLd, parametersSchema);
    if (!report.conforms) {
      throw new Error(`${verb[SKL.name]} parameters do not conform to the schema`);
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
        ? getValueOfFieldInNodeObject<string>(securityCredentials, SKL.accessToken)
        : undefined,
      apiKey: securityCredentials
        ? getValueOfFieldInNodeObject<string>(securityCredentials, SKL.apiKey)
        : undefined,
      basePath: getValueOfFieldInNodeObject<string>(account, SKL.overrideBasePath),
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
    const errorMatcher = getValueOfFieldInNodeObject<ErrorMatcher | undefined>(
      integration,
      SKL.invalidTokenErrorMatcher,
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
    const getOauthTokenVerb = await this.findBy({ id: SKL.getOauthTokens });
    const mapping = await this.findVerbIntegrationMapping(getOauthTokenVerb['@id'], integrationId);
    const operationArgs = await this.performParameterMappingOnArgsIfDefined(
      { refreshToken: securityCredentialsSchema[SKL.refreshToken] as string },
      mapping,
    );
    const operationInfoJsonLd = await this.performOperationMappingWithArgs({}, mapping);
    const configuration = this.getConfigurationFromSecurityCredentials(securityCredentialsSchema);
    const rawReturnValue = await openApiExecutor.executeSecuritySchemeStage(
      getValueOfFieldInNodeObject(operationInfoJsonLd, SKL.schemeName)!,
      getValueOfFieldInNodeObject(operationInfoJsonLd, SKL.oauthFlow)!,
      getValueOfFieldInNodeObject(operationInfoJsonLd, SKL.stage)!,
      configuration,
      operationArgs,
    );
    const mappedReturnValue = await this.performReturnValueMappingWithFrame(
      (rawReturnValue as OperationResponse).data, mapping, getOauthTokenVerb,
    );
    await this.assertVerbReturnValueMatchesReturnTypeSchema(mappedReturnValue, getOauthTokenVerb);
    securityCredentialsSchema[SKL.accessToken] = mappedReturnValue[SKL.accessToken] as string;
    securityCredentialsSchema[SKL.refreshToken] = mappedReturnValue[SKL.refreshToken] as string;
    await this.save(securityCredentialsSchema);
    return { accessToken: securityCredentialsSchema[SKL.accessToken] as string };
  }

  private getConfigurationFromSecurityCredentials(
    securityCredentialsSchema: Entity,
  ): OpenApiClientConfiguration {
    const username = securityCredentialsSchema[SKL.clientId] as string | undefined;
    const password = securityCredentialsSchema[SKL.clientSecret] as string | undefined;
    const accessToken = securityCredentialsSchema[SKL.accessToken] as string | undefined;
    return { username, password, accessToken };
  }

  private async assertVerbReturnValueMatchesReturnTypeSchema(
    returnValue: NodeObject,
    verb: Entity,
  ): Promise<void> {
    const returnTypeSchemaObject = await this.getReturnTypeSchemaFromVerb(verb);

    let report: ValidationReport | undefined;
    if (returnValue && Object.keys(returnValue).length > 0 && returnTypeSchemaObject) {
      returnTypeSchemaObject[SHACL.targetNode] = { '@id': returnValue['@id'] };
      report = await this.convertToQuadsAndValidateAgainstShape(returnValue, returnTypeSchemaObject);
    }

    if (report && !report?.conforms) {
      throw new Error(`Return value ${returnValue['@id']} does not conform to the schema`);
    }
  }

  private async getReturnTypeSchemaFromVerb(verb: Entity): Promise<NodeObject> {
    const returnTypeSchema = verb[SKL.returnValue] as NodeObject;
    if (typeof returnTypeSchema === 'object' && returnTypeSchema['@type']) {
      return returnTypeSchema;
    }
    if (typeof returnTypeSchema === 'object' && returnTypeSchema['@id']) {
      return await this.findBy({ id: returnTypeSchema['@id'] }) as NodeObject;
    }
    throw new Error('returnTypeSchema is not properly formatted.');
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
  ): Promise<AxiosResponse | CodeAuthorizationUrlResponse> {
    const integrationId = (account[SKL.integration] as ReferenceNodeObject)['@id'];
    const openApiDescription = await this.getOpenApiDescriptionForIntegration(integrationId);
    const securityCredentialsSchema = await this.findSecurityCredentialsForAccountIfDefined(account['@id']);
    let configuration: OpenApiClientConfiguration;
    if (securityCredentialsSchema) {
      configuration = this.getConfigurationFromSecurityCredentials(securityCredentialsSchema);
      operationArgs.client_id = securityCredentialsSchema[SKL.clientId] as string;
    } else {
      configuration = {};
    }
    const openApiExecutor = await this.createOpenApiOperationExecutorWithSpec(openApiDescription);
    return await openApiExecutor.executeSecuritySchemeStage(
      operationInfo[SKL.schemeName] as string,
      operationInfo[SKL.oauthFlow] as string,
      operationInfo[SKL.stage] as string,
      configuration,
      operationArgs,
    );
  }

  private async getDataFromDataSource(dataSourceId: string): Promise<OperationResponse> {
    const dataSource = await this.findBy({ id: dataSourceId });
    if (dataSource['@type'] === SKL.JsonDataSource) {
      return {
        data: (dataSource[SKL.data] as NodeObject)['@value'] as JSONObject,
      };
    }
    throw new Error(`DataSource type ${dataSource['@type']} is not supported.`);
  }
}
