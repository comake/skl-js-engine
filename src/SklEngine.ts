/* eslint-disable @typescript-eslint/naming-convention */
import './util/safeJsonStringify';
import type {
  OpenApi,
  OpenApiClientConfiguration,
  OperationWithPathInfo,
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
import { Logger } from './logger';
import { Mapper } from './mapping/Mapper';
import type { SklEngineOptions } from './SklEngineOptions';
import type { FindOperator } from './storage/FindOperator';
import type { FindAllOptions, FindOneOptions, FindOptionsWhere } from './storage/FindOptionsTypes';
import { Exists } from './storage/operator/Exists';
import { In } from './storage/operator/In';
import { InversePath } from './storage/operator/InversePath';
import { Not } from './storage/operator/Not';
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
  MappingWithReturnValueMapping,
  MappingWithParameterMapping,
  SeriesVerbArgs,
  Verb,
  TriggerMapping,
  MappingWithParameterReference,
  RdfList,
  VerbConfig,
  JSONObject,
  VerbMapping,
  Mapping,
  MappingWithSeries,
  MappingWithParallel,
  JSONValue,
} from './util/Types';
import {
  convertJsonLdToQuads,
  toJSON,
  getValueIfDefined,
  ensureArray,
} from './util/Util';
import { SKL, SHACL, RDFS, SKL_ENGINE, XSD, RDF, SKLSO_PROPERTY, SKLSO_DATA_NAMESPACE } from './util/Vocabularies';
import { GroupByOptions, GroupByResponse } from './storage/GroupOptionTypes';
import { AxiosRequestConfig } from 'axios';

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
  private readonly isDebugMode: boolean;

  public constructor(options: SklEngineOptions) {
    this.queryAdapter = new SparqlQueryAdapter(options);
    this.disableValidation = options.disableValidation;
    this.globalCallbacks = options.callbacks;
    this.inputFiles = options.inputFiles;
    this.functions = options.functions;
    this.isDebugMode = options.debugMode ?? false;
    Logger.getInstance(this.isDebugMode);

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

  public async executeRawUpdate(query: string): Promise<void> {
    return await this.queryAdapter.executeRawUpdate(query);
  }

  public async executeRawConstructQuery(query: string, frame?: Frame): Promise<GraphObject> {
    return await this.queryAdapter.executeRawConstructQuery(query, frame);
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

  public async groupBy(options: GroupByOptions): Promise<GroupByResponse> {
    return await this.queryAdapter.groupBy(options);
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
    args: JSONValue,
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
    const verbArgs = await this.performParameterMappingOnArgsIfDefined(payload, triggerToVerbMapping);
    const verbId = await this.performVerbMappingWithArgs(payload, triggerToVerbMapping);
    if (verbId) {
      const mappedVerb = (await this.findBy({ id: verbId })) as Verb;
      await this.executeVerb(mappedVerb, verbArgs);
    }
  }

  private async findTriggerVerbMapping(integration: string): Promise<TriggerMapping> {
    return (await this.findBy(
      {
        type: SKL.TriggerVerbMapping,
        [SKL.integration]: integration,
      },
      `Failed to find a Trigger Verb mapping for integration ${integration}`,
    )) as TriggerMapping;
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
      Logger.getInstance().log('Verb arguments', verbArgs);
      verbConfig.callbacks.onVerbStart(verb['@id'], verbArgs);
    }
    const { mapping, account } = await this.findMappingForVerbContextually(verb['@id'], verbArgs);
    Logger.getInstance().log('Mapping', JSON.stringify(mapping));
    const shouldValidate = this.shouldValidate(verbConfig);
    if (shouldValidate) {
      await this.assertVerbParamsMatchParameterSchemas(verbArgs, verb);
    }
    const verbReturnValue = await this.executeMapping(mapping, verbArgs, verbConfig, account);
    if (shouldValidate) {
      await this.assertVerbReturnValueMatchesReturnTypeSchema(verbReturnValue, verb);
    }
    this.globalCallbacks?.onVerbEnd?.(verb['@id'], verbReturnValue);
    if (verbConfig?.callbacks?.onVerbEnd) {
      verbConfig.callbacks.onVerbEnd(verb['@id'], verbReturnValue);
    }
    return verbReturnValue;
  }

  private async findMappingForVerbContextually(
    verbId: string,
    args: JSONObject,
  ): Promise<{ mapping: VerbMapping; account?: Entity }> {
    if (args.mapping) {
      const mapping = await this.findByIfExists({ id: args.mapping as string });
      if (!mapping) {
        throw new Error(`Mapping ${args.mapping as string} not found.`);
      }
      return { mapping: mapping as VerbMapping };
    }
    if (args.noun) {
      const mapping = await this.findVerbNounMapping(verbId, args.noun as string);
      if (mapping) {
        return { mapping };
      }
    }
    if (args.account) {
      const account = await this.findBy({ id: args.account as string });
      const integrationId = (account[SKL.integration] as ReferenceNodeObject)['@id'];
      const mapping = await this.findVerbIntegrationMapping(verbId, integrationId);
      if (mapping) {
        return { mapping, account };
      }
    }

    const mappings = await this.findAllBy({
      type: SKL.Mapping,
      [SKL.verb]: verbId,
      [SKL.integration]: Not(Exists()),
      [SKL.noun]: Not(Exists()),
    });
    if (mappings.length === 1) {
      return { mapping: mappings[0] as VerbMapping };
    }
    if (mappings.length > 1) {
      throw new Error('Multiple mappings found for verb, please specify one.');
    }
    if (args.noun) {
      throw new Error(`Mapping between noun ${args.noun as string} and verb ${verbId} not found.`);
    }
    if (args.account) {
      throw new Error(`Mapping between account ${args.account as string} and verb ${verbId} not found.`);
    }
    throw new Error(`No mapping found.`);
  }

  private async executeMapping(
    mapping: Mapping,
    args: JSONObject,
    verbConfig?: VerbConfig,
    account?: Entity,
  ): Promise<OrArray<NodeObject>> {
    args = await this.addPreProcessingMappingToArgs(mapping, args, verbConfig);
    let returnValue: OrArray<NodeObject>;
    if (SKL.verbId in mapping || SKL.verbMapping in mapping) {
      const verbId = await this.performVerbMappingWithArgs(args, mapping, verbConfig);
      const mappedArgs = await this.performParameterMappingOnArgsIfDefined(
        { ...args, verbId },
        mapping as MappingWithParameterMapping,
        verbConfig,
      );
      Logger.getInstance().log('Mapped args', mappedArgs);
      returnValue = await this.executeVerbMapping(mapping, args, mappedArgs, verbConfig);
    } else {
      const mappedArgs = await this.performParameterMappingOnArgsIfDefined(
        args,
        mapping as MappingWithParameterMapping,
        verbConfig,
      );
      Logger.getInstance().log('Mapped args', mappedArgs);
      if (SKL.operationId in mapping || SKL.operationMapping in mapping) {
        returnValue = await this.executeOperationMapping(
          mapping,
          mappedArgs,
          args,
          account!,
          verbConfig,
        ) as NodeObject;
      } else if (SKL.series in mapping) {
        returnValue = await this.executeSeriesMapping(
          mapping as MappingWithSeries,
          mappedArgs,
          verbConfig,
        );
      } else if (SKL.parallel in mapping) {
        returnValue = await this.executeParallelMapping(
          mapping as MappingWithParallel,
          mappedArgs,
          verbConfig,
        );
      } else {
        returnValue = mappedArgs;
      }
    }
    return await this.performReturnValueMappingWithFrameIfDefined(
      returnValue as JSONValue,
      mapping as MappingWithReturnValueMapping,
      verbConfig,
    );
  }

  private shouldValidate(verbConfig?: VerbConfig): boolean {
    return verbConfig?.disableValidation === undefined
      ? this.disableValidation !== true
      : !verbConfig.disableValidation;
  }

  private async executeOperationMapping(
    mapping: Mapping,
    mappedArgs: JSONObject,
    originalArgs: JSONObject,
    account: Entity,
    verbConfig?: VerbConfig,
  ): Promise<OperationResponse> {
    const operationInfo = await this.performOperationMappingWithArgs(originalArgs, mapping, verbConfig);
    const response = await this.performOperation(
      operationInfo,
      mappedArgs,
      originalArgs,
      account,
      verbConfig,
    );
    Logger.getInstance().log('Original response', JSON.stringify(response));
    return response;
  }

  private async executeSeriesMapping(
    mapping: MappingWithSeries,
    args: JSONObject,
    verbConfig?: VerbConfig,
  ): Promise<OrArray<NodeObject>> {
    const seriesVerbMappingsList = this.rdfListToArray(mapping[SKL.series]!);
    const seriesVerbArgs = { originalVerbParameters: args, previousVerbReturnValue: {}};
    return await this.executeSeriesFromList(seriesVerbMappingsList, seriesVerbArgs, verbConfig);
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
    list: Mapping[],
    args: SeriesVerbArgs,
    verbConfig?: VerbConfig,
  ): Promise<OrArray<NodeObject>> {
    const nextVerbMapping = list[0];
    const returnValue = await this.executeMapping(nextVerbMapping, args, verbConfig);
    if (list.length > 1) {
      return await this.executeSeriesFromList(
        list.slice(1),
        { ...args, previousVerbReturnValue: returnValue as JSONObject },
        verbConfig,
      );
    }
    return returnValue;
  }

  private async executeVerbMapping(
    verbMapping: Mapping,
    originalArgs: JSONObject,
    mappedArgs: JSONObject,
    verbConfig?: VerbConfig,
  ): Promise<OrArray<NodeObject>> {
    const verbId = await this.performVerbMappingWithArgs(originalArgs, verbMapping, verbConfig);
    if (verbId) {
      if (verbId === SKL_ENGINE.update) {
        await this.updateEntityFromVerbArgs(mappedArgs);
        return {};
      }
      if (verbId === SKL_ENGINE.save) {
        return await this.saveEntityOrEntitiesFromVerbArgs(mappedArgs);
      }
      if (verbId === SKL_ENGINE.destroy) {
        return await this.destroyEntityOrEntitiesFromVerbArgs(mappedArgs);
      }
      if (verbId === SKL_ENGINE.findAll) {
        return await this.findAll(mappedArgs);
      }
      if (verbId === SKL_ENGINE.find) {
        return await this.find(mappedArgs);
      }
      if (verbId === SKL_ENGINE.count) {
        return await this.countAndWrapValueFromVerbArgs(mappedArgs);
      }
      if (verbId === SKL_ENGINE.exists) {
        return await this.existsAndWrapValueFromVerbArgs(mappedArgs);
      }
      return await this.findAndExecuteVerb(verbId, mappedArgs, verbConfig);
    }
    return {};
  }

  private async addPreProcessingMappingToArgs(
    verbMapping: Mapping,
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

  

  private replaceTypeAndId(entity: Record<string, any>): Record<string, any> {
    if (typeof entity !== 'object') {
      throw new Error('Entity is not an object');
    }
    const clonedEntity = structuredClone(entity);
    if (clonedEntity[SKLSO_PROPERTY.type]) {
        clonedEntity['@type'] = clonedEntity[SKLSO_PROPERTY.type];
    }
    if (clonedEntity[SKLSO_PROPERTY.identifier]) {
        clonedEntity['@id'] = SKLSO_DATA_NAMESPACE + clonedEntity[SKLSO_PROPERTY.identifier];
    }
    return clonedEntity;
  }

  private async updateEntityFromVerbArgs(args: Record<string, any>): Promise<void> {
    let ids = args.id ?? args.ids;
    if (!Array.isArray(ids)) {
      ids = [ids];
    }
    ids = ids.map((id: string) => `${SKLSO_DATA_NAMESPACE}${id}`);
    await this.update(ids, args.attributes);
  }

  private async saveEntityOrEntitiesFromVerbArgs(args: Record<string, any>): Promise<OrArray<Entity>> {
    
    if (args.entity && typeof args.entity === 'object') {
        args.entity = this.replaceTypeAndId(args.entity);
    }
    if (args.entities && Array.isArray(args.entities)) {
        args.entities = args.entities.map(this.replaceTypeAndId);
    }
    return await this.save(args.entity ?? args.entities);
  }

  private async destroyEntityOrEntitiesFromVerbArgs(args: Record<string, any>): Promise<OrArray<Entity>> {
    if (args.entity && typeof args.entity === 'object') {
      args.entity = this.replaceTypeAndId(args.entity);
    }
    if (args.entities && Array.isArray(args.entities)) {
      args.entities = args.entities.map(this.replaceTypeAndId);
    }
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

  private async executeParallelMapping(
    mapping: MappingWithParallel,
    args: JSONObject,
    verbConfig?: VerbConfig,
  ): Promise<NodeObject[]> {
    const parallelVerbMappings = ensureArray(mapping[SKL.parallel] as unknown as OrArray<VerbMapping>);
    const nestedReturnValues = await Promise.all<Promise<OrArray<NodeObject>>>(
      parallelVerbMappings.map((verbMapping): Promise<OrArray<NodeObject>> =>
        this.executeMapping(verbMapping, args, verbConfig)),
    );
    return nestedReturnValues.flat();
  }

  private async findVerbIntegrationMapping(verbId: string, integrationId: string): Promise<VerbMapping | undefined> {
    return (await this.findByIfExists({
      type: SKL.VerbIntegrationMapping,
      [SKL.verb]: verbId,
      [SKL.integration]: integrationId,
    })) as VerbMapping;
  }

  private async performOperationMappingWithArgs(
    args: JSONValue,
    mapping: Mapping,
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
    verbConfig?: VerbConfig,
    securityCredentials?: Entity,
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
        verbConfig
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

  private async performReturnValueMappingWithFrameIfDefined(
    returnValue: JSONValue,
    mapping: MappingWithReturnValueMapping,
    verbConfig?: VerbConfig,
  ): Promise<NodeObject> {
    if (SKL.returnValueMapping in mapping) {
      return await this.performMapping(
        returnValue,
        mapping[SKL.returnValueMapping],
        getValueIfDefined<JSONObject>(mapping[SKL.returnValueFrame]),
        verbConfig,
      );
    }
    return returnValue as NodeObject;
  }

  private async performParameterMappingOnArgsIfDefined(
    args: JSONObject,
    mapping: Partial<MappingWithParameterMapping> | Partial<MappingWithParameterReference>,
    verbConfig?: VerbConfig,
    convertToJsonDeep = false,
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

  private async findgetOpenApiRuntimeAuthorizationVerbIfDefined(): Promise<Verb | undefined> {
    return (await this.findByIfExists({
      type: SKL.Verb,
      [RDFS.label]: 'getOpenApiRuntimeAuthorization',
    })) as Verb;
  }

  private async getRuntimeCredentialsWithSecurityCredentials(securityCredentials: Entity, integrationId: string, openApiOperationInformation: OperationWithPathInfo, operationArgs: JSONObject): Promise<JSONObject> {
    const getOpenApiRuntimeAuthorizationVerb = await this.findgetOpenApiRuntimeAuthorizationVerbIfDefined();
    if (!getOpenApiRuntimeAuthorizationVerb) {
      return {};
    }
    const mapping = await this.findVerbIntegrationMapping(getOpenApiRuntimeAuthorizationVerb['@id'], integrationId);
    if (!mapping) {
      return {};
    }
    const args = {
      securityCredentials,
      openApiExecutorOperationWithPathInfo: openApiOperationInformation,
      operationArgs,
    } as JSONObject;
    const operationInfoJsonLd = await this.performParameterMappingOnArgsIfDefined(args, mapping, undefined, true);
    const headers = getValueIfDefined<JSONObject>(operationInfoJsonLd[SKL.headers]);
    return headers ?? {};
  }

  private async createOpenApiOperationExecutorWithSpec(openApiDescription: OpenApi): Promise<OpenApiOperationExecutor> {
    const executor = new OpenApiOperationExecutor();
    await executor.setOpenapiSpec(openApiDescription);
    return executor;
  }

  private async findVerbNounMapping(verbId: string, noun: string): Promise<VerbMapping> {
    return (await this.findByIfExists({
      type: SKL.VerbNounMapping,
      [SKL.verb]: verbId,
      [SKL.noun]: InversePath({
        subPath: ZeroOrMorePath({ subPath: RDFS.subClassOf as string }),
        value: noun,
      }),
    })) as VerbMapping;
  }

  private async performVerbMappingWithArgs(
    args: JSONValue,
    mapping: Mapping,
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

  private async assertVerbParamsMatchParameterSchemas(verbParams: any, verb: Verb): Promise<void> {
    let parametersSchemaObject = verb[SKL.parameters];
    if (parametersSchemaObject?.['@id'] && Object.keys(parametersSchemaObject).length === 1) {
      parametersSchemaObject = await this.findBy({ id: parametersSchemaObject['@id'] });
    }
    if (verbParams && parametersSchemaObject) {
      const verbParamsAsJsonLd = {
        '@context': getValueIfDefined<ContextDefinition>(verb[SKL.parametersContext]),
        '@type': SKL.Parameters,
        ...verbParams,
      };
      const report = await this.convertToQuadsAndValidateAgainstShape(verbParamsAsJsonLd, parametersSchemaObject);
      if (!report.conforms) {
        this.throwValidationReportError(
          report,
          `${getValueIfDefined(verb[RDFS.label])} parameters do not conform to the schema`,
        );
      }
    }
  }

  private async performOpenapiOperationWithCredentials(
    operationId: string,
    operationArgs: JSONObject,
    account: Entity,
    verbConfig?: VerbConfig,
  ): Promise<AxiosResponse> {
    const integrationId = (account[SKL.integration] as ReferenceNodeObject)['@id'];
    const openApiDescription = await this.getOpenApiDescriptionForIntegration(integrationId);
    const openApiExecutor = await this.createOpenApiOperationExecutorWithSpec(openApiDescription);
    const openApiOperationInformation = await openApiExecutor.getOperationWithPathInfoMatchingOperationId(operationId);
    const securityCredentials = await this.findSecurityCredentialsForAccountIfDefined(account['@id']);
    let runtimeAuthorization: JSONObject = {};
    if (securityCredentials) {
      const generatedRuntimeCredentials = await this.getRuntimeCredentialsWithSecurityCredentials(
        securityCredentials,
        integrationId,
        openApiOperationInformation,
        operationArgs
      );
      if (generatedRuntimeCredentials && Object.keys(generatedRuntimeCredentials).length > 0) {
        runtimeAuthorization = generatedRuntimeCredentials;
      }
    }
    const apiKey = [
      getValueIfDefined<string>(securityCredentials?.[SKL.apiKey]),
      this.getAuthorizationHeaderFromRuntimeCredentials(runtimeAuthorization),
    ].find(Boolean);
    const configuration = {
      accessToken: getValueIfDefined<string>(securityCredentials?.[SKL.accessToken]),
      bearerToken: getValueIfDefined<string>(securityCredentials?.[SKL.bearerToken]),
      apiKey,
      basePath: getValueIfDefined<string>(account[SKL.overrideBasePath]),
      username: getValueIfDefined<string>(securityCredentials?.[SKL.clientId]),
      password: getValueIfDefined<string>(securityCredentials?.[SKL.clientSecret]),
    };
    let response;
    let executeOperationOptions: AxiosRequestConfig| undefined;
    try {
      const additionalHeaders = this.getHeadersFromRuntimeCredentials(runtimeAuthorization) as any;
      if (
        additionalHeaders &&
        typeof additionalHeaders === 'object' &&
        !Array.isArray(additionalHeaders) &&
        Object.keys(additionalHeaders).length > 0
      ) {
        executeOperationOptions = { headers: additionalHeaders };
      }
      if (this.ifVerbStreaming(verbConfig)) {
        executeOperationOptions = {
          ...executeOperationOptions,
          responseType: 'stream',
        };
      }
      response = await openApiExecutor.executeOperation(operationId, configuration, operationArgs, executeOperationOptions);
    } catch (error) {
      if (axios.isAxiosError(error) && (await this.isInvalidTokenError(error, integrationId)) && securityCredentials) {
        const refreshedConfiguration = await this.refreshSecurityCredentials(
          securityCredentials,
          integrationId,
          account,
        );
        response = await openApiExecutor.executeOperation(operationId, refreshedConfiguration, operationArgs, executeOperationOptions);
      } else {
        throw error;
      }
    }
    return response;
  }

  private getHeadersFromRuntimeCredentials(runtimeCredentials: JSONObject): JSONObject {
    let returnValue: JSONObject = {};
    if (
      runtimeCredentials.headers &&
      typeof runtimeCredentials.headers === 'object' &&
      Object.keys(runtimeCredentials.headers).length > 0 &&
      !Array.isArray(runtimeCredentials.headers)
    ) {
      returnValue = runtimeCredentials.headers;
    }
    return returnValue;
  }

  private getAuthorizationHeaderFromRuntimeCredentials(runtimeCredentials: JSONObject): string | undefined {
    const headers = this.getHeadersFromRuntimeCredentials(runtimeCredentials);
    if (headers && 'Authorization' in headers) {
      const authorizationHeader = headers['Authorization'];
      if (typeof authorizationHeader === 'string') {
        return authorizationHeader;
      }
    }
    return undefined;
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
    if (!mapping) {
      throw new Error(`No mapping found for verb ${getOauthTokenVerb['@id']} and integration ${integrationId}`);
    }
    const args = {
      refreshToken: getValueIfDefined<string>(securityCredentials[SKL.refreshToken])!,
      jwtBearerOptions: getValueIfDefined<string>(securityCredentials[SKL.jwtBearerOptions])!,
    };
    const operationArgs = await this.performParameterMappingOnArgsIfDefined(args, mapping, verbConfig, true);
    const operationInfoJsonLd = await this.performOperationMappingWithArgs({}, mapping, verbConfig);
    const rawReturnValue = await this.performOperation(
      operationInfoJsonLd,
      operationArgs,
      args,
      account,
      verbConfig,
      securityCredentials,
    );
    const mappedReturnValue = await this.performReturnValueMappingWithFrameIfDefined(
      rawReturnValue,
      mapping as MappingWithReturnValueMapping,
      verbConfig,
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
        } else if (returnValue['@type']) {
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

  private ifVerbStreaming(verbConfig?: VerbConfig) {
    return Boolean(verbConfig && 'stream' in verbConfig && verbConfig.stream);
  }
}
