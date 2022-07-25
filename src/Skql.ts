/* eslint-disable @typescript-eslint/naming-convention */
import { OpenApiOperationExecutor } from '@comake/openapi-operation-executor';
import type { OpenApi } from '@comake/openapi-operation-executor';
import type { NodeObject } from 'jsonld';
import SHACLValidator from 'rdf-validate-shacl';
import { Mapper } from './Mapper';
import { constructUri, convertJsonLdToQuads, toJSON } from './util/Util';
import { SKL, SHACL } from './util/Vocabularies';

export type VerbHandler = (args: any) => Promise<NodeObject>;

export class SKQLBase {
  private readonly mapper: Mapper;
  private schema: any;

  public constructor() {
    this.mapper = new Mapper();
  }

  public async setSchema(schema: Record<string, any>[]): Promise<void> {
    this.schema = schema;
  }

  public async constructVerbHandlerFromSchema(verbName: string): Promise<VerbHandler> {
    const verbSchemaId = constructUri(SKL.verbs, verbName);
    try {
      const verb = await this.getSchema({ '@id': verbSchemaId });
      return this.constructVerbHandler(verb);
    } catch {
      return async(): Promise<NodeObject> => {
        throw new Error(`Failed to find the verb ${verbName} in the schema.`);
      };
    }
  }

  public async getSchema(fields: Record<string, any>): Promise<NodeObject> {
    const schema = this.schema.find((schemaInstance: any): boolean => {
      const schemaFields = Object.entries(fields);
      return schemaFields.every(([ fieldName, fieldValue ]): boolean => fieldName in schemaInstance &&
        (typeof schemaInstance[fieldName] === 'object'
          ? schemaInstance[fieldName]['@id'] === fieldValue
          : schemaInstance[fieldName] === fieldValue
        ));
    });

    if (schema) {
      return schema;
    }

    throw new Error(`No schema found with fields matching ${JSON.stringify(fields)}`);
  }

  private constructVerbHandler(verb: any): VerbHandler {
    return async(args: any): Promise<NodeObject> => {
      // Assert params match
      const argsAsJsonLd = {
        '@context': verb[SKL.parametersContext]['@value'],
        '@type': 'https://skl.standard.storage/nouns/Parameters',
        ...args,
      };
      await this.assertVerbParamsMatchParameterSchemas(
        argsAsJsonLd,
        verb[SKL.parametersProperty],
        verb[SKL.nameProperty],
      );

      const account = await this.getSchema({ '@id': args.account });
      // Find mapping for verb and integration
      const mapping = await this.getSchema({
        '@type': SKL.verbIntegrationMappingNoun,
        [SKL.verbsProperty]: verb['@id'],
        [SKL.integrationProperty]: (account[SKL.integrationProperty] as NodeObject)['@id'],
      });
      // Perform mapping of args
      const operationArgsJsonLd = await this.mapper.apply(args, mapping[SKL.parameterMappingProperty] as NodeObject);
      const operationArgs = toJSON(operationArgsJsonLd);

      const operationInfoJsonLd = await this.mapper.apply(args, mapping[SKL.operationMappingProperty] as NodeObject);
      const { operationId } = toJSON(operationInfoJsonLd);
      const openApiDescriptionSchema = await this.getSchema({
        '@type': SKL.openApiDescriptionNoun,
        [SKL.integrationProperty]: (account[SKL.integrationProperty] as NodeObject)['@id'],
      });

      const securityCredentialsSchema = await this.getSchema({
        '@type': SKL.securityCredentialsNoun,
        [SKL.accountProperty]: args.account,
      });
      const openApiDescription = (
        openApiDescriptionSchema[SKL.openApiDescriptionProperty] as NodeObject
      )['@value'] as OpenApi;
      const openApiExecutor = new OpenApiOperationExecutor();
      await openApiExecutor.setOpenapiSpec(openApiDescription);
      const rawReturnValue = await openApiExecutor.executeOperation(
        operationId as string,
        {
          accessToken: securityCredentialsSchema[SKL.accessTokenProperty] as string,
          apiKey: securityCredentialsSchema[SKL.apiKeyProperty] as string,
        },
        operationArgs,
      );

      // Perform mapping of return value
      const mappedReturnValue = await this.mapper.apply(
        rawReturnValue.data,
        mapping[SKL.returnValueMappingProperty] as NodeObject,
      );
      await this.assertVerbReturnValueMatchesReturnTypeSchema(mappedReturnValue, verb[SKL.returnValueProperty]);
      return mappedReturnValue;
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

  private async assertVerbReturnValueMatchesReturnTypeSchema(
    returnValue: NodeObject,
    returnTypeSchema: NodeObject,
  ): Promise<void> {
    const returnValueAsQuads = await convertJsonLdToQuads([ returnValue ]);
    let returnTypeSchemaObject: any;
    if (typeof returnTypeSchema === 'object' && returnTypeSchema['@type']) {
      returnTypeSchemaObject = returnTypeSchema;
    } else if (typeof returnTypeSchema === 'object' && returnTypeSchema['@id']) {
      returnTypeSchemaObject = await this.getSchema({ '@id': returnTypeSchema['@id'] });
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

export type VerbInterface = Record<string, VerbHandler>;

export type SKQLProxy = VerbInterface & SKQLBase;

function SKQLProxyBuilder(target: SKQLBase): SKQLProxy {
  const skqlProxyHandler = {
    get(getTarget: SKQLBase, property: string): any {
      if (property in getTarget) {
        return (getTarget as any)[property];
      }
      return async(args: any): Promise<NodeObject> => {
        const verbHandler = await getTarget.constructVerbHandlerFromSchema(property);
        return verbHandler(args);
      };
    },
  };
  return new Proxy(target, skqlProxyHandler) as SKQLProxy;
}

export const SKQL = SKQLProxyBuilder(new SKQLBase());
