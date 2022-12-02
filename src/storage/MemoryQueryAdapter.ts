/* eslint-disable unicorn/expiring-todo-comments */
import type { ReferenceNodeObject } from '@comake/rmlmapper-js';
import type { ValueObject } from 'jsonld';
import type { Entity, EntityFieldValue, PossibleArrayFieldValues } from '../util/Types';
import { ensureArray } from '../util/Util';
import { RDFS } from '../util/Vocabularies';
import type { QueryAdapter, FindOneOptions, FindAllOptions, FindOptionsWhere } from './QueryAdapter';

/**
 * A {@link QueryAdapter} that stores data in memory.
 */
export class MemoryQueryAdapter implements QueryAdapter {
  private readonly schemas: Record<string, Entity> = {};

  public constructor(schemas: Entity[]) {
    for (const schema of schemas) {
      this.schemas[schema['@id']] = schema;
    }
  }

  public async find(options?: FindOneOptions): Promise<Entity | null> {
    // TODO: add support for select, relations, order
    if (options?.where?.id && Object.keys(options.where).length === 1) {
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
    // TODO: add support for select, relations, order, limit, and offset
    if (options?.where?.id && Object.keys(options.where).length === 1) {
      const schema = this.schemas[options.where.id];
      return schema ? [ schema ] : [];
    }

    if (options?.where) {
      const results = [];
      for (const entity of Object.values(this.schemas)) {
        const matches = await this.entityMatchesQuery(entity, options.where);
        if (matches) {
          results.push(entity);
        }
      }
      return results;
    }
    return Object.values(this.schemas);
  }

  public async findAllBy(where: FindOptionsWhere): Promise<Entity[]> {
    return this.findAll({ where });
  }

  private async entityMatchesQuery(schema: Entity, where: FindOptionsWhere): Promise<boolean> {
    for (const [ fieldName, fieldValue ] of Object.entries(where)) {
      const matches = await this.entityMatchesField(schema, fieldName, fieldValue!);
      if (!matches) {
        return false;
      }
    }
    return true;
  }

  private async entityMatchesField(
    entity: Entity,
    fieldName: string,
    fieldValue: boolean | number | string | FindOptionsWhere,
  ): Promise<boolean> {
    if (fieldName === 'type') {
      return this.isInstanceOf(entity, fieldValue as string);
    }
    if (fieldName === 'id') {
      fieldName = '@id';
    }
    if (fieldName in entity) {
      if (typeof fieldValue === 'object') {
        if (Array.isArray(entity[fieldName])) {
          for (const subFieldValue of (entity[fieldName] as (ReferenceNodeObject | Entity)[])) {
            const matches = await this.findOptionWhereMatchesNodeObject(fieldValue, subFieldValue);
            if (matches) {
              return true;
            }
          }
          return false;
        }
        if (typeof entity[fieldName] === 'object') {
          return await this.findOptionWhereMatchesNodeObject(
            fieldValue,
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
    return false;
  }

  private fieldValueMatchesField(
    fieldValue: boolean | number | string,
    field: EntityFieldValue,
  ): boolean {
    if (typeof field === 'object') {
      if ((field as ReferenceNodeObject)['@id']) {
        return (field as ReferenceNodeObject)['@id'] === fieldValue;
      }
      if ((field as ValueObject)['@value']) {
        return (field as ValueObject)['@value'] === fieldValue;
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

  public async save(entity: Entity): Promise<Entity>;
  public async save(entities: Entity[]): Promise<Entity[]>;
  public async save(entityOrEntities: Entity | Entity[]): Promise<Entity | Entity[]> {
    if (Array.isArray(entityOrEntities)) {
      return entityOrEntities.map((entity): Entity => this.saveEntity(entity));
    }
    return this.saveEntity(entityOrEntities);
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
