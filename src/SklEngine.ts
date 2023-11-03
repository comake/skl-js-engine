/* eslint-disable @typescript-eslint/naming-convention */
import type {
  OpenApi,
  OpenApiClientConfiguration,
} from '@comake/openapi-operation-executor';
import { OpenApiOperationExecutor } from '@comake/openapi-operation-executor';
import { getIdFromNodeObjectIfDefined, type ReferenceNodeObject } from '@comake/rmlmapper-js';
import axios from 'axios';
import type { AxiosError, AxiosResponse } from 'axios';
import type { ContextDefinition, GraphObject, NodeObject } from 'jsonld';
import type { Frame } from 'jsonld/jsonld-spec';
import { JSONPath } from 'jsonpath-plus';
import SHACLValidator from 'rdf-validate-shacl';
import type ValidationReport from 'rdf-validate-shacl/src/validation-report';
import { Mapper } from './mapping/Mapper';
import type { SklEngineOptions } from './SklEngineOptions';
import type { FindOperator } from './storage/FindOperator';
import type { FindAllOptions, FindOneOptions, FindOptionsWhere } from './storage/FindOptionsTypes';
import { In } from './storage/operator/In';
import { InversePath } from './storage/operator/InversePath';
import { OneOrMorePath } from './storage/operator/OneOrMorePath';
import { SequencePath } from './storage/operator/SequencePath';
import { ZeroOrMorePath } from './storage/operator/ZeroOrMorePath';
import type { QueryAdapter, RawQueryResult } from './storage/query-adapter/QueryAdapter';
import { SparqlQueryAdapter } from './storage/query-adapter/sparql/SparqlQueryAdapter';
import type {
  Callbacks,
  OrArray,
  Entity,
  OperationResponse,
  VerbMapping,
  VerbIntegrationMapping,
  VerbNounMapping,
  MappingWithVerbMapping,
  MappingWithOperationMapping,
  MappingWithReturnValueMapping,
  MappingWithParameterMapping,
  SeriesVerbArgs,
  Verb,
  TriggerVerbMapping,
  MappingWithParameterReference,
  RdfList,
  VerbConfig,
  JSONObject,
} from './util/Types';
import {
  convertJsonLdToQuads,
  toJSON,
  getValueIfDefined,
  ensureArray,
} from './util/Util';
import { SKL, SHACL, RDFS, SKL_ENGINE, XSD, RDF } from './util/Vocabularies';

export type VerbHandler = <T extends OrArray<NodeObject> = OrArray<NodeObject>>(
  params: JSONObject,
  verbConfig?: VerbConfig,
) => Promise<T>;
export type VerbInterface = Record<string, VerbHandler>;

export type MappingResponseOption<T extends boolean> = T extends true ? JSONObject : NodeObject;

export class SKLEngine {
  private readonly queryAdapter: QueryAdapter;
  private readonly functions?: Record<string, (args: any | any[]) => any>;
  private readonly inputFiles?: Record<string, string>;
  private readonly globalCallbacks?: Callbacks;
  private readonly disableValidation?: boolean;
  public readonly verb: VerbInterface;

  public constructor(options: SklEngineOptions) {
    this.queryAdapter = new SparqlQueryAdapter(options);
    this.disableValidation = options.disableValidation;
    this.globalCallbacks = options.callbacks;
    this.inputFiles = options.inputFiles;
    this.functions = options.functions;

    // eslint-disable-next-line func-style
    const getVerbHandler = (getTarget: VerbInterface, property: string): VerbHandler =>
      async<T extends OrArray<NodeObject> = OrArray<NodeObject>>(
        verbArgs: JSONObject,
        verbConfig?: VerbConfig,
      ): Promise<T> =>
        this.executeVerbByName(property, verbArgs, verbConfig) as Promise<T>;
    this.verb = new Proxy({} as VerbInterface, { get: getVerbHandler });
  }

  public async executeRawQuery<T extends RawQueryResult>(query: string): Promise<T[]> {
    return await this.queryAdapter.executeRawQuery<T>(query);
  }

  public async executeRawEntityQuery(query: string, frame?: Frame): Promise<GraphObject> {
    return await this.queryAdapter.executeRawEntityQuery(query, frame);
  }

  public async find(options?: FindOneOptions): Promise<Entity> {
    const entity = await this.queryAdapter.find(options);
    if (entity) {
      return entity;
    }
    throw new Error(`No schema found with fields matching ${JSON.stringify(options)}`);
  }

  public async findBy(where: FindOptionsWhere, notFoundErrorMessage?: string): Promise<Entity> {
    const entity = await this.queryAdapter.findBy(where);
    if (entity) {
      return entity;
    }
    throw new Error(notFoundErrorMessage ?? `No schema found with fields matching ${JSON.stringify(where)}`);
  }

  public async findByIfExists(options: FindOptionsWhere): Promise<Entity | undefined> {
    try {
      const entity = await this.findBy(options);
      return entity;
    } catch {
      return undefined;
    }
  }

  public async findAll(options?: FindAllOptions): Promise<Entity[]> {
    return await this.queryAdapter.findAll(options);
  }

  public async findAllBy(where: FindOptionsWhere): Promise<Entity[]> {
    return await this.queryAdapter.findAllBy(where);
  }

  public async exists(options?: FindAllOptions): Promise<boolean> {
    return await this.queryAdapter.exists(options);
  }

  public async count(options?: FindAllOptions): Promise<number> {
    return await this.queryAdapter.count(options);
  }

  public async save(entity: Entity): Promise<Entity>;
  public async save(entities: Entity[]): Promise<Entity[]>;
  public async save(entityOrEntities: Entity | Entity[]): Promise<Entity | Entity[]> {
    if (Array.isArray(entityOrEntities)) {
      await this.validateEntitiesConformToNounSchema(entityOrEntities);
      return await this.queryAdapter.save(entityOrEntities);
    }
    await this.validateEntityConformsToNounSchema(entityOrEntities);
    return await this.queryAdapter.save(entityOrEntities);
  }

  public async update(id: string, attributes: Partial<Entity>): Promise<void>;
  public async update(ids: string[], attributes: Partial<Entity>): Promise<void>;
  public async update(idOrIds: string | string[], attributes: Partial<Entity>): Promise<void> {
    if (Array.isArray(idOrIds)) {
      await this.validateEntitiesWithIdsConformsToNounSchemaForAttributes(idOrIds, attributes);
      return await this.queryAdapter.update(idOrIds, attributes);
    }
    await this.validateEntityWithIdConformsToNounSchemaForAttributes(idOrIds, attributes);
    return await this.queryAdapter.update(idOrIds, attributes);
  }

  private async validateEntitiesConformToNounSchema(
    entities: Entity[],
  ): Promise<void> {
    const entitiesByType = this.groupEntitiesByType(entities);
    for (const type of Object.keys(entitiesByType)) {
      const noun = await this.findByIfExists({ id: type });
      if (noun) {
        const parentNouns = await this.getSuperClassesOfNoun(type);
        for (const currentNoun of [ noun, ...parentNouns ]) {
          const entitiesOfType = entitiesByType[type];
          const nounSchemaWithTarget = {
            ...currentNoun,
            [SHACL.targetNode]: entitiesOfType.map((entity): ReferenceNodeObject => ({ '@id': entity['@id'] })),
          };
          const report = await this.convertToQuadsAndValidateAgainstShape(entitiesOfType, nounSchemaWithTarget);
          if (!report.conforms) {
            this.throwValidationReportError(
              report,
              `An entity does not conform to the ${currentNoun['@id']} schema.`,
            );
          }
        }
      }
    }
  }

  private groupEntitiesByType(entities: Entity[]): Record<string, Entity[]> {
    return entities.reduce((groupedEntities: Record<string, Entity[]>, entity): Record<string, Entity[]> => {
      const entityTypes = Array.isArray(entity['@type']) ? entity['@type'] : [ entity['@type'] ];
      for (const type of entityTypes) {
        if (!groupedEntities[type]) {
          groupedEntities[type] = [];
        }
        groupedEntities[type].push(entity);
      }
      return groupedEntities;
    }, {});
  }

  private async getSuperClassesOfNoun(noun: string): Promise<Entity[]> {
    return await this.getParentsOfSelector(noun);
  }

  private async getSuperClassesOfNouns(nouns: string[]): Promise<Entity[]> {
    return await this.getParentsOfSelector(In(nouns));
  }

  private async getParentsOfSelector(selector: string | FindOperator<any, any>): Promise<Entity[]> {
    return await this.findAll({
      where: {
        id: InversePath({
          subPath: OneOrMorePath({ subPath: RDFS.subClassOf as string }),
          value: selector,
        }),
      },
    });
  }

  private async validateEntityConformsToNounSchema(
    entity: Entity,
  ): Promise<void> {
    const nounIds = Array.isArray(entity['@type']) ? entity['@type'] : [ entity['@type'] ];
    const directNouns = await this.findAllBy({ id: In(nounIds) });
    if (directNouns.length > 0) {
      const existingNounIds = directNouns.map((noun): string => noun['@id']);
      const parentNouns = await this.getSuperClassesOfNouns(existingNounIds);
      for (const currentNoun of [ ...directNouns, ...parentNouns ]) {
        const nounSchemaWithTarget = {
          ...currentNoun,
          [SHACL.targetNode]: { '@id': entity['@id'] },
        };
        const report = await this.convertToQuadsAndValidateAgainstShape(entity, nounSchemaWithTarget);
        if (!report.conforms) {
          this.throwValidationReportError(
            report,
            `Entity ${entity['@id']} does not conform to the ${currentNoun['@id']} schema.`,
          );
        }
      }
    }
  }

  private async validateEntitiesWithIdsConformsToNounSchemaForAttributes(
    ids: string[],
    attributes: Partial<Entity>,
  ): Promise<void> {
    for (const id of ids) {
      await this.validateEntityWithIdConformsToNounSchemaForAttributes(id, attributes);
    }
  }

  private async getNounsAndParentNounsOfEntity(id: string): Promise<Entity[]> {
    return await this.findAllBy({
      id: InversePath({
        subPath: SequencePath({
          subPath: [
            RDF.type,
            ZeroOrMorePath({ subPath: RDFS.subClassOf as string }),
          ],
        }),
        value: id,
      }),
    });
  }

  private async validateEntityWithIdConformsToNounSchemaForAttributes(
    id: string,
    attributes: Partial<Entity>,
  ): Promise<void> {
    const nouns = await this.getNounsAndParentNounsOfEntity(id);
    for (const currentNoun of nouns) {
      if (SHACL.property in currentNoun) {
        const nounProperties = ensureArray(currentNoun[SHACL.property] as OrArray<NodeObject>)
          .filter((property): boolean => {
            const path = property[SHACL.path];
            if (typeof path === 'string' && path in attributes) {
              return true;
            }
            if (typeof path === 'object' && '@id' in path! && (path['@id'] as string) in attributes) {
              return true;
            }
            return false;
          });
        if (nounProperties.length > 0) {
          const nounSchemaWithTarget = {
            '@type': SHACL.NodeShape,
            [SHACL.targetNode]: { '@id': id },
            [SHACL.property]: nounProperties,
          };
          const attributesWithId = { ...attributes, '@id': id };
          const report = await this.convertToQuadsAndValidateAgainstShape(attributesWithId, nounSchemaWithTarget);
          if (!report.conforms) {
            this.throwValidationReportError(
              report,
              `Entity ${id} does not conform to the ${currentNoun['@id']} schema.`,
            );
          }
        }
      }
    }
  }

  public async delete(id: string): Promise<void>;
  public async delete(ids: string[]): Promise<void>;
  public async delete(idOrIds: string | string[]): Promise<void> {
    if (Array.isArray(idOrIds)) {
      return await this.queryAdapter.delete(idOrIds);
    }
    return await this.queryAdapter.delete(idOrIds);
  }

  public async destroy(entity: Entity): Promise<Entity>;
  public async destroy(entities: Entity[]): Promise<Entity[]>;
  public async destroy(entityOrEntities: Entity | Entity[]): Promise<Entity | Entity[]> {
    if (Array.isArray(entityOrEntities)) {
      return await this.queryAdapter.destroy(entityOrEntities);
    }
    return await this.queryAdapter.destroy(entityOrEntities);
  }

  public async destroyAll(): Promise<void> {
    return await this.queryAdapter.destroyAll();
  }

  public async performMapping(
    args: JSONObject,
    mapping: OrArray<NodeObject>,
    frame?: Record<string, any>,
    verbConfig?: VerbConfig,
  ): Promise<NodeObject> {
    const functions = {
      ...this.functions,
      ...verbConfig?.functions,
    };
    const mapper = new Mapper({ functions });
    return await mapper.apply(args, mapping, frame ?? {});
  }

  public async executeTrigger(
    integration: string,
    payload: any,
  ): Promise<void> {
    const triggerToVerbMapping = await this.findTriggerVerbMapping(integration);
    const verbArgs = await this.performParameterMappingOnArgsIfDefined(
      payload,
      triggerToVerbMapping,
      undefined,
      false,
    );
    const verbId = await this.performVerbMappingWithArgs(payload, triggerToVerbMapping);
    if (verbId) {
      const mappedVerb = (await this.findBy({ id: verbId })) as Verb;
      await this.executeVerb(mappedVerb, verbArgs);
    }
  }

  private async findTriggerVerbMapping(integration: string): Promise<TriggerVerbMapping> {
    return (await this.findBy(
      {
        type: SKL.TriggerVerbMapping,
        [SKL.integration]: integration,
      },
      `Failed to find a Trigger Verb mapping for integration ${integration}`,
    )) as TriggerVerbMapping;
  }

  private async executeVerbByName(
    verbName: string,
    verbArgs: JSONObject,
    verbConfig?: VerbConfig,
  ): Promise<OrArray<NodeObject>> {
    const verb = await this.findVerbWithName(verbName);
    return await this.executeVerb(verb, verbArgs, verbConfig);
  }

  private async findVerbWithName(verbName: string): Promise<Verb> {
    return (await this.findBy(
      { type: SKL.Verb, [RDFS.label]: verbName },
      `Failed to find the verb ${verbName} in the schema.`,
    )) as Verb;
  }

  private async executeVerb(verb: Verb, verbArgs: JSONObject, verbConfig?: VerbConfig): Promise<OrArray<NodeObject>> {
    this.globalCallbacks?.onVerbStart?.(verb['@id'], verbArgs);
    if (verbConfig?.callbacks?.onVerbStart) {
      verbConfig.callbacks.onVerbStart(verb['@id'], verbArgs);
    }
    let verbReturnValue: any;
    if (SKL.returnValueMapping in verb) {
      verbReturnValue = await this.performReturnValueMappingWithFrame(
        verbArgs,
        verb as MappingWithReturnValueMapping,
        verbConfig,
      );
    } else if (SKL.series in verb) {
      verbReturnValue = await this.executeSeriesVerb(verb, verbArgs, verbConfig);
    } else if (SKL.parallel in verb) {
      verbReturnValue = await this.executeParallelVerb(verb, verbArgs, verbConfig);
    } else if (verbArgs.noun) {
      verbReturnValue = await this.executeNounMappingVerb(verb, verbArgs, verbConfig);
    } else if (verbArgs.account) {
      verbReturnValue = await this.executeIntegrationMappingVerb(verb, verbArgs, verbConfig);
    } else {
      throw new Error(`Verb must be a composite or its parameters must include either a noun or an account.`);
    }
    this.globalCallbacks?.onVerbEnd?.(verb['@id'], verbReturnValue);
    if (verbConfig?.callbacks?.onVerbEnd) {
      verbConfig.callbacks.onVerbEnd(verb['@id'], verbReturnValue);
    }
    return verbReturnValue;
  }

  private shouldValidate(verbConfig?: VerbConfig): boolean {
    return verbConfig?.disableValidation === undefined
      ? this.disableValidation !== true
      : !verbConfig.disableValidation;
  }

  private async executeSeriesVerb(verb: Verb, args: JSONObject, verbConfig?: VerbConfig): Promise<OrArray<NodeObject>> {
    const shouldValidate = this.shouldValidate(verbConfig);
    if (shouldValidate) {
      await this.assertVerbParamsMatchParameterSchemas(args, verb);
    }
    const seriesVerbMappingsList = this.rdfListToArray(verb[SKL.series]!);
    const seriesVerbArgs = { originalVerbParameters: args, previousVerbReturnValue: {}};
    const returnValue = await this.executeSeriesFromList(seriesVerbMappingsList, seriesVerbArgs, verbConfig);
    if (shouldValidate) {
      await this.assertVerbReturnValueMatchesReturnTypeSchema(returnValue, verb);
    }
    return returnValue;
  }

  private rdfListToArray(list: { '@list': VerbMapping[] } | RdfList<VerbMapping>): VerbMapping[] {
    if (!('@list' in list)) {
      return [
        list[RDF.first],
        ...getIdFromNodeObjectIfDefined(list[RDF.rest] as ReferenceNodeObject) === RDF.nil
          ? []
          : this.rdfListToArray(list[RDF.rest] as RdfList<VerbMapping>),
      ];
    }
    return list['@list'];
  }

  private async executeSeriesFromList(
    list: VerbMapping[],
    args: SeriesVerbArgs,
    verbConfig?: VerbConfig,
  ): Promise<OrArray<NodeObject>> {
    const nextVerbMapping = list[0];
    const returnValue = await this.executeVerbFromVerbMapping(nextVerbMapping, args, verbConfig);
    if (list.length > 1) {
      return await this.executeSeriesFromList(
        list.slice(1),
        { ...args, previousVerbReturnValue: returnValue as JSONObject },
        verbConfig,
      );
    }
    return returnValue;
  }

  private async executeVerbFromVerbMapping(
    verbMapping: VerbMapping,
    args: JSONObject,
    verbConfig?: VerbConfig,
  ): Promise<OrArray<NodeObject>> {
    args = await this.addPreProcessingMappingToArgs(verbMapping, args, verbConfig);
    const verbId = await this.performVerbMappingWithArgs(args, verbMapping, verbConfig);
    if (verbId) {
      const verbArgs = await this.performParameterMappingOnArgsIfDefined(
        { ...args, verbId },
        verbMapping,
        verbConfig,
        false,
      );
      if (verbId === SKL_ENGINE.update) {
        await this.updateEntityFromVerbArgs(verbArgs);
        return {};
      }
      if (verbId === SKL_ENGINE.save) {
        return await this.saveEntityOrEntitiesFromVerbArgs(verbArgs);
      }
      if (verbId === SKL_ENGINE.destroy) {
        return await this.destroyEntityOrEntitiesFromVerbArgs(verbArgs);
      }
      if (verbId === SKL_ENGINE.findAll) {
        return await this.findAll(verbArgs);
      }
      if (verbId === SKL_ENGINE.find) {
        return await this.find(verbArgs);
      }
      if (verbId === SKL_ENGINE.count) {
        return await this.countAndWrapValueFromVerbArgs(verbArgs);
      }
      if (verbId === SKL_ENGINE.exists) {
        return await this.existsAndWrapValueFromVerbArgs(verbArgs);
      }
      const returnValue = await this.findAndExecuteVerb(verbId, verbArgs, verbConfig);
      if (SKL.returnValueMapping in verbMapping) {
        return await this.performReturnValueMappingWithFrame(
          returnValue as JSONObject,
          verbMapping as MappingWithReturnValueMapping,
          verbConfig,
        );
      }
      return returnValue;
    }
    return {};
  }

  private async addPreProcessingMappingToArgs(
    verbMapping: VerbMapping,
    args: JSONObject,
    verbConfig?: VerbConfig,
  ): Promise<JSONObject> {
    if (SKL.preProcessingMapping in verbMapping) {
      const preMappingArgs = await this.performMapping(
        args,
        verbMapping[SKL.preProcessingMapping] as NodeObject,
        getValueIfDefined(verbMapping[SKL.preProcessingMappingFrame]),
        verbConfig,
      );
      return { ...args, preProcessedParameters: preMappingArgs as JSONObject };
    }
    return args;
  }

  private async updateEntityFromVerbArgs(args: Record<string, any>): Promise<void> {
    await this.update(args.id ?? args.ids, args.attributes);
  }

  private async saveEntityOrEntitiesFromVerbArgs(args: Record<string, any>): Promise<OrArray<Entity>> {
    return await this.save(args.entity ?? args.entities);
  }

  private async destroyEntityOrEntitiesFromVerbArgs(args: Record<string, any>): Promise<OrArray<Entity>> {
    return await this.destroy(args.entity ?? args.entities);
  }

  private async countAndWrapValueFromVerbArgs(args: Record<string, any>): Promise<NodeObject> {
    const count = await this.count(args);
    return {
      [SKL_ENGINE.countResult]: {
        '@value': count,
        '@type': XSD.integer,
      },
    };
  }

  private async existsAndWrapValueFromVerbArgs(args: Record<string, any>): Promise<NodeObject> {
    const exists = await this.exists(args);
    return {
      [SKL_ENGINE.existsResult]: {
        '@value': exists,
        '@type': XSD.boolean,
      },
    };
  }

  private async findAndExecuteVerb(
    verbId: string,
    args: Record<string, any>,
    verbConfig?: VerbConfig,
  ): Promise<OrArray<NodeObject>> {
    const verb = (await this.findBy({ id: verbId })) as Verb;
    return await this.executeVerb(verb, args, verbConfig);
  }

  private async executeParallelVerb(verb: Verb, args: JSONObject, verbConfig?: VerbConfig): Promise<NodeObject[]> {
    const shouldValidate = this.shouldValidate(verbConfig);
    if (shouldValidate) {
      await this.assertVerbParamsMatchParameterSchemas(args, verb);
    }
    const parallelVerbMappings = ensureArray(verb[SKL.parallel] as unknown as OrArray<VerbMapping>);
    const nestedReturnValues = await Promise.all<Promise<OrArray<NodeObject>>>(
      parallelVerbMappings.map((verbMapping): Promise<OrArray<NodeObject>> =>
        this.executeVerbFromVerbMapping(verbMapping, args, verbConfig)),
    );
    const allReturnValues = nestedReturnValues.flat();
    if (shouldValidate) {
      await this.assertVerbReturnValueMatchesReturnTypeSchema(allReturnValues, verb);
    }
    return allReturnValues;
  }

  private async executeIntegrationMappingVerb(
    verb: Verb,
    args: JSONObject,
    verbConfig?: VerbConfig,
  ): Promise<NodeObject> {
    const shouldValidate = this.shouldValidate(verbConfig);
    if (shouldValidate) {
      await this.assertVerbParamsMatchParameterSchemas(args, verb);
    }
    const account = await this.findBy({ id: args.account as string });
    const integrationId = (account[SKL.integration] as ReferenceNodeObject)['@id'];
    const mapping = await this.findVerbIntegrationMapping(verb['@id'], integrationId);
    const operationArgs = await this.performParameterMappingOnArgsIfDefined(
      args,
      mapping as MappingWithParameterMapping,
      verbConfig,
    );
    const operationInfo = await this.performOperationMappingWithArgs(args, mapping, verbConfig);
    const rawReturnValue = await this.performOperation(
      operationInfo,
      operationArgs,
      args,
      account,
      undefined,
      verbConfig,
    );
    if (operationInfo[SKL.schemeName] && rawReturnValue.data.authorizationUrl) {
      return {
        '@type': '@json',
        '@value': rawReturnValue.data,
      };
    }

    if (mapping[SKL.returnValueMapping]) {
      const mappedReturnValue = await this.performReturnValueMappingWithFrame(
        rawReturnValue,
        mapping as MappingWithReturnValueMapping,
        verbConfig,
        verb,
      );
      if (shouldValidate) {
        await this.assertVerbReturnValueMatchesReturnTypeSchema(mappedReturnValue, verb);
      }
      return mappedReturnValue;
    }
    return rawReturnValue as unknown as NodeObject;
  }

  private async findVerbIntegrationMapping(verbId: string, integrationId: string): Promise<VerbIntegrationMapping> {
    return (await this.findBy({
      type: SKL.VerbIntegrationMapping,
      [SKL.verb]: verbId,
      [SKL.integration]: integrationId,
    })) as VerbIntegrationMapping;
  }

  private async performOperationMappingWithArgs(
    args: JSONObject,
    mapping: MappingWithOperationMapping,
    verbConfig?: VerbConfig,
  ): Promise<NodeObject> {
    if (mapping[SKL.operationId]) {
      return { [SKL.operationId]: mapping[SKL.operationId] };
    }
    if (mapping[SKL.dataSource]) {
      return { [SKL.dataSource]: mapping[SKL.dataSource] };
    }
    return await this.performMapping(
      args,
      mapping[SKL.operationMapping] as OrArray<NodeObject>,
      undefined,
      verbConfig,
    );
  }

  private async performOperation(
    operationInfo: NodeObject,
    operationArgs: JSONObject,
    originalArgs: JSONObject,
    account: Entity,
    securityCredentials?: Entity,
    verbConfig?: VerbConfig,
  ): Promise<OperationResponse> {
    if (operationInfo[SKL.schemeName]) {
      return await this.performOauthSecuritySchemeStageWithCredentials(
        operationInfo,
        operationArgs,
        account,
        securityCredentials,
      );
    }
    if (operationInfo[SKL.dataSource]) {
      return await this.getDataFromDataSource(
        getIdFromNodeObjectIfDefined(operationInfo[SKL.dataSource] as string | ReferenceNodeObject)!,
        verbConfig,
      );
    }
    if (operationInfo[SKL.operationId]) {
      const response = await this.performOpenapiOperationWithCredentials(
        getValueIfDefined(operationInfo[SKL.operationId])!,
        operationArgs,
        account,
      );
      return this.axiosResponseAndParamsToOperationResponse(response, operationArgs, originalArgs);
    }
    throw new Error('Operation not supported.');
  }

  private axiosResponseAndParamsToOperationResponse(
    response: AxiosResponse,
    operationParameters: JSONObject,
    originalArgs: JSONObject,
  ): OperationResponse {
    return {
      operationParameters,
      originalVerbParameters: originalArgs,
      data: response.data,
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      config: {
        headers: response.config.headers,
        method: response.config.method,
        url: response.config.url,
        data: response.config.data,
      } as JSONObject,
    };
  }

  private async performReturnValueMappingWithFrame(
    returnValue: JSONObject,
    mapping: MappingWithReturnValueMapping,
    verbConfig?: VerbConfig,
    verb?: Entity,
  ): Promise<NodeObject> {
    return await this.performMapping(
      returnValue,
      mapping[SKL.returnValueMapping],
      {
        ...getValueIfDefined<JSONObject>(verb?.[SKL.returnValueFrame]),
        ...getValueIfDefined<JSONObject>(mapping[SKL.returnValueFrame]),
      },
      verbConfig,
    );
  }

  private async performParameterMappingOnArgsIfDefined(
    args: JSONObject,
    mapping: Partial<MappingWithParameterMapping> | Partial<MappingWithParameterReference>,
    verbConfig?: VerbConfig,
    convertToJsonDeep = true,
  ): Promise<Record<string, any>> {
    if (SKL.parameterReference in mapping) {
      const reference = getValueIfDefined<string>(mapping[SKL.parameterReference])!;
      return this.getDataAtReference(reference, args);
    }
    if (SKL.parameterMapping in mapping) {
      const mappedData = await this.performMapping(
        args,
        (mapping as MappingWithParameterMapping)[SKL.parameterMapping]!,
        getValueIfDefined(mapping[SKL.parameterMappingFrame]),
        verbConfig,
      );
      return toJSON(mappedData, convertToJsonDeep);
    }
    return args;
  }

  private getDataAtReference(reference: string, data: JSONObject): any {
    const results = JSONPath({
      path: reference,
      json: data,
      resultType: 'value',
    });
    const isArrayOfLengthOne = Array.isArray(results) && results.length === 1;
    return isArrayOfLengthOne ? results[0] : results;
  }

  private async getOpenApiDescriptionForIntegration(integrationId: string): Promise<OpenApi> {
    const openApiDescriptionSchema = await this.findBy({
      type: SKL.OpenApiDescription,
      [SKL.integration]: integrationId,
    });
    return getValueIfDefined<OpenApi>(openApiDescriptionSchema[SKL.openApiDescription])!;
  }

  private async findSecurityCredentialsForAccountIfDefined(accountId: string): Promise<Entity | undefined> {
    return await this.findByIfExists({
      type: SKL.SecurityCredentials,
      [SKL.account]: accountId,
    });
  }

  private async createOpenApiOperationExecutorWithSpec(openApiDescription: OpenApi): Promise<OpenApiOperationExecutor> {
    const executor = new OpenApiOperationExecutor();
    await executor.setOpenapiSpec(openApiDescription);
    return executor;
  }

  private async executeNounMappingVerb(verb: Entity, args: JSONObject, verbConfig?: VerbConfig): Promise<NodeObject> {
    const mapping = await this.findVerbNounMapping(verb['@id'], args.noun as string);
    if (mapping[SKL.returnValueMapping]) {
      return await this.performReturnValueMappingWithFrame(
        args,
        mapping as MappingWithReturnValueMapping,
        verbConfig,
        verb,
      );
    }
    const verbArgs = await this.performParameterMappingOnArgsIfDefined(args, mapping, verbConfig, false);
    const verbId = await this.performVerbMappingWithArgs(args, mapping, verbConfig);
    const mappedVerb = (await this.findBy({ id: verbId })) as Verb;

    this.globalCallbacks?.onVerbStart?.(verb['@id'], verbArgs);
    if (verbConfig?.callbacks?.onVerbStart) {
      verbConfig.callbacks.onVerbStart(verb['@id'], verbArgs);
    }

    const returnValue = await this.executeIntegrationMappingVerb(mappedVerb, verbArgs, verbConfig);

    this.globalCallbacks?.onVerbEnd?.(verb['@id'], returnValue);
    if (verbConfig?.callbacks?.onVerbEnd) {
      verbConfig.callbacks.onVerbEnd(verb['@id'], returnValue);
    }
    return returnValue;
  }

  private async findVerbNounMapping(verbId: string, noun: string): Promise<VerbNounMapping> {
    return (await this.findBy({
      type: SKL.VerbNounMapping,
      [SKL.verb]: verbId,
      [SKL.noun]: InversePath({
        subPath: ZeroOrMorePath({ subPath: RDFS.subClassOf as string }),
        value: noun,
      }),
    })) as VerbNounMapping;
  }

  private async performVerbMappingWithArgs(
    args: JSONObject,
    mapping: MappingWithVerbMapping,
    verbConfig?: VerbConfig,
  ): Promise<string | undefined> {
    if (mapping[SKL.verbId]) {
      return getValueIfDefined<string>(mapping[SKL.verbId])!;
    }
    const verbInfoJsonLd = await this.performMapping(
      args,
      mapping[SKL.verbMapping] as NodeObject,
      undefined,
      verbConfig,
    );
    return getValueIfDefined<string>(verbInfoJsonLd[SKL.verbId])!;
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
      this.throwValidationReportError(
        report,
        `${getValueIfDefined(verb[RDFS.label])} parameters do not conform to the schema`,
      );
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
      accessToken: getValueIfDefined<string>(securityCredentials?.[SKL.accessToken]),
      bearerToken: getValueIfDefined<string>(securityCredentials?.[SKL.bearerToken]),
      apiKey: getValueIfDefined<string>(securityCredentials?.[SKL.apiKey]),
      basePath: getValueIfDefined<string>(account[SKL.overrideBasePath]),
    };
    return await openApiExecutor.executeOperation(operationId, configuration, operationArgs)
      .catch(async(error: Error | AxiosError): Promise<any> => {
        if (axios.isAxiosError(error) && await this.isInvalidTokenError(error, integrationId) && securityCredentials) {
          const refreshedConfiguration = await this.refreshSecurityCredentials(
            securityCredentials,
            integrationId,
            account,
          );
          return await openApiExecutor.executeOperation(operationId, refreshedConfiguration, operationArgs);
        }
        throw error;
      });
  }

  private async isInvalidTokenError(error: AxiosError, integrationId: string): Promise<boolean> {
    const integration = await this.findBy({ id: integrationId });
    const errorMatcher = integration[SKL.invalidTokenErrorMatcher] as NodeObject;
    const errorMatcherStatus = errorMatcher &&
      getValueIfDefined<string>(errorMatcher[SKL.invalidTokenErrorMatcherStatus]);
    const errorMatcherRegex = errorMatcher &&
      getValueIfDefined<string>(errorMatcher[SKL.invalidTokenErrorMatcherMessageRegex])!;
    if (errorMatcher && (error.response?.status === errorMatcherStatus)) {
      if (!errorMatcherRegex) {
        return true;
      }
      if (
        error.response?.statusText &&
        new RegExp(errorMatcherRegex, 'u').test(error.response?.statusText)
      ) {
        return true;
      }
    }

    return false;
  }

  private async refreshSecurityCredentials(
    securityCredentials: Entity,
    integrationId: string,
    account: Entity,
    verbConfig?: VerbConfig,
  ): Promise<OpenApiClientConfiguration> {
    const getOauthTokenVerb = (await this.findBy({ type: SKL.Verb, [RDFS.label]: 'getOauthTokens' })) as Verb;
    const mapping = await this.findVerbIntegrationMapping(getOauthTokenVerb['@id'], integrationId);
    const args = {
      refreshToken: getValueIfDefined<string>(securityCredentials[SKL.refreshToken])!,
      jwtBearerOptions: getValueIfDefined<string>(securityCredentials[SKL.jwtBearerOptions])!,
    };
    const operationArgs = await this.performParameterMappingOnArgsIfDefined(args, mapping, verbConfig);
    const operationInfoJsonLd = await this.performOperationMappingWithArgs({}, mapping, verbConfig);
    const rawReturnValue = await this.performOperation(
      operationInfoJsonLd,
      operationArgs,
      args,
      account,
      securityCredentials,
      verbConfig,
    );
    const mappedReturnValue = await this.performReturnValueMappingWithFrame(
      rawReturnValue,
      mapping as MappingWithReturnValueMapping,
      verbConfig,
      getOauthTokenVerb,
    );
    await this.assertVerbReturnValueMatchesReturnTypeSchema(mappedReturnValue, getOauthTokenVerb);
    const bearerToken = getValueIfDefined<string>(mappedReturnValue[SKL.bearerToken]);
    const accessToken = getValueIfDefined<string>(mappedReturnValue[SKL.accessToken]);
    const refreshToken = getValueIfDefined<string>(mappedReturnValue[SKL.refreshToken]);
    if (bearerToken) {
      securityCredentials[SKL.bearerToken] = bearerToken;
    }
    if (accessToken) {
      securityCredentials[SKL.accessToken] = accessToken;
    }
    if (refreshToken) {
      securityCredentials[SKL.refreshToken] = refreshToken;
    }
    await this.save(securityCredentials);
    return { accessToken, bearerToken };
  }

  private getOauthConfigurationFromSecurityCredentials(
    securityCredentialsSchema: Entity,
  ): OpenApiClientConfiguration {
    const username = getValueIfDefined<string>(securityCredentialsSchema[SKL.clientId]);
    const password = getValueIfDefined<string>(securityCredentialsSchema[SKL.clientSecret]);
    const accessToken = getValueIfDefined<string>(securityCredentialsSchema[SKL.accessToken]);
    return { username, password, accessToken };
  }

  private async assertVerbReturnValueMatchesReturnTypeSchema(
    returnValue: OrArray<NodeObject>,
    verb: Verb,
  ): Promise<void> {
    let returnTypeSchemaObject = verb[SKL.returnValue];
    if (returnTypeSchemaObject?.['@id'] && Object.keys(returnTypeSchemaObject).length === 1) {
      returnTypeSchemaObject = await this.findBy({ id: returnTypeSchemaObject['@id'] });
    }
    let report: ValidationReport | undefined;
    if (returnValue && returnTypeSchemaObject) {
      if (Array.isArray(returnValue)) {
        if (returnValue.some((valueItem): boolean => '@id' in valueItem)) {
          returnTypeSchemaObject[SHACL.targetNode] = returnValue
            .reduce((nodes: ReferenceNodeObject[], returnValueItem): ReferenceNodeObject[] => {
              if (returnValueItem['@id']) {
                nodes.push({ '@id': returnValueItem['@id'] });
              }
              return nodes;
            }, []);
        } else {
          const targetClasses = returnValue
            .reduce((nodes: ReferenceNodeObject[], returnValueItem): ReferenceNodeObject[] => {
              if (returnValueItem['@type']) {
                const type = Array.isArray(returnValueItem['@type'])
                  ? returnValueItem['@type'][0]
                  : returnValueItem['@type'];
                if (!nodes.includes({ '@id': type })) {
                  nodes.push({ '@id': type });
                }
              }
              return nodes;
            }, []);
          if (targetClasses.length > 0) {
            returnTypeSchemaObject[SHACL.targetClass] = targetClasses;
          }
        }
        report = await this.convertToQuadsAndValidateAgainstShape(returnValue, returnTypeSchemaObject);
      } else if (Object.keys(returnValue).length > 0) {
        if (returnValue['@id']) {
          returnTypeSchemaObject[SHACL.targetNode] = { '@id': returnValue['@id'] };
        } else {
          returnTypeSchemaObject[SHACL.targetClass] = {
            '@id': Array.isArray(returnValue['@type']) ? returnValue['@type'][0] : returnValue['@type']!,
          };
        }
        report = await this.convertToQuadsAndValidateAgainstShape(returnValue, returnTypeSchemaObject);
      }
    }

    if (report && !report?.conforms) {
      throw new Error(
        `Return value ${Array.isArray(returnValue) ? 'array' : returnValue['@id']} does not conform to the schema`,
      );
    }
  }

  private async convertToQuadsAndValidateAgainstShape(
    value: OrArray<NodeObject>,
    shape: NodeObject,
  ): Promise<ValidationReport> {
    const valueAsQuads = await convertJsonLdToQuads(Array.isArray(value) ? value : [ value ]);
    const shapeQuads = await convertJsonLdToQuads(shape);
    const validator = new SHACLValidator(shapeQuads);
    return validator.validate(valueAsQuads);
  }

  private async performOauthSecuritySchemeStageWithCredentials(
    operationInfo: NodeObject,
    operationParameters: JSONObject,
    account: Entity,
    securityCredentials?: Entity,
  ): Promise<OperationResponse> {
    const integrationId = (account[SKL.integration] as ReferenceNodeObject)['@id'];
    const openApiDescription = await this.getOpenApiDescriptionForIntegration(integrationId);
    securityCredentials ||= await this.findSecurityCredentialsForAccountIfDefined(account['@id']);
    let configuration: OpenApiClientConfiguration;
    if (securityCredentials) {
      configuration = this.getOauthConfigurationFromSecurityCredentials(securityCredentials);
      operationParameters.client_id = getValueIfDefined<string>(securityCredentials[SKL.clientId])!;
    } else {
      configuration = {};
    }
    const openApiExecutor = await this.createOpenApiOperationExecutorWithSpec(openApiDescription);
    const response = await openApiExecutor.executeSecuritySchemeStage(
      getValueIfDefined(operationInfo[SKL.schemeName])!,
      getValueIfDefined(operationInfo[SKL.oauthFlow])!,
      getValueIfDefined(operationInfo[SKL.stage])!,
      configuration,
      operationParameters,
    );
    if ('codeVerifier' in response && 'authorizationUrl' in response) {
      return {
        data: response as unknown as JSONObject,
        operationParameters,
      };
    }
    return this.axiosResponseAndParamsToOperationResponse(response, operationParameters, operationParameters);
  }

  private async getDataFromDataSource(dataSourceId: string, verbConfig?: VerbConfig): Promise<OperationResponse> {
    const dataSource = await this.findBy({ id: dataSourceId });
    if (dataSource['@type'] === SKL.JsonDataSource) {
      const data = this.getDataFromJsonDataSource(dataSource, verbConfig);
      return { data, operationParameters: {}};
    }
    throw new Error(`DataSource type ${dataSource['@type']} is not supported.`);
  }

  private getDataFromJsonDataSource(dataSource: NodeObject, verbConfig?: VerbConfig): JSONObject {
    if (dataSource[SKL.source]) {
      const sourceValue = getValueIfDefined<string>(dataSource[SKL.source])!;
      return this.getJsonDataFromSource(sourceValue, verbConfig);
    }
    return getValueIfDefined<JSONObject>(dataSource[SKL.data])!;
  }

  private getJsonDataFromSource(source: string, verbConfig?: VerbConfig): JSONObject {
    const inputFiles = {
      ...this.inputFiles,
      ...verbConfig?.inputFiles,
    };
    if (source in inputFiles) {
      const file = inputFiles[source];
      if (typeof file === 'string') {
        return JSON.parse(file);
      }
      return file;
    }
    // eslint-disable-next-line unicorn/expiring-todo-comments
    // TODO add support for remote sources
    throw new Error(`Failed to get data from source ${source}`);
  }

  private throwValidationReportError(report: ValidationReport, errorMessage: string): void {
    const reportMessages = this.validationReportToMessages(report);
    throw new Error(
      `${errorMessage}\n\n${reportMessages.join('\n')}`,
    );
  }

  private validationReportToMessages(report: ValidationReport): string[] {
    const reportMessages = [];
    for (const result of report.results) {
      const pathValue = result.path?.value;
      if (result.message.length === 0) {
        const message = `${pathValue}: Invalid due to ${result.sourceConstraintComponent?.value}`;
        reportMessages.push(message);
      } else {
        const resultMessages = result.message
          .map((message): string => `${message.value}`)
          .join(', ');
        const message = `${pathValue}: ${resultMessages}`;
        reportMessages.push(message);
      }
    }
    return reportMessages;
  }
}
