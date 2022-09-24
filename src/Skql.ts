/* eslint-disable @typescript-eslint/naming-convention */
import type {
  OpenApi,
  CodeAuthorizationUrlResponse,
  OpenApiClientConfiguration,
} from '@comake/openapi-operation-executor';
import { OpenApiOperationExecutor } from '@comake/openapi-operation-executor';
import axios from 'axios';
import type { AxiosError } from 'axios';
import type { ContextDefinition, NodeObject } from 'jsonld';
import SHACLValidator from 'rdf-validate-shacl';
import type ValidationReport from 'rdf-validate-shacl/src/validation-report';
import { Mapper } from './mapping/Mapper';
import { MemoryQueryAdapter } from './storage/MemoryQueryAdapter';
import type { QueryAdapter, FindQuery } from './storage/QueryAdapter';
import type { SchemaNodeObject, UnsavedSchemaNodeObject, NodeObjectWithId } from './util/Types';
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

export interface SetSchemaArgs {
  schema?: SchemaNodeObject[];
  skdsUrl?: string;
}

export interface ErrorMatcher {
  status: number;
  messageRegex: string;
}

const DEFAULT_MAPPING_FRAME = { '@id': 'https://skl.standard.storage/mappingSubject' };

export class Skql {
  private readonly mapper: Mapper;
  private readonly adapter: QueryAdapter;
  public do: VerbInterface;

  public constructor(args: SetSchemaArgs) {
    if (args.schema) {
      this.adapter = new MemoryQueryAdapter(args.schema);
    // } else if (args.skdsUrl) {
    //   this.adapter = new SkdsQueryAdapter(args.skdsUrl);
    } else {
      throw new Error('No schema source found in setSchema args.');
    }

    this.mapper = new Mapper();

    // eslint-disable-next-line func-style
    const getVerbHandler = (getTarget: VerbInterface, property: string): VerbHandler =>
      async(verbArgs: JSONObject): Promise<NodeObject> => {
        const verbHandler = await this.constructVerbHandlerFromSchema(property);
        return verbHandler(verbArgs);
      };
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
    args: NodeObject,
    mapping: NodeObject,
    frame?: Record<string, any>,
  ): Promise<NodeObject> {
    return await this.mapper.apply(args, mapping, frame ?? DEFAULT_MAPPING_FRAME);
  }

  public async performMappingAndConvertToJSON(
    args: NodeObject,
    mapping: NodeObject,
    frame?: Record<string, any>,
  ): Promise<JSONObject> {
    const jsonLd = await this.mapper.applyAndFrameSklProperties(args, mapping, frame ?? DEFAULT_MAPPING_FRAME);
    return toJSON(jsonLd);
  }

  private async constructVerbHandlerFromSchema(verbName: string): Promise<VerbHandler> {
    const verbSchemaId = constructUri(SKL.verbs, verbName);
    let verb;
    try {
      verb = await this.find({ id: verbSchemaId });
    } catch {
      return async(): Promise<NodeObject> => {
        throw new Error(`Failed to find the verb ${verbName} in the schema.`);
      };
    }
    return this.constructVerbHandler(verb);
  }

  private constructVerbHandler(verb: SchemaNodeObject): VerbHandler {
    if (verb['@type'] === SKL.OpenApiOperationVerb) {
      return this.constructOpenApiOperationVerbHandler(verb);
    }
    if (verb['@type'] === SKL.OpenApiSecuritySchemeVerb) {
      return this.constructOpenApiSecuritySchemeVerbHandler(verb);
    }
    if (verb['@type'] === SKL.NounMappedVerb) {
      return this.constructNounMappingVerbHandler(verb);
    }

    throw new Error(`Verb type ${verb['@type']} not supported.`);
  }

  private constructOpenApiOperationVerbHandler(verb: SchemaNodeObject): VerbHandler {
    return async(args: JSONObject): Promise<NodeObject> => {
      await this.assertVerbParamsMatchParameterSchemas(args, verb);
      const account = await this.find({ id: args.account as string });
      const integrationId = (account[SKL.integration] as SchemaNodeObject)['@id'];
      const mapping = await this.findVerbIntegrationMapping(verb['@id'], integrationId);
      const operationArgs = await this.performParameterMappingOnArgsIfDefined(args as NodeObject, mapping);
      const operationInfoJsonLd = await this.performOperationMappingWithArgs(args as NodeObject, mapping);
      const operationId = operationInfoJsonLd[SKL.operationId] as string;
      const rawReturnValue = await this.performOpenapiOperationWithCredentials(operationId, operationArgs, account);
      const mappedReturnValue = await this.performReturnValueMappingWithFrame(rawReturnValue.data, mapping, verb);
      await this.assertVerbReturnValueMatchesReturnTypeSchema(mappedReturnValue, verb);
      return mappedReturnValue;
    };
  }

  private async findVerbIntegrationMapping(verbId: string, integrationId: string): Promise<SchemaNodeObject> {
    return await this.find({
      type: SKL.VerbIntegrationMapping,
      [SKL.verb]: verbId,
      [SKL.integration]: integrationId,
    });
  }

  private async performOperationMappingWithArgs(args: NodeObject, mapping: SchemaNodeObject): Promise<NodeObject> {
    return await this.performMapping(args, mapping[SKL.operationMapping] as NodeObject);
  }

  private async performReturnValueMappingWithFrame(
    data: NodeObject,
    mapping: SchemaNodeObject,
    verb: SchemaNodeObject,
  ): Promise<NodeObject> {
    return await this.performMapping(
      data,
      mapping[SKL.returnValueMapping] as NodeObject,
      {
        ...getValueOfFieldInNodeObject<Record<string, any>>(verb, SKL.returnValueFrame),
        ...getValueOfFieldInNodeObject<Record<string, any> | undefined>(mapping, SKL.returnValueFrame),
      },
    );
  }

  private constructOpenApiSecuritySchemeVerbHandler(verb: SchemaNodeObject): VerbHandler {
    return async(args: JSONObject): Promise<NodeObject> => {
      await this.assertVerbParamsMatchParameterSchemas(args, verb);
      const account = await this.find({ id: args.account as string });
      const integrationId = (account[SKL.integration] as SchemaNodeObject)['@id'];
      const mapping = await this.findVerbIntegrationMapping(verb['@id'], integrationId);
      const operationArgs = await this.performParameterMappingOnArgsIfDefined(args as NodeObject, mapping);
      const operationInfoJsonLd = await this.performOperationMappingWithArgs(args as NodeObject, mapping);
      const openApiDescription = await this.getOpenApiDescriptionForIntegration(integrationId);
      const securityCredentialsSchema = await this.findSecurityCredentialsForAccount(account['@id']);
      const configuration = this.getConfigurationFromSecurityCredentials(securityCredentialsSchema);
      operationArgs.client_id = securityCredentialsSchema[SKL.clientId];
      const openApiExecutor = await this.createOpenApiOperationExecutorWithSpec(openApiDescription);
      const rawReturnValue = await openApiExecutor.executeSecuritySchemeStage(
        operationInfoJsonLd[SKL.schemeName] as string,
        operationInfoJsonLd[SKL.oauthFlow] as string,
        operationInfoJsonLd[SKL.stage] as string,
        configuration,
        operationArgs,
      );

      if ((rawReturnValue as CodeAuthorizationUrlResponse).authorizationUrl) {
        return asJsonLdJsonValue(rawReturnValue as unknown as JSONObject);
      }
      const mappedReturnValue = await this.performReturnValueMappingWithFrame(
        (rawReturnValue as { data: NodeObject }).data, mapping, verb,
      );
      await this.assertVerbReturnValueMatchesReturnTypeSchema(mappedReturnValue, verb);
      return mappedReturnValue;
    };
  }

  private async performParameterMappingOnArgsIfDefined(
    args: NodeObject,
    mapping: SchemaNodeObject,
  ): Promise<Record<string, any>> {
    if (mapping[SKL.parameterMapping]) {
      return await this.performMappingAndConvertToJSON(args, mapping[SKL.parameterMapping] as NodeObject);
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

  private async createOpenApiOperationExecutorWithSpec(openApiDescription: OpenApi): Promise<OpenApiOperationExecutor> {
    const executor = new OpenApiOperationExecutor();
    await executor.setOpenapiSpec(openApiDescription);
    return executor;
  }

  private constructNounMappingVerbHandler(verb: SchemaNodeObject): VerbHandler {
    return async(args: JSONObject): Promise<NodeObject> => {
      const mapping = await this.findVerbNounMapping(verb['@id'], args.noun as string);
      const verbArgs = await this.performParameterMappingOnArgsIfDefined(args as NodeObject, mapping);
      const verbInfoJsonLd = await this.performVerbMappingWithArgs(args as NodeObject, mapping);
      const mappedVerb = await this.find({ id: verbInfoJsonLd[SKL.verb] as string });
      return this.constructVerbHandler(mappedVerb)(verbArgs);
    };
  }

  private async findVerbNounMapping(verbId: string, noun: string): Promise<SchemaNodeObject> {
    return await this.find({
      type: SKL.VerbNounMapping,
      [SKL.verb]: verbId,
      [SKL.noun]: noun,
    });
  }

  private async performVerbMappingWithArgs(args: NodeObject, mapping: SchemaNodeObject): Promise<NodeObject> {
    return await this.performMapping(
      args,
      mapping[SKL.verbMapping] as NodeObject,
    );
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
  ): Promise<any> {
    const integrationId = (account[SKL.integration] as SchemaNodeObject)['@id'];
    const openApiDescription = await this.getOpenApiDescriptionForIntegration(integrationId);
    const openApiExecutor = await this.createOpenApiOperationExecutorWithSpec(openApiDescription);
    const securityCredentials = await this.findSecurityCredentialsForAccount(account['@id']);
    const configuration = {
      accessToken: securityCredentials[SKL.accessToken] as string,
      apiKey: securityCredentials[SKL.apiKey] as string,
    };
    return await openApiExecutor.executeOperation(operationId, configuration, operationArgs)
      .catch(async(error: Error | AxiosError): Promise<any> => {
        if (axios.isAxiosError(error) && await this.isInvalidTokenError(error, integrationId)) {
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
      { refreshToken: securityCredentialsSchema[SKL.refreshToken] as string | undefined },
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
      (rawReturnValue as { data: NodeObject }).data, mapping, getOauthTokenVerb,
    );
    await this.assertVerbReturnValueMatchesReturnTypeSchema(mappedReturnValue, getOauthTokenVerb);
    securityCredentialsSchema[SKL.accessToken] = mappedReturnValue[SKL.accessToken];
    securityCredentialsSchema[SKL.refreshToken] = mappedReturnValue[SKL.refreshToken];
    await this.update(securityCredentialsSchema);
    return { accessToken: securityCredentialsSchema[SKL.accessToken] as string };
  }

  private getConfigurationFromSecurityCredentials(
    securityCredentialsSchema: SchemaNodeObject,
  ): OpenApiClientConfiguration {
    const username = securityCredentialsSchema[SKL.clientId] as string | undefined;
    const password = securityCredentialsSchema[SKL.clientSecret] as string | undefined;
    const accessToken = securityCredentialsSchema[SKL.accessToken] as string | undefined;
    return { username, password, accessToken };
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

    if (!report?.conforms) {
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
    schemaNodeObject: NodeObject,
  ): Promise<ValidationReport> {
    const valueAsQuads = await convertJsonLdToQuads([ value ]);
    const shape = await convertJsonLdToQuads(schemaNodeObject);
    const validator = new SHACLValidator(shape);
    return validator.validate(valueAsQuads);
  }
}
