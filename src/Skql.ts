/* eslint-disable @typescript-eslint/naming-convention */
import type {
  OpenApi,
  CodeAuthorizationUrlResponse,
  OpenApiClientConfiguration,
} from '@comake/openapi-operation-executor';
import { OpenApiOperationExecutor } from '@comake/openapi-operation-executor';
import axios from 'axios';
import type { AxiosError, AxiosResponse } from 'axios';
import type { ContextDefinition, NodeObject } from 'jsonld';
import SHACLValidator from 'rdf-validate-shacl';
import type ValidationReport from 'rdf-validate-shacl/src/validation-report';
import { Mapper } from './mapping/Mapper';
import { MemoryQueryAdapter } from './storage/MemoryQueryAdapter';
import type { QueryAdapter, FindQuery } from './storage/QueryAdapter';
import type { SchemaNodeObject, UnsavedSchemaNodeObject, NodeObjectWithId, OrArray } from './util/Types';
import {
  constructUri,
  convertJsonLdToQuads,
  getValueOfFieldInNodeObject,
  toJSON,
  asJsonLdJsonValue,
} from './util/Util';
import type { JSONObject } from './util/Util';
import { SKL, SHACL } from './util/Vocabularies';

export type VerbHandler = (args: JSONObject) => Promise<NodeObject>;
export type VerbInterface = Record<string, VerbHandler>;

export type MappingResponseOption<T extends boolean> = T extends true ? JSONObject : NodeObject;

export interface SkqlArgs {
  schema?: SchemaNodeObject[];
  skdsUrl?: string;
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
    // } else if (args.skdsUrl) {
    //   this.adapter = new SkdsQueryAdapter(args.skdsUrl);
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

  public async find(query: FindQuery): Promise<SchemaNodeObject> {
    const schema = await this.adapter.find(query);
    if (schema) {
      return schema;
    }
    throw new Error(`No schema found with fields matching ${JSON.stringify(query)}`);
  }

  public async findAll(query: FindQuery): Promise<SchemaNodeObject[]> {
    return await this.adapter.findAll(query);
  }

  public async create(record: UnsavedSchemaNodeObject): Promise<SchemaNodeObject> {
    return await this.adapter.create(record);
  }

  public async update(record: NodeObjectWithId): Promise<SchemaNodeObject> {
    return await this.adapter.update(record);
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
      verb = await this.find({ id: verbSchemaId });
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

  private async handleIntegrationVerb(verb: SchemaNodeObject, args: JSONObject): Promise<NodeObject> {
    await this.assertVerbParamsMatchParameterSchemas(args, verb);
    const account = await this.find({ id: args.account as string });
    const integrationId = (account[SKL.integration] as SchemaNodeObject)['@id'];
    const mapping = await this.findVerbIntegrationMapping(verb['@id'], integrationId);
    const operationArgs = await this.performParameterMappingOnArgsIfDefined(args, mapping);
    const operationInfo = await this.performOperationMappingWithArgs(args, mapping);
    const rawReturnValue = await this.performOperation(operationInfo, operationArgs, account);

    if (operationInfo[SKL.schemeName] && (rawReturnValue as CodeAuthorizationUrlResponse).authorizationUrl) {
      return asJsonLdJsonValue(rawReturnValue as unknown as JSONObject);
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

  private async findVerbIntegrationMapping(verbId: string, integrationId: string): Promise<SchemaNodeObject> {
    return await this.find({
      type: SKL.VerbIntegrationMapping,
      [SKL.verb]: verbId,
      [SKL.integration]: integrationId,
    });
  }

  private async performOperationMappingWithArgs(args: JSONObject, mapping: SchemaNodeObject): Promise<NodeObject> {
    return await this.performMapping(args, mapping[SKL.operationMapping] as OrArray<NodeObject>);
  }

  private async performOperation(
    operationInfo: NodeObject,
    operationArgs: JSONObject,
    account: SchemaNodeObject,
  ): Promise<OperationResponse | CodeAuthorizationUrlResponse> {
    if (operationInfo[SKL.schemeName]) {
      return await this.performSecuritySchemeStageWithCredentials(operationInfo, operationArgs, account);
    }
    if (operationInfo[SKL.dataSource]) {
      return await this.getDataFromDataSource(operationInfo[SKL.dataSource] as string);
    }
    if (operationInfo[SKL.operationId]) {
      return await this.performOpenapiOperationWithCredentials(
        operationInfo[SKL.operationId] as string,
        operationArgs,
        account,
      );
    }
    throw new Error('Operation not supported.');
  }

  private async performReturnValueMappingWithFrame(
    data: JSONObject,
    mapping: SchemaNodeObject,
    verb: SchemaNodeObject,
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
    mapping: SchemaNodeObject,
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
    const openApiDescriptionSchema = await this.find({
      type: SKL.OpenApiDescription,
      [SKL.integration]: integrationId,
    });
    return getValueOfFieldInNodeObject<OpenApi>(openApiDescriptionSchema, SKL.openApiDescription);
  }

  private async findSecurityCredentialsForAccount(accountId: string): Promise<SchemaNodeObject> {
    return await this.find({
      type: SKL.SecurityCredentials,
      [SKL.account]: accountId,
    });
  }

  private async findSecurityCredentialsForAccountIfDefined(accountId: string): Promise<SchemaNodeObject | undefined> {
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

  private async handleNounMappingVerb(verb: SchemaNodeObject, args: JSONObject): Promise<NodeObject> {
    const mapping = await this.findVerbNounMapping(verb['@id'], args.noun as string);
    if (mapping[SKL.mapping]) {
      return await this.performMapping(
        args,
        mapping[SKL.mapping] as NodeObject,
        {
          ...getValueOfFieldInNodeObject<Record<string, any>>(verb, SKL.returnValueFrame),
          ...getValueOfFieldInNodeObject<Record<string, any> | undefined>(mapping, SKL.returnValueFrame),
        },
      );
    }
    const verbArgs = await this.performParameterMappingOnArgsIfDefined(args, mapping, false);
    const verbInfoJsonLd = await this.performVerbMappingWithArgs(args, mapping);
    const mappedVerb = await this.find({ id: verbInfoJsonLd[SKL.verb] as string });
    return this.handleIntegrationVerb(mappedVerb, verbArgs);
  }

  private async findVerbNounMapping(verbId: string, noun: string): Promise<SchemaNodeObject> {
    return await this.find({
      type: SKL.VerbNounMapping,
      [SKL.verb]: verbId,
      [SKL.noun]: noun,
    });
  }

  private async performVerbMappingWithArgs(args: JSONObject, mapping: SchemaNodeObject): Promise<NodeObject> {
    return await this.performMapping(args, mapping[SKL.verbMapping] as NodeObject);
  }

  private async assertVerbParamsMatchParameterSchemas(verbParams: any, verb: SchemaNodeObject): Promise<void> {
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
    account: SchemaNodeObject,
  ): Promise<AxiosResponse> {
    const integrationId = (account[SKL.integration] as SchemaNodeObject)['@id'];
    const openApiDescription = await this.getOpenApiDescriptionForIntegration(integrationId);
    const openApiExecutor = await this.createOpenApiOperationExecutorWithSpec(openApiDescription);
    const securityCredentials = await this.findSecurityCredentialsForAccountIfDefined(account['@id']);
    const configuration = {
      accessToken: securityCredentials?.[SKL.accessToken] as string,
      apiKey: securityCredentials?.[SKL.apiKey] as string,
      basePath: account[SKL.overrideBasePath] as string,
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
    const integration = await this.find({ id: integrationId });
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
    securityCredentialsSchema: SchemaNodeObject,
    openApiExecutor: OpenApiOperationExecutor,
    integrationId: string,
  ): Promise<OpenApiClientConfiguration> {
    const getOauthTokenVerb = await this.find({ id: SKL.getOauthTokens });
    const mapping = await this.findVerbIntegrationMapping(getOauthTokenVerb['@id'], integrationId);
    const operationArgs = await this.performParameterMappingOnArgsIfDefined(
      { refreshToken: securityCredentialsSchema[SKL.refreshToken] as string },
      mapping,
    );
    const operationInfoJsonLd = await this.performOperationMappingWithArgs({}, mapping);
    const configuration = this.getConfigurationFromSecurityCredentials(securityCredentialsSchema);
    const rawReturnValue = await openApiExecutor.executeSecuritySchemeStage(
      operationInfoJsonLd[SKL.schemeName] as string,
      operationInfoJsonLd[SKL.oauthFlow] as string,
      operationInfoJsonLd[SKL.stage] as string,
      configuration,
      operationArgs,
    );
    const mappedReturnValue = await this.performReturnValueMappingWithFrame(
      (rawReturnValue as OperationResponse).data, mapping, getOauthTokenVerb,
    );
    await this.assertVerbReturnValueMatchesReturnTypeSchema(mappedReturnValue, getOauthTokenVerb);
    securityCredentialsSchema[SKL.accessToken] = mappedReturnValue[SKL.accessToken];
    securityCredentialsSchema[SKL.refreshToken] = mappedReturnValue[SKL.refreshToken];
    await this.update(securityCredentialsSchema);
    return { accessToken: securityCredentialsSchema[SKL.accessToken] as string };
  }

  private getConfigurationFromSecurityCredentials(
    securityCredentialsSchema?: SchemaNodeObject,
  ): OpenApiClientConfiguration {
    if (securityCredentialsSchema) {
      const username = securityCredentialsSchema[SKL.clientId] as string | undefined;
      const password = securityCredentialsSchema[SKL.clientSecret] as string | undefined;
      const accessToken = securityCredentialsSchema[SKL.accessToken] as string | undefined;
      return { username, password, accessToken };
    }
    return {};
  }

  private async assertVerbReturnValueMatchesReturnTypeSchema(
    returnValue: NodeObject,
    verb: SchemaNodeObject,
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

  private async getReturnTypeSchemaFromVerb(verb: SchemaNodeObject): Promise<NodeObject> {
    const returnTypeSchema = verb[SKL.returnValue] as NodeObject;
    if (typeof returnTypeSchema === 'object' && returnTypeSchema['@type']) {
      return returnTypeSchema;
    }
    if (typeof returnTypeSchema === 'object' && returnTypeSchema['@id']) {
      return await this.find({ id: returnTypeSchema['@id'] });
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
    account: SchemaNodeObject,
  ): Promise<AxiosResponse | CodeAuthorizationUrlResponse> {
    const integrationId = (account[SKL.integration] as SchemaNodeObject)['@id'];
    const openApiDescription = await this.getOpenApiDescriptionForIntegration(integrationId);
    const securityCredentialsSchema = await this.findSecurityCredentialsForAccountIfDefined(account['@id']);
    const configuration = this.getConfigurationFromSecurityCredentials(securityCredentialsSchema);
    if (securityCredentialsSchema) {
      operationArgs.client_id = securityCredentialsSchema[SKL.clientId] as string;
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
    const dataSource = await this.find({ id: dataSourceId });
    if (dataSource['@type'] === SKL.JsonDataSource) {
      return {
        data: (dataSource[SKL.data] as NodeObject)['@value'] as JSONObject,
      };
    }
    throw new Error(`DataSource type ${dataSource['@type']} is not supported.`);
  }
}
