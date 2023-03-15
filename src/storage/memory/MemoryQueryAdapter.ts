/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/naming-convention */
import type { ReferenceNodeObject } from '@comake/rmlmapper-js';
import type { GraphObject } from 'jsonld';
import type { Frame } from 'jsonld/jsonld-spec';
import { toJSValueFromDataType } from '../../util/TripleUtil';
import type { Entity, EntityFieldValue, PossibleArrayFieldValues } from '../../util/Types';
import type { JSONObject, JSONArray } from '../../util/Util';
import { ensureArray } from '../../util/Util';
import { RDFS } from '../../util/Vocabularies';
import type { FindOperatorType } from '../FindOperator';
import { FindOperator } from '../FindOperator';
import type {
  FindOneOptions,
  FindAllOptions,
  FindOptionsWhere,
  FindOptionsWhereField,
  FieldPrimitiveValue,
  ValueObject,
  FindCountOptions,
} from '../FindOptionsTypes';
import type { QueryAdapter, RawQueryResult } from '../QueryAdapter';
import type { MemoryQueryAdapterOptions } from './MemoryQueryAdapterOptions';

/**
 * A {@link QueryAdapter} that stores data in memory.
 */
export class MemoryQueryAdapter implements QueryAdapter {
  private readonly schemas: Record<string, Entity> = {};
  private readonly setTimestamps: boolean;

  public constructor(options: MemoryQueryAdapterOptions) {
    if (options.schemas) {
      for (const schema of options.schemas) {
        this.schemas[schema['@id']] = schema;
      }
    }
    this.setTimestamps = options.setTimestamps ?? false;
  }

  public async executeRawQuery<T extends RawQueryResult>(query: string): Promise<T[]> {
    return [] as T[];
  }

  public async executeRawEntityQuery(query: string, frame?: Frame): Promise<GraphObject> {
    return {
      '@graph': [],
    };
  }

  public async find(options?: FindOneOptions): Promise<Entity | null> {
    if (options?.where?.id && Object.keys(options.where).length === 1 && typeof options.where.id === 'string') {
      return this.schemas[options.where.id] ?? null;
    }

    if (options?.where) {
      for (const entity of Object.values(this.schemas)) {
        const matches = await this.entityMatchesQuery(entity, options.where);
        if (matches) {
          return entity;
        }
      }
      return null;
    }
    return Object.values(this.schemas)[0] ?? null;
  }

  public async findBy(where: FindOptionsWhere): Promise<Entity | null> {
    return this.find({ where });
  }

  public async findAll(options?: FindAllOptions): Promise<Entity[]> {
    if (options?.search) {
      return [];
    }
    let results: Entity[] = [];
    if (options?.where?.id && Object.keys(options.where).length === 1 && typeof options.where.id === 'string') {
      const schema = this.schemas[options.where.id];
      if (schema) {
        results = [ schema ];
      }
    } else if (options?.where) {
      for (const entity of Object.values(this.schemas)) {
        const matches = await this.entityMatchesQuery(entity, options.where);
        if (matches) {
          results.push(entity);
        }
      }
    } else {
      results = Object.values(this.schemas);
    }
    if (options?.limit ?? options?.offset) {
      const start = options?.offset ?? 0;
      const end = options?.limit && options?.offset
        ? options.offset + options.limit
        : options?.limit ?? undefined;
      return results.slice(start, end);
    }
    return results;
  }

  public async findAllBy(where: FindOptionsWhere): Promise<Entity[]> {
    return this.findAll({ where });
  }

  private async entityMatchesQuery(entity: Entity, where: FindOptionsWhere): Promise<boolean> {
    for (const [ fieldName, fieldValue ] of Object.entries(where)) {
      const matches = await this.entityMatchesField(entity, fieldName, fieldValue!);
      if (!matches) {
        return false;
      }
    }
    return true;
  }

  private async entityMatchesField(
    entity: Entity,
    fieldName: string,
    fieldValue: FindOptionsWhereField,
  ): Promise<boolean> {
    if (FindOperator.isFindOperator(fieldValue)) {
      return await this.handleOperator(
        (fieldValue as FindOperator<string>).operator,
        {
          in: async(): Promise<boolean> => {
            const values = (fieldValue as FindOperator<FieldPrimitiveValue[]>).value as FieldPrimitiveValue[];
            for (const valueItem of values) {
              if (await this.entityMatchesField(entity, fieldName, valueItem)) {
                return true;
              }
            }
            return false;
          },
          not: async(): Promise<boolean> => {
            if (FindOperator.isFindOperator((fieldValue as FindOperator<string>).value)) {
              return !await this.entityMatchesField(entity, fieldName, (fieldValue as FindOperator<string>).value);
            }
            const valueItem = (fieldValue as FindOperator<string>).value as string;
            return !await this.entityMatchesField(entity, fieldName, valueItem);
          },
          equal: async(): Promise<boolean> => {
            const valueItem = (fieldValue as FindOperator<FieldPrimitiveValue>).value as FieldPrimitiveValue;
            return this.entityMatchesField(entity, fieldName, valueItem);
          },
          gt: async(): Promise<boolean> => false,
          gte: async(): Promise<boolean> => false,
          lt: async(): Promise<boolean> => false,
          lte: async(): Promise<boolean> => false,
          inverse: async(): Promise<boolean> => false,
          inverseRelation: async(): Promise<boolean> => false,
        },
      );
    }
    if (fieldName === 'id') {
      return entity['@id'] === fieldValue as string;
    }
    if (fieldName === 'type') {
      return this.isInstanceOf(entity, fieldValue as string);
    }
    if (Array.isArray(fieldValue)) {
      for (const valueItem of fieldValue) {
        if (!await this.entityMatchesField(entity, fieldName, valueItem)) {
          return false;
        }
      }
      return true;
    }
    if (typeof fieldValue === 'object') {
      if ('@value' in fieldValue) {
        return this.fieldValueMatchesField(
          fieldValue['@value'] as FieldPrimitiveValue | JSONObject | JSONArray,
          entity[fieldName],
        );
      }
      if (Array.isArray(entity[fieldName])) {
        for (const subFieldValue of (entity[fieldName] as (ReferenceNodeObject | Entity)[])) {
          const matches = await this.findOptionWhereMatchesNodeObject(fieldValue as FindOptionsWhere, subFieldValue);
          if (matches) {
            return true;
          }
        }
        return false;
      }
      if (typeof entity[fieldName] === 'object') {
        return await this.findOptionWhereMatchesNodeObject(
          fieldValue as FindOptionsWhere,
          entity[fieldName] as ReferenceNodeObject | Entity,
        );
      }
      return false;
    }
    if (Array.isArray(entity[fieldName])) {
      return (entity[fieldName] as PossibleArrayFieldValues[]).some((field): boolean =>
        this.fieldValueMatchesField(fieldValue, field));
    }
    return this.fieldValueMatchesField(fieldValue, entity[fieldName]);
  }

  private fieldValueMatchesField(
    fieldValue: FieldPrimitiveValue | JSONObject | JSONArray,
    field: EntityFieldValue,
  ): boolean {
    if (typeof field === 'object') {
      if ((field as ReferenceNodeObject)['@id']) {
        return (field as ReferenceNodeObject)['@id'] === fieldValue;
      }
      if ((field as ValueObject)['@value']) {
        const jsValue = toJSValueFromDataType(
          (field as any)['@value'],
          (field as any)['@type'],
        );
        return jsValue === fieldValue;
      }
    }
    return field === fieldValue;
  }

  private async findOptionWhereMatchesNodeObject(
    fieldValue: FindOptionsWhere,
    nodeObject: ReferenceNodeObject | Entity,
  ): Promise<boolean> {
    if (nodeObject['@id'] && Object.keys(nodeObject).length === 1) {
      const subEntity = await this.findBy({ id: nodeObject['@id'] });
      if (subEntity) {
        return this.entityMatchesQuery(subEntity, fieldValue);
      }
      return false;
    }
    return this.entityMatchesQuery(nodeObject as Entity, fieldValue);
  }

  private async handleOperator(
    operator: FindOperatorType,
    operatorHandlers: Record<FindOperatorType, () => Promise<boolean>>,
  ): Promise<boolean> {
    if (operator in operatorHandlers) {
      return await operatorHandlers[operator]();
    }
    throw new Error(`Unsupported operator "${operator}"`);
  }

  private isInstanceOf(entity: Entity, targetClass: string): boolean {
    const classes = this.getSubClassesOf(targetClass);
    const entityTypes = ensureArray(entity['@type']);
    return entityTypes.some((type: string): boolean => classes.includes(type));
  }

  private getSubClassesOf(targetClass: string): string[] {
    // Cache subclassesOf
    return Object.values(this.schemas).reduce((
      subClasses: string[],
      schema: Entity,
    ): string[] => {
      const subClassOf = ensureArray(schema[RDFS.subClassOf] as ReferenceNodeObject[]);
      const isSubClassOfTarget = subClassOf.some((subClass): boolean => subClass['@id'] === targetClass);
      if (isSubClassOfTarget) {
        subClasses = [
          ...subClasses,
          schema['@id'],
          ...this.getSubClassesOf(schema['@id']),
        ];
      }
      return subClasses;
    }, [ targetClass ]);
  }

  public async exists(options: FindCountOptions): Promise<boolean> {
    const res = await this.findAll(options);
    return res.length > 0;
  }

  public async count(options: FindCountOptions): Promise<number> {
    const res = await this.findAll(options);
    return res.length;
  }

  public async save(entity: Entity): Promise<Entity>;
  public async save(entities: Entity[]): Promise<Entity[]>;
  public async save(entityOrEntities: Entity | Entity[]): Promise<Entity | Entity[]> {
    if (Array.isArray(entityOrEntities)) {
      return entityOrEntities.map((entity): Entity => this.saveEntity(entity));
    }
    return this.saveEntity(entityOrEntities);
  }

  public async update(id: string, attributes: Partial<Entity>): Promise<void>;
  public async update(ids: string[], attributes: Partial<Entity>): Promise<void>;
  public async update(idOrIds: string | string[], attributes: Partial<Entity>): Promise<void> {
    // Do nothing
  }

  private saveEntity(entity: Entity): Entity {
    const savedEntity = { ...entity };
    this.schemas[entity['@id']] = savedEntity;
    return savedEntity;
  }

  public async destroy(entity: Entity): Promise<Entity>;
  public async destroy(entities: Entity[]): Promise<Entity[]>;
  public async destroy(entityOrEntities: Entity | Entity[]): Promise<Entity | Entity[]> {
    if (Array.isArray(entityOrEntities)) {
      return entityOrEntities.map((entity): Entity => this.destroyEntity(entity));
    }
    return this.destroyEntity(entityOrEntities);
  }

  public async destroyAll(): Promise<void> {
    for (const key of Object.keys(this.schemas)) {
      // eslint-disable-next-line no-prototype-builtins
      if (this.schemas.hasOwnProperty(key)) {
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        delete this.schemas[key];
      }
    }
  }

  private destroyEntity(entity: Entity): Entity {
    const existingEntity = this.schemas[entity['@id']];
    if (!existingEntity) {
      throw new Error(`Entity with id ${entity['@id']} does not exist.`);
    }
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete this.schemas[existingEntity['@id']];
    return existingEntity;
  }
}
