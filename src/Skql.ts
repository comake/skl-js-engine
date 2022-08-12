/* eslint-disable @typescript-eslint/naming-convention */
import type { OpenApi } from '@comake/openapi-operation-executor';
import { OpenApiOperationExecutor } from '@comake/openapi-operation-executor/dist/web.js';
import type { NodeObject } from 'jsonld';
import SHACLValidator from 'rdf-validate-shacl';
import { Mapper } from './mapping/Mapper';
import { MemoryQueryAdapter } from './storage/MemoryQueryAdapter';
import type { QueryAdapter, FindQuery } from './storage/QueryAdapter';
import type { SchemaNodeObject } from './util/Types';
import { constructUri, convertJsonLdToQuads, toJSON } from './util/Util';
import type { JSONObject } from './util/Util';
import { SKL, SHACL } from './util/Vocabularies';

export type VerbHandler = (args: JSONObject) => Promise<NodeObject>;
export type VerbInterface = Record<string, VerbHandler>;

export type MappingResponseOption<T extends boolean> = T extends true ? JSONObject : NodeObject;

export interface SetSchemaArgs {
  schema?: SchemaNodeObject[];
  skdsUrl?: string;
}

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

  public async map<T extends boolean = true>(
    args: NodeObject,
    mapping: NodeObject,
    convertToJson: T,
  ): Promise<MappingResponseOption<T>> {
    const operationArgsJsonLd = await this.mapper.apply(args, mapping);
    if (convertToJson) {
      return toJSON(operationArgsJsonLd) as MappingResponseOption<T>;
    }
    return operationArgsJsonLd as MappingResponseOption<T>;
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
    if (verb['@type'] === SKL.openApiOperationVerbNoun) {
      return this.constructOpenApiOperationVerbHandler(verb);
    }
    if (verb['@type'] === SKL.nounMappingVerbNoun) {
      return this.constructNounMappingVerbHandler(verb);
    }

    throw new Error(`Verb type ${verb['@type']} not supported.`);
  }

  private constructOpenApiOperationVerbHandler(verb: SchemaNodeObject): VerbHandler {
    return async(args: JSONObject): Promise<NodeObject> => {
      // Assert params match
      const argsAsJsonLd = {
        '@context': (verb[SKL.parametersContext] as NodeObject)['@value'],
        '@type': 'https://skl.standard.storage/nouns/Parameters',
        ...args,
      };
      await this.assertVerbParamsMatchParameterSchemas(
        argsAsJsonLd,
        verb[SKL.parametersProperty],
        verb[SKL.nameProperty] as string,
      );

      const account = await this.find({ id: args.account as string });
      // Find mapping for verb and integration
      const mapping = await this.find({
        type: SKL.verbIntegrationMappingNoun,
        [SKL.verbsProperty]: verb['@id'],
        [SKL.integrationProperty]: (account[SKL.integrationProperty] as NodeObject)['@id'],
      });

      // Perform mapping of args
      const operationArgs = await this.map(
        args as NodeObject,
        mapping[SKL.parameterMappingProperty] as NodeObject,
        true,
      );
      const operationInfoJsonLd = await this.map(
        args as NodeObject,
        mapping[SKL.operationMappingProperty] as NodeObject,
        true,
      );
      const { operationId } = operationInfoJsonLd as Record<string, string>;
      // Perform the operation
      const rawReturnValue = await this.performOpenapiOperation(operationId, operationArgs, account);
      // Perform mapping of return value
      const mappedReturnValue = await this.map(
        rawReturnValue.data as NodeObject,
        mapping[SKL.returnValueMappingProperty] as NodeObject,
        false,
      );
      await this.assertVerbReturnValueMatchesReturnTypeSchema(
        mappedReturnValue,
        verb[SKL.returnValueProperty] as NodeObject,
      );
      return mappedReturnValue;
    };
  }

  private constructNounMappingVerbHandler(verb: SchemaNodeObject): VerbHandler {
    return async(args: JSONObject): Promise<NodeObject> => {
      // Find mapping for verb and Noun
      const mapping = await this.find({
        type: SKL.verbNounMappingNoun,
        [SKL.verbsProperty]: verb['@id'],
        [SKL.nounProperty]: args.noun as string,
      });

      const verbArgs = await this.map(args as NodeObject, mapping[SKL.parameterMappingProperty] as NodeObject, true);
      const verbInfoJsonLd = await this.map(args as NodeObject, mapping[SKL.verbMappingProperty] as NodeObject, true);
      const mappedVerb = await this.find({ id: verbInfoJsonLd.verb as string });
      return this.constructVerbHandler(mappedVerb)(verbArgs);
    };
  }

  private async assertVerbParamsMatchParameterSchemas(verbParams: any,
    parameterSchemas: any, verbName: string): Promise<void> {
    const paramsAsQuads = await convertJsonLdToQuads([ verbParams ]);
    const shape = await convertJsonLdToQuads(parameterSchemas);
    const validator = new SHACLValidator(shape);
    const report = validator.validate(paramsAsQuads);
    if (!report.conforms) {
      throw new Error(`${verbName} parameters do not conform to the schema`);
    }
  }

  private async performOpenapiOperation(
    operationId: string,
    operationArgs: JSONObject,
    account: SchemaNodeObject,
  ): Promise<any> {
    const openApiDescriptionSchema = await this.find({
      type: SKL.openApiDescriptionNoun,
      [SKL.integrationProperty]: (account[SKL.integrationProperty] as SchemaNodeObject)['@id'],
    });

    const securityCredentialsSchema = await this.find({
      type: SKL.securityCredentialsNoun,
      [SKL.accountProperty]: account['@id'],
    });

    const openApiDescription = (
      openApiDescriptionSchema[SKL.openApiDescriptionProperty] as NodeObject
    )['@value'] as OpenApi;

    const openApiExecutor = new OpenApiOperationExecutor();
    await openApiExecutor.setOpenapiSpec(openApiDescription);
    const response = await openApiExecutor.executeOperation(
      operationId,
      {
        accessToken: securityCredentialsSchema[SKL.accessTokenProperty] as string,
        apiKey: securityCredentialsSchema[SKL.apiKeyProperty] as string,
      },
      operationArgs,
    );
    return response;
  }

  private async assertVerbReturnValueMatchesReturnTypeSchema(
    returnValue: NodeObject,
    returnTypeSchema: NodeObject,
  ): Promise<void> {
    const returnValueAsQuads = await convertJsonLdToQuads([ returnValue ]);

    let returnTypeSchemaObject: NodeObject;
    if (typeof returnTypeSchema === 'object' && returnTypeSchema['@type']) {
      returnTypeSchemaObject = returnTypeSchema;
    } else if (typeof returnTypeSchema === 'object' && returnTypeSchema['@id']) {
      returnTypeSchemaObject = await this.find({ id: returnTypeSchema['@id'] });
    } else {
      throw new Error('returnTypeSchema is not properly formatted.');
    }

    if (returnTypeSchemaObject) {
      returnTypeSchemaObject[SHACL.targetClass] = { '@id': 'https://skl.standard.storage/mappings/frameObject' };
      const shape = await convertJsonLdToQuads(returnTypeSchemaObject);
      const validator = new SHACLValidator(shape);
      const report = validator.validate(returnValueAsQuads);
      if (!report.conforms) {
        throw new Error(`Return value ${returnValue['@id']} does not conform to the schema`);
      }
    }
  }
}
