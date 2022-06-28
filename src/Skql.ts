/* eslint-disable @typescript-eslint/naming-convention */
import { promises as fsPromises } from 'fs';
import SHACLValidator from 'rdf-validate-shacl';
import { Mapper } from './Mapper';
import { OpenApiOperationExecutor } from './openapi/OpenApiOperationExecutor';
import type { OpenApi } from './openapi/OpenApiSchemaConfiguration';
import { constructUri, convertJsonLdToQuads, toJSON } from './util/Util';
import { SKL, SHACL } from './util/Vocabularies';

export type VerbHandler = (args: any) => any;

export interface SetSchemaArgs {
  schema?: Record<string, any>[];
  file?: string;
}

export class SKQLBase {
  private readonly mapper: Mapper;
  private schema: any;

  public constructor() {
    this.mapper = new Mapper();
  }

  public async setSchema(args: SetSchemaArgs): Promise<void> {
    if (args.schema) {
      this.schema = args.schema;
    } else if (args.file) {
      await this.setSchemaFromFile(args.file);
    } else {
      throw new Error('No schema source found in setSchema args.');
    }
  }

  private async setSchemaFromFile(file: string): Promise<void> {
    try {
      const schema = await fsPromises.readFile(file, 'utf8');
      this.schema = JSON.parse(schema);
    } catch {
      throw new Error(`Failed to parse schemas from the supplied file.`);
    }
  }

  public constructVerbHandlerFromSchema(verbName: string): VerbHandler {
    const verbSchemaId = constructUri(SKL.verbs, verbName);
    try {
      const verb = this.getSchemaById(verbSchemaId);
      return this.constructVerbHandler(verb);
    } catch {
      return async(): Promise<void> => {
        throw new Error(`Failed to find the verb ${verbName} in the schema.`);
      };
    }
  }

  private constructVerbHandler(verb: any): VerbHandler {
    return async(args: any): Promise<any> => {
      // Assert params match
      const argsAsJsonLd = {
        '@context': verb[SKL.parametersContext]['@value'],
        '@type': 'https://skl.standard.storage/nouns/VerbArguments',
        ...args,
      };
      await this.assertVerbParamsMatchParameterSchemas(
        argsAsJsonLd,
        verb[SKL.parametersProperty],
        verb[SKL.nameProperty],
      );

      const account = this.getSchemaById(args.account);
      // Find mapping for verb and integration
      const mapping = this.getSchemaByFields({
        '@type': SKL.verbIntegrationMappingNoun,
        [SKL.verbsProperty]: verb['@id'],
        [SKL.integrationProperty]: account[SKL.integrationProperty]['@id'],
      });
      // Perform mapping of args
      const operationArgsJsonLd = await this.mapper.apply(args, mapping[SKL.parameterMappingsProperty]);
      const operationArgs = toJSON(operationArgsJsonLd);

      const operationInfoJsonLd = await this.mapper.apply(args, mapping[SKL.operationMappingsProperty]);
      const { operationId } = toJSON(operationInfoJsonLd);
      const openApiDescriptionSchema = this.getSchemaByFields({
        '@type': SKL.openApiDescriptionNoun,
        [SKL.integrationProperty]: account[SKL.integrationProperty]['@id'],
      });

      const oauthTokenSchema = this.getSchemaByFields({
        '@type': SKL.oauthTokenNoun,
        [SKL.accountProperty]: args.account,
      });
      const openApiDescription = openApiDescriptionSchema[SKL.openApiDescriptionProperty]['@value'] as OpenApi;
      const openApiExecutor = new OpenApiOperationExecutor(openApiDescription);
      const rawReturnValue = await openApiExecutor.executeOperation(
        operationId as string,
        { accessToken: oauthTokenSchema[SKL.accessTokenProperty] },
        operationArgs,
      );

      // Perform mapping of return value
      const mappedReturnValue = await this.mapper.apply(rawReturnValue.data, mapping[SKL.returnValueMappingsProperty]);
      await this.assertVerbReturnValueMatchesReturnTypeSchema(mappedReturnValue, verb[SKL.returnValueProperty]);
      return mappedReturnValue;
    };
  }

  private getSchemaById(id: string): any {
    const schema = this.schema.find((schemaInstance: any): boolean => schemaInstance['@id'] === id);
    if (schema) {
      return schema;
    }

    throw new Error(`No schema found with id ${id}`);
  }

  private getSchemaByFields(fields: any): any {
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

  private async assertVerbParamsMatchParameterSchemas(verbParams: any,
    parameterSchemas: any, verbName: string): Promise<void> {
    const returnValueAsQuads = await convertJsonLdToQuads([ verbParams ]);
    const shape = await convertJsonLdToQuads(parameterSchemas);
    const validator = new SHACLValidator(shape);
    const report = validator.validate(returnValueAsQuads);
    if (!report.conforms) {
      throw new Error(`${verbName} parameters do not conform to the schema`);
    }
  }

  private async assertVerbReturnValueMatchesReturnTypeSchema(returnValue: any, returnTypeSchema: any): Promise<void> {
    const returnValueAsQuads = await convertJsonLdToQuads([ returnValue ]);

    let returnTypeSchemaObject;
    if (typeof returnTypeSchema === 'object' && returnTypeSchema['@type']) {
      returnTypeSchemaObject = returnTypeSchema;
    } else if (typeof returnTypeSchema === 'object' && returnTypeSchema['@id']) {
      returnTypeSchemaObject = this.getSchemaById(returnTypeSchema['@id']);
    }

    returnTypeSchemaObject[SHACL.targetClass] = { '@id': 'https://skl.standard.storage/mappings/frameObject' };
    const shape = await convertJsonLdToQuads(returnTypeSchemaObject);
    const validator = new SHACLValidator(shape);
    const report = validator.validate(returnValueAsQuads);
    if (!report.conforms) {
      throw new Error(`Return value ${returnValue['@id']} does not conform to the schema`);
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
      return getTarget.constructVerbHandlerFromSchema(property);
    },
  };
  return new Proxy(target, skqlProxyHandler) as SKQLProxy;
}

export const SKQL = SKQLProxyBuilder(new SKQLBase());
