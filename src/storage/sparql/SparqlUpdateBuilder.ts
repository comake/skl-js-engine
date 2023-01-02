import { RDF } from '@comake/rmlmapper-js';
import DataFactory from '@rdfjs/data-model';
import type { BlankNode, NamedNode, Term } from '@rdfjs/types';
import type { NodeObject, ValueObject } from 'jsonld/jsonld';
import type {
  Update,
  GraphQuads,
  Triple,
  InsertDeleteOperation,
  SelectQuery,
  UpdateOperation,
} from 'sparqljs';
import {
  rdfTypeNamedNode,
  valueToLiteral,
  now,
  created,
  modified,
  subjectNode,
  predicateNode,
  objectNode,
} from '../../util/TripleUtil';
import type { Entity } from '../../util/Types';
import { ensureArray } from '../../util/Util';
import { DCTERMS } from '../../util/Vocabularies';
import { VariableGenerator } from './VariableGenerator';

export interface EntityUpdateQueries {
  insertions: GraphQuads[];
  deletions: GraphQuads[];
}

export interface SparqlUpdateBuilderArgs {
  setTimestamps?: boolean;
}

export class SparqlUpdateBuilder {
  private readonly variableGenerator: VariableGenerator;
  private readonly setTimestamps: boolean;

  public constructor(args?: SparqlUpdateBuilderArgs) {
    this.variableGenerator = new VariableGenerator();
    this.setTimestamps = args?.setTimestamps ?? false;
  }

  public buildUpdate(entityOrEntities: Entity | Entity[]): Update {
    const entities = ensureArray(entityOrEntities);
    const { insertions, deletions } = this.entitiesToGraphDeletionsAndInsertions(entities);
    return this.buildUpdateWithInsertionsAndDeletions(deletions, insertions);
  }

  public buildDelete(entityOrEntities: Entity | Entity[]): Update {
    const entities = ensureArray(entityOrEntities);
    const deletions = this.entitiesToGraphDeletions(entities);
    return this.buildUpdateWithInsertionsAndDeletions(deletions);
  }

  public buildDeleteAll(): Update {
    const updates = [{
      updateType: 'deletewhere',
      delete: [{
        type: 'bgp',
        triples: [{ subject: subjectNode, predicate: predicateNode, object: objectNode }],
      }],
    }] as InsertDeleteOperation[];
    return this.sparqlUpdate(updates);
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
    const entityTriples = Object.entries(entity).reduce((triples: Triple[], [ key, value ]): Triple[] => {
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

    if (this.setTimestamps && subject.termType === 'NamedNode') {
      if (!entity[DCTERMS.created]) {
        entityTriples.push({ subject, predicate: created, object: now });
      }
      entityTriples.push({ subject, predicate: modified, object: now });
    }
    return entityTriples;
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

  private buildUpdateWithInsertionsAndDeletions(
    deletions: GraphQuads[],
    insertions: GraphQuads[] = [],
  ): Update {
    const updates = this.createUpdatesFromInsertionsAndDeletions(deletions, insertions);
    return this.sparqlUpdate(updates);
  }

  private createUpdatesFromInsertionsAndDeletions(
    deletions: GraphQuads[],
    insertions: GraphQuads[],
  ): InsertDeleteOperation[] {
    const updates: InsertDeleteOperation[] = [];
    if (deletions.length > 0) {
      updates.push({
        updateType: 'deletewhere',
        delete: deletions,
      } as InsertDeleteOperation);
    }
    if (insertions.length > 0) {
      const insert = { updateType: 'insert', insert: insertions } as InsertDeleteOperation;
      if (this.setTimestamps) {
        insert.where = [ this.selectNow() ];
      }
      updates.push(insert);
    }
    return updates;
  }

  private sparqlUpdate(updates: UpdateOperation[]): Update {
    return {
      type: 'update',
      prefixes: {},
      updates,
    };
  }

  private selectNow(): SelectQuery {
    return {
      type: 'query',
      queryType: 'SELECT',
      prefixes: {},
      variables: [ now ],
      where: [{
        type: 'bind',
        variable: now,
        expression: {
          type: 'operation',
          operator: 'now',
          args: [],
        },
      }],
    };
  }
}
