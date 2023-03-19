import { RDF } from '@comake/rmlmapper-js';
import DataFactory from '@rdfjs/data-model';
import type { BlankNode, NamedNode, Term } from '@rdfjs/types';
import type { NodeObject, ValueObject } from 'jsonld/jsonld';
import type {
  Update,
  GraphQuads,
  Triple,
  InsertDeleteOperation,
  UpdateOperation,
  BindPattern,
  GraphPattern,
} from 'sparqljs';
import {
  created,
  createSparqlBasicGraphPattern,
  createSparqlGraphPattern,
  modified,
  now,
  objectNode,
  predicateNode,
  rdfTypeNamedNode,
  subjectNode,
} from '../../util/SparqlUtil';
import {
  valueToLiteral,
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

  public buildPartialUpdate(idOrIds: string | string[], attributes: Partial<Entity>): Update {
    const ids = ensureArray(idOrIds);
    const { insertions, deletions } = this.idsAndAttributesToGraphDeletionsAndInsertions(ids, attributes);
    return this.buildUpdateWithInsertionsAndDeletions(deletions, insertions);
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

  private idsAndAttributesToGraphDeletionsAndInsertions(
    ids: string[],
    attributes: Partial<Entity>,
  ): EntityUpdateQueries {
    return ids.reduce((obj: EntityUpdateQueries, id): EntityUpdateQueries => {
      const subject = DataFactory.namedNode(id);
      const deletionTriples = this.partialEntityToDeletionTriples(attributes, subject);
      obj.deletions.push({
        type: 'graph',
        name: subject,
        triples: deletionTriples,
      });
      obj.insertions.push(this.partialEntityToGraphInsertion(subject, attributes));
      return obj;
    }, { insertions: [], deletions: []});
  }

  private partialEntityToGraphInsertion(entityGraphName: NamedNode, entity: NodeObject): GraphQuads {
    const triples = this.partialEntityToTriples(entity, entityGraphName);
    return {
      type: 'graph',
      name: entityGraphName,
      triples,
    };
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

  private entityToGraphInsertion(entityGraphName: NamedNode, entity: NodeObject): GraphQuads {
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

  private partialEntityToDeletionTriples(entity: NodeObject, subject: NamedNode): Triple[] {
    const entityTriples = Object.keys(entity).reduce((triples: Triple[], key): Triple[] => {
      if (key !== '@id') {
        return [
          ...triples,
          this.buildTriplesWithSubjectPredicateAndVariableValue(
            subject,
            DataFactory.namedNode(key),
            this.variableGenerator.getNext(),
          ),
        ];
      }
      return triples;
    }, []);

    if (this.setTimestamps) {
      entityTriples.push({
        subject,
        predicate: modified,
        object: DataFactory.variable(this.variableGenerator.getNext()),
      });
    }
    return entityTriples;
  }

  private partialEntityToTriples(entity: NodeObject, subject: NamedNode): Triple[] {
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
      entityTriples.push({ subject, predicate: modified, object: now });
    }
    return entityTriples;
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
      if (entity[DCTERMS.modified]) {
        for (const triple of entityTriples) {
          if (triple.subject.equals(subject) &&
            'termType' in triple.predicate &&
            triple.predicate.equals(modified)
          ) {
            triple.object = now;
          }
        }
      } else {
        entityTriples.push({ subject, predicate: modified, object: now });
      }
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

  private buildTriplesWithSubjectPredicateAndVariableValue(
    subject: NamedNode,
    predicate: NamedNode,
    value: string,
  ): Triple {
    return {
      subject,
      predicate,
      object: DataFactory.variable(value),
    };
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
    if (insertions.length === 0) {
      return [{
        updateType: 'deletewhere',
        delete: deletions,
      }];
    }
    const update: InsertDeleteOperation = {
      updateType: 'insertdelete',
      delete: deletions,
      insert: insertions,
      where: deletions.map((deletion): GraphPattern =>
        createSparqlGraphPattern(
          deletion.name,
          [ createSparqlBasicGraphPattern(deletion.triples) ],
        )),
    };
    if (insertions.length > 0 && this.setTimestamps) {
      update.where!.push(this.bindNow());
    }
    return [ update ];
  }

  private sparqlUpdate(updates: UpdateOperation[]): Update {
    return {
      type: 'update',
      prefixes: {},
      updates,
    };
  }

  private bindNow(): BindPattern {
    return {
      type: 'bind',
      variable: now,
      expression: {
        type: 'operation',
        operator: 'now',
        args: [],
      },
    };
  }
}
