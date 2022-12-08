import { RDF } from '@comake/rmlmapper-js';
import DataFactory from '@rdfjs/data-model';
import type { BlankNode, NamedNode, Term } from '@rdfjs/types';
import type { NodeObject, ValueObject } from 'jsonld/jsonld';
import type {
  Update,
  GraphQuads,
  Triple,
} from 'sparqljs';
import { rdfTypeNamedNode, valueToLiteral } from '../../util/TripleUtil';
import type { Entity } from '../../util/Types';
import { ensureArray } from '../../util/Util';
import { VariableGenerator } from './VariableGenerator';

export interface EntityUpdateQueries {
  insertions: GraphQuads[];
  deletions: GraphQuads[];
}

export class SparqlUpdateBuilder {
  private readonly variableGenerator: VariableGenerator;

  public constructor() {
    this.variableGenerator = new VariableGenerator();
  }

  public buildUpdate(entityOrEntities: Entity | Entity[]): Update {
    const entities = ensureArray(entityOrEntities);
    const { insertions, deletions } = this.entitiesToGraphDeletionsAndInsertions(entities);
    return this.buildUpdateWithInsertionsAndDeletions(deletions, insertions);
  }

  public buildDelete(entityOrEntities: Entity | Entity[]): Update {
    const entities = ensureArray(entityOrEntities);
    const deletions = this.entitiesToGraphDeletions(entities);
    return this.buildUpdateWithInsertionsAndDeletions(deletions, []);
  }

  private entitiesToGraphDeletionsAndInsertions(
    entities: Entity[],
  ): EntityUpdateQueries {
    return entities.reduce((obj: EntityUpdateQueries, entity): EntityUpdateQueries => {
      const entityGraphName = DataFactory.namedNode(entity['@id']);
      obj.deletions.push(this.entityToGraphDeletion(entityGraphName));
      obj.insertions.push(this.entityToGraphInsertion(entityGraphName, entity));
      return obj;
    }, { insertions: [], deletions: []});
  }

  private entitiesToGraphDeletions(
    entities: Entity[],
  ): GraphQuads[] {
    return entities.reduce((arr: GraphQuads[], entity): GraphQuads[] => {
      const entityGraphName = DataFactory.namedNode(entity['@id']);
      arr.push(this.entityToGraphDeletion(entityGraphName));
      return arr;
    }, []);
  }

  private entityToGraphInsertion(entityGraphName: NamedNode, entity: Entity): GraphQuads {
    const triples = this.entityToTriples(entity, entityGraphName);
    return {
      type: 'graph',
      name: entityGraphName,
      triples,
    };
  }

  private entityToGraphDeletion(entityGraphName: NamedNode): GraphQuads {
    const subject = DataFactory.variable(this.variableGenerator.getNext());
    const predicate = DataFactory.variable(this.variableGenerator.getNext());
    const object = DataFactory.variable(this.variableGenerator.getNext());
    return {
      type: 'graph',
      name: entityGraphName,
      triples: [{ subject, predicate, object }],
    };
  }

  private entityToTriples(entity: NodeObject, subject: BlankNode | NamedNode): Triple[] {
    return Object.entries(entity).reduce((triples: Triple[], [ key, value ]): Triple[] => {
      const values = ensureArray(value);
      if (key !== '@id') {
        if (key === '@type') {
          return [
            ...triples,
            ...this.buildTriplesWithSubjectPredicateAndIriValue(
              subject,
              rdfTypeNamedNode,
              values as string[],
            ),
          ];
        }
        return [
          ...triples,
          ...this.buildTriplesForSubjectPredicateAndValues(subject, key, values),
        ];
      }
      return triples;
    }, []);
  }

  private buildTriplesForSubjectPredicateAndValues(
    subject: BlankNode | NamedNode,
    predicate: string,
    values: any[],
  ): Triple[] {
    const predicateTerm = DataFactory.namedNode(predicate);
    return values.flatMap((value: any): Triple[] =>
      this.buildTriplesWithSubjectPredicateAndValue(subject, predicateTerm, value));
  }

  private buildTriplesWithSubjectPredicateAndIriValue(
    subject: BlankNode | NamedNode,
    predicate: NamedNode,
    values: string[],
  ): Triple[] {
    return values.map((valueItem): Triple => ({
      subject,
      predicate,
      object: DataFactory.namedNode(valueItem),
    } as Triple));
  }

  private buildTriplesWithSubjectPredicateAndValue(
    subject: BlankNode | NamedNode,
    predicate: NamedNode,
    value: any,
  ): Triple[] {
    const isObject = typeof value === 'object';
    if (isObject) {
      if ('@value' in value) {
        return [ { subject, predicate, object: this.jsonLdValueObjectToLiteral(value) } as Triple ];
      }

      const isReferenceObject = '@id' in value;
      const isBlankNodeReferenceObject = !isReferenceObject || (value['@id'] as string).startsWith('_:');
      if (isBlankNodeReferenceObject) {
        return this.buildTriplesForBlankNode(subject, predicate, value as NodeObject);
      }
      if (isReferenceObject) {
        return [ { subject, predicate, object: DataFactory.namedNode(value['@id']) } as Triple ];
      }
    }
    return [ { subject, predicate, object: valueToLiteral(value) } as Triple ];
  }

  private jsonLdValueObjectToLiteral(value: ValueObject): Term {
    if (typeof value['@value'] === 'object') {
      return DataFactory.literal(JSON.stringify(value['@value']), RDF.JSON);
    }
    if ((value as any)['@language']) {
      return DataFactory.literal(value['@value'] as string, (value as any)['@language']);
    }
    if ((value as any)['@type']) {
      return DataFactory.literal(value['@value'].toString(), (value as any)['@type']);
    }
    return valueToLiteral(value['@value']);
  }

  private buildTriplesForBlankNode(subject: BlankNode | NamedNode, predicate: NamedNode, value: NodeObject): Triple[] {
    const blankNode = DataFactory.blankNode(this.variableGenerator.getNext());
    return [
      { subject, predicate, object: blankNode },
      ...this.entityToTriples(value, blankNode),
    ];
  }

  private buildUpdateWithInsertionsAndDeletions(deletions: GraphQuads[], insertions: GraphQuads[]): Update {
    const update = {
      type: 'update',
      prefixes: {},
      updates: [],
    } as Update;

    if (deletions.length > 0) {
      update.updates.push({ updateType: 'deletewhere', delete: deletions });
    }
    if (insertions.length > 0) {
      update.updates.push({ updateType: 'insert', insert: insertions });
    }
    return update;
  }
}
