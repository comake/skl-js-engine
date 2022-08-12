import type { NodeObject } from 'jsonld';
import type { SchemaNodeObject } from '../util/Types';
import { ensureArray } from '../util/Util';
import { RDFS } from '../util/Vocabularies';
import type { QueryAdapter, FindQuery } from './QueryAdapter';

/**
 * A {@link QueryAdapter} that stores schemas and data in memory.
 */
export class MemoryQueryAdapter implements QueryAdapter {
  private readonly schemas: Record<string, SchemaNodeObject> = {};

  public constructor(schemas: SchemaNodeObject[]) {
    for (const schema of schemas) {
      this.schemas[schema['@id']] = schema;
    }
  }

  public async find(query: FindQuery): Promise<SchemaNodeObject | undefined> {
    if (query.id && Object.keys(query).length === 1) {
      return this.schemas[query.id];
    }

    return Object.values(this.schemas).find(
      (schemaInstance: any): boolean => this.schemaInstanceMatchesQuery(schemaInstance, query),
    );
  }

  public async findAll(query: FindQuery): Promise<SchemaNodeObject[]> {
    if (query.id && Object.keys(query).length === 1) {
      const schema = this.schemas[query.id];
      return schema ? [ schema ] : [];
    }

    return Object.values(this.schemas).filter(
      (schemaInstance: any): boolean => this.schemaInstanceMatchesQuery(schemaInstance, query),
    );
  }

  private schemaInstanceMatchesQuery(schema: SchemaNodeObject, query: FindQuery): boolean {
    return Object.entries(query)
      .every(([ fieldName, fieldValue ]): boolean =>
        this.schemaInstanceMatchesField(schema, fieldName, fieldValue!));
  }

  private schemaInstanceMatchesField(schema: SchemaNodeObject, fieldName: string, fieldValue: string): boolean {
    if (fieldName === 'type') {
      return this.isInstanceOf(schema, fieldValue);
    }
    if (fieldName === 'id') {
      fieldName = '@id';
    }
    return fieldName in schema && (
      typeof schema[fieldName] === 'object'
        ? (schema[fieldName] as NodeObject)['@id'] === fieldValue
        : schema[fieldName] === fieldValue
    );
  }

  private isInstanceOf(instance: SchemaNodeObject, targetClass: string): boolean {
    const classes = this.getSubClassesOf(targetClass);
    const instanceTypes = ensureArray(instance['@type']!);
    return instanceTypes.some((type: string): boolean => classes.includes(type));
  }

  private getSubClassesOf(targetClass: string): string[] {
    return Object.values(this.schemas).reduce((
      subClasses: string[],
      schema: SchemaNodeObject,
    ): string[] => {
      const subClassOf = ensureArray(schema[RDFS.subClassOf]);
      if (subClassOf.includes(targetClass)) {
        subClasses = [
          ...subClasses,
          schema['@id']!,
          ...this.getSubClassesOf(schema['@id']!),
        ];
      }
      return subClasses;
    }, [ targetClass ]);
  }
}
