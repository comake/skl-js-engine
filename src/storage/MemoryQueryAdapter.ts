/* eslint-disable capitalized-comments */
/* eslint-disable unicorn/expiring-todo-comments */
import type { ReferenceNodeObject } from '@comake/rmlmapper-js';
import type { ValueObject } from 'jsonld';
import type { Entity, EntityFieldValue, OrArray, PossibleArrayFieldValues } from '../util/Types';
import { ensureArray } from '../util/Util';
import { RDFS } from '../util/Vocabularies';
import type { FindOperatorType } from './FindOperator';
import { FindOperator } from './FindOperator';
import type {
  FindOneOptions,
  FindAllOptions,
  FindOptionsWhere,
  FindOptionsWhereField,
  IdOrTypeFindOptionsWhereField,
  FieldPrimitiveValue,
} from './FindOptionsTypes';
import type { QueryAdapter } from './QueryAdapter';

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
    // TODO: add support for limit, and offset
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
    if (where.id && !this.idMatches(entity, where.id)) {
      return false;
    }
    if (where.type && !this.isInstanceOfValueOrOperatorValue(entity, where.type)) {
      return false;
    }
    for (const [ fieldName, fieldValue ] of Object.entries(where)) {
      if (fieldName !== 'id' && fieldName !== 'type') {
        const matches = await this.entityMatchesField(entity, fieldName, fieldValue!);
        if (!matches) {
          return false;
        }
      }
    }
    return true;
  }

  private async entityMatchesField(
    entity: Entity,
    fieldName: string,
    fieldValue: FindOptionsWhereField,
  ): Promise<boolean> {
    if (fieldName in entity) {
      if (FindOperator.isFindOperator(fieldValue)) {
        return this.handleOperator(
          (fieldValue as FindOperator<string>).operator,
          {
            in: (): boolean => {
              const values = this.resolveOperatorValue((fieldValue as FindOperator<FieldPrimitiveValue>).value);
              return (values as FieldPrimitiveValue[])
                .some((valueItem): boolean => this.fieldValueMatchesField(valueItem, entity[fieldName]));
            },
          },
        );
      }
      if (typeof fieldValue === 'object') {
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
    return false;
  }

  private fieldValueMatchesField(
    fieldValue: FieldPrimitiveValue,
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

  private idMatches(entity: Entity, value: IdOrTypeFindOptionsWhereField): boolean {
    if (FindOperator.isFindOperator(value)) {
      return this.handleOperator(
        (value as FindOperator<string>).operator,
        {
          in: (): boolean => {
            const values = this.resolveOperatorValue((value as FindOperator<string>).value);
            return (values as string[]).some((valueItem): boolean => this.idMatches(entity, valueItem));
          },
        },
      );
    }
    return entity['@id'] === value;
  }

  private isInstanceOfValueOrOperatorValue(entity: Entity, value: IdOrTypeFindOptionsWhereField): boolean {
    if (FindOperator.isFindOperator(value)) {
      return this.handleOperator(
        (value as FindOperator<string>).operator,
        {
          in: (): boolean => {
            const values = this.resolveOperatorValue((value as FindOperator<string>).value);
            return (values as string[])
              .some((valueItem): boolean => this.isInstanceOfValueOrOperatorValue(entity, valueItem));
          },
        },
      );
    }
    return this.isInstanceOf(entity, value as string);
  }

  private handleOperator(
    operator: FindOperatorType,
    operatorHandlers: Record<FindOperatorType, () => boolean>,
  ): boolean {
    if (operator in operatorHandlers) {
      return operatorHandlers[operator]();
    }
    throw new Error(`Unsupported operator "${operator}"`);
  }

  private resolveOperatorValue<T>(value: OrArray<T> | FindOperator<T>): OrArray<T> {
    return (value as any[]).map((valueItem): T => valueItem);
    // if (FindOperator.isFindOperator(value)) {
    //   return this.resolveOperatorValue(value as FindOperator<any>);
    // }
    // if (Array.isArray(value)) {
    //   return value.map((valueItem): T => {
    //     if (FindOperator.isFindOperator(valueItem)) {
    //       return this.resolveOperatorValue<T>(valueItem) as T;
    //     }
    //     return valueItem;
    //   });
    // }
    // return value as T;
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
