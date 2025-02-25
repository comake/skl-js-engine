/* eslint-disable @typescript-eslint/naming-convention */
import type {
  OpenApi,
  OpenApiClientConfiguration,
  OperationWithPathInfo,
} from '@comake/openapi-operation-executor';
import { OpenApiOperationExecutor } from '@comake/openapi-operation-executor';
import { getIdFromNodeObjectIfDefined, type ReferenceNodeObject } from '@comake/rmlmapper-js';
import axios from 'axios';
import type { AxiosError, AxiosResponse, AxiosRequestConfig } from 'axios';
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
import type { GroupByOptions, GroupByResponse } from './storage/GroupOptionTypes';
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
  MappingWithOutputsMapping,
  MappingWithInputs,
  SeriesCapabilityArgs,
  Capability,
  TriggerMapping,
  MappingWithInputsReference,
  RdfList,
  CapabilityConfig,
  JSONObject,
  CapabilityMapping,
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
import { SHACL, RDFS, XSD, RDF, SKLSO_PROPERTY, SKLSO_DATA_NAMESPACE, SKL, SKL_ENGINE_V2, SKL_V2, SKLSO_INTEGRATION, SKLSO_INTEGRATION_INTERFACE } from './util/Vocabularies';

export type CapabilityHandler = <T extends OrArray<NodeObject> = OrArray<NodeObject>>(
  params: JSONObject,
  capabilityConfig?: CapabilityConfig,
) => Promise<T>;
export type CapabilityInterface = Record<string, CapabilityHandler>;

export type MappingResponseOption<T extends boolean> = T extends true ? JSONObject : NodeObject;

export class SKLEngine {
  private readonly queryAdapter: QueryAdapter;
  private readonly functions?: Record<string, (args: any | any[]) => any>;
  private readonly inputFiles?: Record<string, string>;
  private readonly globalCallbacks?: Callbacks;
  private readonly disableValidation?: boolean;
  public readonly capability: CapabilityInterface;
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
    const getCapabilityHandler = (getTarget: CapabilityInterface, property: string): CapabilityHandler =>
      async<T extends OrArray<NodeObject> = OrArray<NodeObject>>(
        capabilityArgs: JSONObject,
        capabilityConfig?: CapabilityConfig,
      ): Promise<T> =>
        this.executeCapabilityByName(property, capabilityArgs, capabilityConfig) as Promise<T>;
    this.capability = new Proxy({} as CapabilityInterface, { get: getCapabilityHandler });
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
    capabilityConfig?: CapabilityConfig,
  ): Promise<NodeObject> {
    const functions = {
      ...this.functions,
      ...capabilityConfig?.functions,
    };
    const mapper = new Mapper({ functions });
    return await mapper.apply(args, mapping, frame ?? {});
  }

  public async executeTrigger(
    integration: string,
    payload: any,
  ): Promise<void> {
    const triggerToCapabilityMapping = await this.findTriggerCapabilityMapping(integration);
    const capabilityArgs = await this.performParameterMappingOnArgsIfDefined(payload, triggerToCapabilityMapping);
    const capabilityId = await this.performCapabilityMappingWithArgs(payload, triggerToCapabilityMapping);
    if (capabilityId) {
      const mappedCapability = (await this.findBy({ id: capabilityId })) as Capability;
      await this.executeCapability(mappedCapability, capabilityArgs);
    }
  }

  private async findTriggerCapabilityMapping(integration: string): Promise<TriggerMapping> {
    const triggerCapabilityMappingNew = (await this.findBy(
      {
        type: SKL.CapabilityMapping,
        [SKL.capability]: integration,
        [SKL.capabilityType]: SKL.TriggerCapabilityMapping,
      },
      `Failed to find a Trigger Capability mapping for integration ${integration}`,
    )) as TriggerMapping;
    if (triggerCapabilityMappingNew) {
      return triggerCapabilityMappingNew;
    }
    throw new Error(`Failed to find a Trigger Capability mapping for integration ${integration}`);
  }

  private async executeCapabilityByName(
    capabilityName: string,
    capabilityArgs: JSONObject,
    capabilityConfig?: CapabilityConfig,
  ): Promise<OrArray<NodeObject>> {
    const capability = await this.findCapabilityWithName(capabilityName);
    return await this.executeCapability(capability, capabilityArgs, capabilityConfig);
  }

  private async findCapabilityWithName(capabilityName: string): Promise<Capability> {
    return (await this.findBy(
      { type: SKL.Capability, [SKL_V2.label]: capabilityName },
      `Failed to find the capability ${capabilityName} in the schema.`,
    )) as Capability;
  }

  private async executeCapability(capability: Capability, capabilityArgs: JSONObject, capabilityConfig?: CapabilityConfig): Promise<OrArray<NodeObject>> {
    this.globalCallbacks?.onCapabilityStart?.(capability['@id'], capabilityArgs);
    if (capabilityConfig?.callbacks?.onCapabilityStart) {
      Logger.getInstance().log('Capability arguments', capabilityArgs);
      capabilityConfig.callbacks.onCapabilityStart(capability['@id'], capabilityArgs);
    }
    const { mapping, account } = await this.findMappingForCapabilityContextually(capability['@id'], capabilityArgs);
    Logger.getInstance().log('Mapping', JSON.stringify(mapping));
    const shouldValidate = this.shouldValidate(capabilityConfig);
    if (shouldValidate) {
      await this.assertCapabilityParamsMatchParameterSchemas(capabilityArgs, capability);
    }
    const capabilityReturnValue = await this.executeMapping(mapping, capabilityArgs, capabilityConfig, account);
    if (shouldValidate) {
      await this.assertCapabilityReturnValueMatchesReturnTypeSchema(capabilityReturnValue, capability);
    }
    this.globalCallbacks?.onCapabilityEnd?.(capability['@id'], capabilityReturnValue);
    if (capabilityConfig?.callbacks?.onCapabilityEnd) {
      capabilityConfig.callbacks.onCapabilityEnd(capability['@id'], capabilityReturnValue);
    }
    return capabilityReturnValue;
  }

  private async findMappingForCapabilityContextually(
    capabilityId: string,
    args: JSONObject,
  ): Promise<{ mapping: CapabilityMapping; account?: Entity }> {
    if (args.mapping) {
      const mapping = await this.findByIfExists({ id: args.mapping as string });
      if (!mapping) {
        throw new Error(`Mapping ${args.mapping as string} not found.`);
      }
      return { mapping: mapping as CapabilityMapping };
    }
    if (args.noun) {
      const mapping = await this.findCapabilityNounMapping(capabilityId, args.noun as string);
      if (mapping) {
        return { mapping };
      }
    }
    if (args.account) {
      const account = await this.findBy({ id: args.account as string });
      const integratedProductId = (account[SKLSO_INTEGRATION.integration] as ReferenceNodeObject)['@id'];
      const mapping = await this.findCapabilityIntegrationMapping(capabilityId, integratedProductId);
      if (mapping) {
        return { mapping, account };
      }
    }

    const mappings = await this.findAllBy({
      type: SKL.Mapping,
      [SKL.capability]: capabilityId,
      [SKLSO_INTEGRATION.integration]: Not(Exists()),
      [SKL.object]: Not(Exists()),
    });
    if (mappings.length === 1) {
      return { mapping: mappings[0] as CapabilityMapping };
    }
    if (mappings.length > 1) {
      throw new Error('Multiple mappings found for capability, please specify one.');
    }
    if (args.noun) {
      throw new Error(`Mapping between noun ${args.noun as string} and capability ${capabilityId} not found.`);
    }
    if (args.account) {
      throw new Error(`Mapping between account ${args.account as string} and capability ${capabilityId} not found.`);
    }
    throw new Error(`No mapping found.`);
  }

  private async executeMapping(
    mapping: Mapping,
    args: JSONObject,
    capabilityConfig?: CapabilityConfig,
    account?: Entity,
  ): Promise<OrArray<NodeObject>> {
    args = await this.addPreProcessingMappingToArgs(mapping, args, capabilityConfig);
    let returnValue: OrArray<NodeObject>;
    if (SKL.capabilityId in mapping || SKL.capabilityMapping in mapping) {
      const capabilityId = await this.performCapabilityMappingWithArgs(args, mapping, capabilityConfig);
      const mappedArgs = await this.performParameterMappingOnArgsIfDefined(
        { ...args, capabilityId },
        mapping as MappingWithInputs,
        capabilityConfig,
      );
      Logger.getInstance().log('Mapped args', mappedArgs);
      returnValue = await this.executeCapabilityMapping(mapping, args, mappedArgs, capabilityConfig);
    } else {
      const mappedArgs = await this.performParameterMappingOnArgsIfDefined(
        args,
        mapping as MappingWithInputs,
        capabilityConfig,
      );
      Logger.getInstance().log('Mapped args', mappedArgs);
      if (SKL.operationId in mapping || SKL.operationMapping in mapping) {
        returnValue = await this.executeOperationMapping(
          mapping,
          mappedArgs,
          args,
          account!,
          capabilityConfig,
        ) as NodeObject;
      } else if (SKL.series in mapping) {
        returnValue = await this.executeSeriesMapping(
          mapping as MappingWithSeries,
          mappedArgs,
          capabilityConfig,
        );
      } else if (SKL.parallel in mapping) {
        returnValue = await this.executeParallelMapping(
          mapping as MappingWithParallel,
          mappedArgs,
          capabilityConfig,
        );
      } else {
        returnValue = mappedArgs;
      }
    }
    return await this.performReturnValueMappingWithFrameIfDefined(
      returnValue as JSONValue,
      mapping as MappingWithOutputsMapping,
      capabilityConfig,
    );
  }

  private shouldValidate(capabilityConfig?: CapabilityConfig): boolean {
    return capabilityConfig?.disableValidation === undefined
      ? this.disableValidation !== true
      : !capabilityConfig.disableValidation;
  }

  private async executeOperationMapping(
    mapping: Mapping,
    mappedArgs: JSONObject,
    originalArgs: JSONObject,
    account: Entity,
    capabilityConfig?: CapabilityConfig,
  ): Promise<OperationResponse> {
    const operationInfo = await this.performOperationMappingWithArgs(originalArgs, mapping, capabilityConfig);
    const response = await this.performOperation(
      operationInfo,
      mappedArgs,
      originalArgs,
      account,
      capabilityConfig,
    );
    Logger.getInstance().log('Original response', JSON.stringify(response));
    return response;
  }

  private async executeSeriesMapping(
    mapping: MappingWithSeries,
    args: JSONObject,
    capabilityConfig?: CapabilityConfig,
  ): Promise<OrArray<NodeObject>> {
    const seriesCapabilityMappingsList = this.rdfListToArray(mapping[SKL.series]!);
    const seriesCapabilityArgs = { originalCapabilityParameters: args, previousCapabilityReturnValue: {}};
    return await this.executeSeriesFromList(seriesCapabilityMappingsList, seriesCapabilityArgs, capabilityConfig);
  }

  private rdfListToArray(list: { '@list': CapabilityMapping[] } | RdfList<CapabilityMapping>): CapabilityMapping[] {
    if (!('@list' in list)) {
      return [
        list[RDF.first],
        ...getIdFromNodeObjectIfDefined(list[RDF.rest] as ReferenceNodeObject) === RDF.nil
          ? []
          : this.rdfListToArray(list[RDF.rest] as RdfList<CapabilityMapping>),
      ];
    }
    return list['@list'];
  }

  private async executeSeriesFromList(
    list: Mapping[],
    args: SeriesCapabilityArgs,
    capabilityConfig?: CapabilityConfig,
  ): Promise<OrArray<NodeObject>> {
    const nextCapabilityMapping = list[0];
    const returnValue = await this.executeMapping(nextCapabilityMapping, args, capabilityConfig);
    if (list.length > 1) {
      return await this.executeSeriesFromList(
        list.slice(1),
        { ...args, previousCapabilityReturnValue: returnValue as JSONObject },
        capabilityConfig,
      );
    }
    return returnValue;
  }

  private async executeCapabilityMapping(
    capabilityMapping: Mapping,
    originalArgs: JSONObject,
    mappedArgs: JSONObject,
    capabilityConfig?: CapabilityConfig,
  ): Promise<OrArray<NodeObject>> {
    const capabilityId = await this.performCapabilityMappingWithArgs(originalArgs, capabilityMapping, capabilityConfig);
    if (capabilityId) {
      if (capabilityId === SKL_ENGINE_V2.update) {
        await this.updateEntityFromcapabilityArgs(mappedArgs);
        return {};
      }
      if (capabilityId === SKL_ENGINE_V2.save) {
        return await this.saveEntityOrEntitiesFromcapabilityArgs(mappedArgs);
      }
      if (capabilityId === SKL_ENGINE_V2.destroy) {
        return await this.destroyEntityOrEntitiesFromcapabilityArgs(mappedArgs);
      }
      if (capabilityId === SKL_ENGINE_V2.findAll) {
        return await this.findAll(mappedArgs);
      }
      if (capabilityId === SKL_ENGINE_V2.find) {
        return await this.find(mappedArgs);
      }
      if (capabilityId === SKL_ENGINE_V2.count) {
        return await this.countAndWrapValueFromcapabilityArgs(mappedArgs);
      }
      if (capabilityId === SKL_ENGINE_V2.exists) {
        return await this.existsAndWrapValueFromcapabilityArgs(mappedArgs);
      }
      return await this.findAndExecuteCapability(capabilityId, mappedArgs, capabilityConfig);
    }
    return {};
  }

  private async addPreProcessingMappingToArgs(
    capabilityMapping: Mapping,
    args: JSONObject,
    capabilityConfig?: CapabilityConfig,
  ): Promise<JSONObject> {
    if (SKL.preProcessingMapping in capabilityMapping) {
      const preMappingArgs = await this.performMapping(
        args,
        capabilityMapping[SKL.preProcessingMapping] as NodeObject,
        getValueIfDefined(capabilityMapping[SKL.preProcessingMappingFrame]),
        capabilityConfig,
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

  private async updateEntityFromcapabilityArgs(args: Record<string, any>): Promise<void> {
    let ids = args.id ?? args.ids;
    if (!Array.isArray(ids)) {
      ids = [ ids ];
    }
    ids = ids.map((id: string) => `${SKLSO_DATA_NAMESPACE}${id}`);
    await this.update(ids, args.attributes);
  }

  private async saveEntityOrEntitiesFromcapabilityArgs(args: Record<string, any>): Promise<OrArray<Entity>> {
    if (args.entity && typeof args.entity === 'object') {
      args.entity = this.replaceTypeAndId(args.entity);
    }
    if (args.entities && Array.isArray(args.entities)) {
      args.entities = args.entities.map(this.replaceTypeAndId);
    }
    return await this.save(args.entity ?? args.entities);
  }

  private async destroyEntityOrEntitiesFromcapabilityArgs(args: Record<string, any>): Promise<OrArray<Entity>> {
    if (args.entity && typeof args.entity === 'object') {
      args.entity = this.replaceTypeAndId(args.entity);
    }
    if (args.entities && Array.isArray(args.entities)) {
      args.entities = args.entities.map(this.replaceTypeAndId);
    }
    return await this.destroy(args.entity ?? args.entities);
  }

  private async countAndWrapValueFromcapabilityArgs(args: Record<string, any>): Promise<NodeObject> {
    const count = await this.count(args);
    return {
      [SKL_ENGINE_V2.countResult]: {
        '@value': count,
        '@type': XSD.integer,
      },
    };
  }

  private async existsAndWrapValueFromcapabilityArgs(args: Record<string, any>): Promise<NodeObject> {
    const exists = await this.exists(args);
    return {
      [SKL_ENGINE_V2.existsResult]: {
        '@value': exists,
        '@type': XSD.boolean,
      },
    };
  }

  private async findAndExecuteCapability(
    capabilityId: string,
    args: Record<string, any>,
    capabilityConfig?: CapabilityConfig,
  ): Promise<OrArray<NodeObject>> {
    const capability = (await this.findBy({ id: capabilityId })) as Capability;
    return await this.executeCapability(capability, args, capabilityConfig);
  }

  private async executeParallelMapping(
    mapping: MappingWithParallel,
    args: JSONObject,
    capabilityConfig?: CapabilityConfig,
  ): Promise<NodeObject[]> {
    const parallelCapabilityMappings = ensureArray(mapping[SKL.parallel] as unknown as OrArray<CapabilityMapping>);
    const nestedReturnValues = await Promise.all<Promise<OrArray<NodeObject>>>(
      parallelCapabilityMappings.map((capabilityMapping): Promise<OrArray<NodeObject>> =>
        this.executeMapping(capabilityMapping, args, capabilityConfig)),
    );
    return nestedReturnValues.flat();
  }

  private async findCapabilityIntegrationMapping(capabilityId: string, integratedProductId: string): Promise<CapabilityMapping | undefined> {
    return (await this.findByIfExists({
      type: SKL.CapabilityMapping,
      [SKL.capability]: capabilityId,
      [SKLSO_INTEGRATION.integration]: integratedProductId,
    })) as CapabilityMapping;
  }

  private async performOperationMappingWithArgs(
    args: JSONValue,
    mapping: Mapping,
    capabilityConfig?: CapabilityConfig,
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
      capabilityConfig,
    );
  }

  private async performOperation(
    operationInfo: NodeObject,
    operationArgs: JSONObject,
    originalArgs: JSONObject,
    account: Entity,
    capabilityConfig?: CapabilityConfig,
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
        capabilityConfig,
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
      originalCapabilityParameters: originalArgs,
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
    mapping: MappingWithOutputsMapping,
    capabilityConfig?: CapabilityConfig,
  ): Promise<NodeObject> {
    if (SKL.outputsMapping in mapping) {
      return await this.performMapping(
        returnValue,
        mapping[SKL.outputsMapping],
        getValueIfDefined<JSONObject>(mapping[SKL.outputsMappingFrame]),
        capabilityConfig,
      );
    }
    return returnValue as NodeObject;
  }

  private async performParameterMappingOnArgsIfDefined(
    args: JSONObject,
    mapping: Partial<MappingWithInputs> | Partial<MappingWithInputsReference>,
    capabilityConfig?: CapabilityConfig,
    convertToJsonDeep = false,
  ): Promise<Record<string, any>> {
    if (SKL.inputsReference in mapping) {
      const reference = getValueIfDefined<string>(mapping[SKL.inputsReference])!;
      return this.getDataAtReference(reference, args);
    }

    if (SKL.inputsMappingRef in mapping) {
      const reference = getValueIfDefined<string>(mapping[SKL.inputsMappingRef])!;
      const referencedMapping = this.getDataAtReference(reference, args);

      // Handle inputsMappingFrameRef if present
      let frame;
      if (SKL.inputsMappingFrameRef in mapping) {
        const frameReference = getValueIfDefined<string>(mapping[SKL.inputsMappingFrameRef])!;
        frame = this.getDataAtReference(frameReference, args);
      } else {
        // Use direct frame if provided
        frame = getValueIfDefined(mapping[SKL.inputsMappingFrame]);
      }

      // Perform mapping with the referenced mapping and frame
      const mappedData = await this.performMapping(
        args,
        referencedMapping,
        frame,
        capabilityConfig,
      );
      return toJSON(mappedData, convertToJsonDeep);
    }

    if (SKL.inputsMapping in mapping) {
      const mappedData = await this.performMapping(
        args,
        (mapping as MappingWithInputs)[SKL.inputsMapping]!,
        getValueIfDefined(mapping[SKL.inputsMappingFrame]),
        capabilityConfig,
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
    let result = isArrayOfLengthOne ? results[0] : results;
    if (result && typeof result === 'object' && '@value' in result) {
      result = result['@value'];
    }
    return result;
  }

  private async getOpenApiDescriptionForIntegratedProduct(integratedProductId: string): Promise<OpenApi> {
    const openApiDescriptionSchema = await this.findBy({
      type: SKLSO_INTEGRATION_INTERFACE.RESTfulApi,
      [SKL.type]: SKL.OpenAPI,
      [SKLSO_INTEGRATION.integration]: integratedProductId,
    });
    return getValueIfDefined<OpenApi>(openApiDescriptionSchema[SKL_V2.declarativeApiDescription])!;
  }

  private async findSecurityCredentialsForAccountIfDefined(accountId: string): Promise<Entity | undefined> {
    return await this.findByIfExists({
      type: SKLSO_INTEGRATION.AuthenticationCredential,
      [SKLSO_INTEGRATION.account]: accountId,
    });
  }

  private async findgetOpenApiRuntimeAuthorizationCapabilityIfDefined(): Promise<Capability | undefined> {
    return (await this.findByIfExists({
      type: SKL.Capability,
      [SKL_V2.label]: 'getOpenApiRuntimeAuthorization',
    })) as Capability;
  }

  private async getRuntimeCredentialsWithSecurityCredentials(securityCredentials: Entity, integrationId: string, openApiOperationInformation: OperationWithPathInfo, operationArgs: JSONObject): Promise<JSONObject> {
    const getOpenApiRuntimeAuthorizationCapability = await this.findgetOpenApiRuntimeAuthorizationCapabilityIfDefined();
    if (!getOpenApiRuntimeAuthorizationCapability) {
      return {};
    }
    const mapping = await this.findCapabilityIntegrationMapping(getOpenApiRuntimeAuthorizationCapability['@id'], integrationId);
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

  private async findCapabilityNounMapping(capabilityId: string, object: string): Promise<CapabilityMapping> {
    return (await this.findByIfExists({
      type: SKL.CapabilityMapping,
      [SKL.capability]: capabilityId,
      [SKL.object]: InversePath({
        subPath: ZeroOrMorePath({ subPath: RDFS.subClassOf as string }),
        value: object,
      }),
    })) as CapabilityMapping;
  }

  private async performCapabilityMappingWithArgs(
    args: JSONValue,
    mapping: Mapping,
    capabilityConfig?: CapabilityConfig,
  ): Promise<string | undefined> {
    if (mapping[SKL.capabilityId]) {
      return getValueIfDefined<string>(mapping[SKL.capabilityId])!;
    }
    const capabilityInfoJsonLd = await this.performMapping(
      args,
      mapping[SKL.capabilityMapping] as NodeObject,
      undefined,
      capabilityConfig,
    );
    return getValueIfDefined<string>(capabilityInfoJsonLd[SKL.capabilityId])!;
  }

  private async assertCapabilityParamsMatchParameterSchemas(capabilityParams: any, capability: Capability): Promise<void> {
    let parametersSchemaObject = capability[SKL.inputs];
    if (parametersSchemaObject?.['@id'] && Object.keys(parametersSchemaObject).length === 1) {
      parametersSchemaObject = await this.findBy({ id: parametersSchemaObject['@id'] });
    }
    if (capabilityParams && parametersSchemaObject) {
      const capabilityParamsAsJsonLd = {
        '@context': getValueIfDefined<ContextDefinition>(capability[SKL.inputsContext]),
        '@type': SKL.Inputs,
        ...capabilityParams,
      };
      const report = await this.convertToQuadsAndValidateAgainstShape(capabilityParamsAsJsonLd, parametersSchemaObject);
      if (!report.conforms) {
        this.throwValidationReportError(
          report,
          `${getValueIfDefined(capability[SKL_V2.label])} parameters do not conform to the schema`,
        );
      }
    }
  }

  private async performOpenapiOperationWithCredentials(
    operationId: string,
    operationArgs: JSONObject,
    account: Entity,
  ): Promise<AxiosResponse> {
    const integratedProductId = (account[SKLSO_INTEGRATION.integration] as ReferenceNodeObject)['@id'];
    const openApiDescription = await this.getOpenApiDescriptionForIntegratedProduct(integratedProductId);
    const openApiExecutor = await this.createOpenApiOperationExecutorWithSpec(openApiDescription);
    const openApiOperationInformation = await openApiExecutor.getOperationWithPathInfoMatchingOperationId(operationId);
    const securityCredentials = await this.findSecurityCredentialsForAccountIfDefined(account['@id']);
    let runtimeAuthorization: JSONObject = {};
    if (securityCredentials) {
      const generatedRuntimeCredentials = await this.getRuntimeCredentialsWithSecurityCredentials(
        securityCredentials,
        integratedProductId,
        openApiOperationInformation,
        operationArgs,
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
    try {
      const additionalHeaders = this.getHeadersFromRuntimeCredentials(runtimeAuthorization) as any;
      let executeOperationOptions: AxiosRequestConfig | undefined;
      if (
        additionalHeaders &&
        typeof additionalHeaders === 'object' &&
        !Array.isArray(additionalHeaders) &&
        Object.keys(additionalHeaders).length > 0
      ) {
        executeOperationOptions = { headers: additionalHeaders };
      }
      response = await openApiExecutor.executeOperation(operationId, configuration, operationArgs, executeOperationOptions);
    } catch (error) {
      if (axios.isAxiosError(error) && await this.isInvalidTokenError(error, integratedProductId) && securityCredentials) {
        const refreshedConfiguration = await this.refreshSecurityCredentials(
          securityCredentials,
          integratedProductId,
          account,
        );
        response = await openApiExecutor.executeOperation(operationId, refreshedConfiguration, operationArgs);
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
      const authorizationHeader = headers.Authorization;
      if (typeof authorizationHeader === 'string') {
        return authorizationHeader;
      }
    }
    return undefined;
  }

  private async isInvalidTokenError(error: AxiosError, integratedProductId: string): Promise<boolean> {
    const integratedProduct = await this.findBy({ id: integratedProductId });
    const errorMatcher = integratedProduct[SKL.invalidTokenErrorMatcher] as NodeObject;
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
    capabilityConfig?: CapabilityConfig,
  ): Promise<OpenApiClientConfiguration> {
    const getOauthTokenCapability = (await this.findBy({ type: SKL.Capability, [SKL_V2.label]: 'getOauthTokens' })) as Capability;
    const mapping = await this.findCapabilityIntegrationMapping(getOauthTokenCapability['@id'], integrationId);
    if (!mapping) {
      throw new Error(`No mapping found for capability ${getOauthTokenCapability['@id']} and integration ${integrationId}`);
    }
    const args = {
      refreshToken: getValueIfDefined<string>(securityCredentials[SKL.refreshToken])!,
      jwtBearerOptions: getValueIfDefined<string>(securityCredentials[SKL.jwtBearerOptions])!,
    };
    const operationArgs = await this.performParameterMappingOnArgsIfDefined(args, mapping, capabilityConfig, true);
    const operationInfoJsonLd = await this.performOperationMappingWithArgs({}, mapping, capabilityConfig);
    const rawReturnValue = await this.performOperation(
      operationInfoJsonLd,
      operationArgs,
      args,
      account,
      capabilityConfig,
      securityCredentials,
    );
    const mappedReturnValue = await this.performReturnValueMappingWithFrameIfDefined(
      rawReturnValue,
      mapping as MappingWithOutputsMapping,
      capabilityConfig,
    );
    await this.assertCapabilityReturnValueMatchesReturnTypeSchema(mappedReturnValue, getOauthTokenCapability);
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

  private async assertCapabilityReturnValueMatchesReturnTypeSchema(
    returnValue: OrArray<NodeObject>,
    capability: Capability,
  ): Promise<void> {
    let returnTypeSchemaObject = capability[SKL.outputs];
    if (returnTypeSchemaObject?.['@id'] && Object.keys(returnTypeSchemaObject).length === 1) {
      returnTypeSchemaObject = await this.findBy({ id: returnTypeSchemaObject['@id'] });
    }
    let report: ValidationReport | undefined;
    if (returnValue && returnTypeSchemaObject) {
      if (Array.isArray(returnValue)) {
        if (returnValue.some((valueItem): boolean => '@id' in valueItem)) {
          returnTypeSchemaObject[SHACL.targetNode] = returnValue
            .reduce((nodes: ReferenceNodeObject[], outputItem): ReferenceNodeObject[] => {
              if (outputItem['@id']) {
                nodes.push({ '@id': outputItem['@id'] });
              }
              return nodes;
            }, []);
        } else {
          const targetClasses = returnValue
            .reduce((nodes: ReferenceNodeObject[], outputItem): ReferenceNodeObject[] => {
              if (outputItem['@type']) {
                const type = Array.isArray(outputItem['@type'])
                  ? outputItem['@type'][0]
                  : outputItem['@type'];
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
    const integratedProductId = (account[SKL.integratedProduct] as ReferenceNodeObject)['@id'];
    const openApiDescription = await this.getOpenApiDescriptionForIntegratedProduct(integratedProductId);
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

  private async getDataFromDataSource(dataSourceId: string, capabilityConfig?: CapabilityConfig): Promise<OperationResponse> {
    const dataSource = await this.findBy({ id: dataSourceId });
    if (dataSource['@type'] === SKL.JsonDataSource) {
      const data = this.getDataFromJsonDataSource(dataSource, capabilityConfig);
      return { data, operationParameters: {}};
    }
    throw new Error(`DataSource type ${dataSource['@type']} is not supported.`);
  }

  private getDataFromJsonDataSource(dataSource: NodeObject, capabilityConfig?: CapabilityConfig): JSONObject {
    if (dataSource[SKL.source]) {
      const sourceValue = getValueIfDefined<string>(dataSource[SKL.source])!;
      return this.getJsonDataFromSource(sourceValue, capabilityConfig);
    }
    return getValueIfDefined<JSONObject>(dataSource[SKL.data])!;
  }

  private getJsonDataFromSource(source: string, capabilityConfig?: CapabilityConfig): JSONObject {
    const inputFiles = {
      ...this.inputFiles,
      ...capabilityConfig?.inputFiles,
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
