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
  ClearDropOperation,
  Pattern,
} from 'sparqljs';
import {
  bindNow,
  created,
  createSparqlBasicGraphPattern,
  createSparqlClearUpdate,
  createSparqlDropUpdate,
  createSparqlGraphQuads,
  createSparqlOptional,
  createSparqlUpdate,
  dropAll,
  firstPredicate,
  modified,
  nilPredicate,
  now,
  rdfTypeNamedNode,
  restPredicate,
} from '../../../util/SparqlUtil';
import { valueToLiteral } from '../../../util/TripleUtil';
import type { Entity } from '../../../util/Types';
import { ensureArray } from '../../../util/Util';
import { DCTERMS, SKL_V2 } from '../../../util/Vocabularies';
import { VariableGenerator } from './VariableGenerator';

export interface EntityUpdateQueries {
  clear: ClearDropOperation[];
  insertions: GraphQuads[];
  timestampInsertions: GraphQuads[];
}

export interface EntityUpdateTriples {
  entityTriples: Triple[];
  timestampTriples: Triple[];
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
    const updates = this.idsAndAttributesToGraphDeletionsAndInsertions(ids, attributes);
    return createSparqlUpdate(updates);
  }

  public buildUpdate(entityOrEntities: Entity | Entity[]): Update {
    const entities = ensureArray(entityOrEntities);
    const { clear, insertions, timestampInsertions } = this.entitiesToGraphDeletionsAndInsertions(entities);
    const insertUpdate: InsertDeleteOperation = {
      updateType: 'insert',
      insert: insertions,
    };
    const updates = [...clear, insertUpdate];
    if (timestampInsertions.length > 0) {
      updates.push({
        updateType: 'insertdelete',
        delete: [],
        insert: timestampInsertions,
        where: [bindNow],
      });
    }
    return createSparqlUpdate(updates);
  }

  public buildDeleteById(idOrIds: string | string[]): Update {
    const ids = ensureArray(idOrIds);
    const drops = this.idsToGraphDropUpdates(ids);
    return createSparqlUpdate(drops);
  }

  public buildDelete(entityOrEntities: Entity | Entity[]): Update {
    const entities = ensureArray(entityOrEntities);
    const drops = this.entitiesToGraphDropUpdates(entities);
    return createSparqlUpdate(drops);
  }

  public buildDeleteAll(): Update {
    return createSparqlUpdate([dropAll]);
  }

  private idsAndAttributesToGraphDeletionsAndInsertions(
    ids: string[],
    attributes: Partial<Entity>,
  ): InsertDeleteOperation[] {
    return ids.flatMap((id): InsertDeleteOperation[] => {
      const subject = DataFactory.namedNode(id);
      const deletionTriples = this.partialEntityToDeletionTriples(attributes, subject);
      const insertionTriples = this.partialEntityToTriples(subject, attributes);
      const updates: InsertDeleteOperation[] = [
        {
          updateType: 'insertdelete',
          delete: [createSparqlGraphQuads(subject, deletionTriples)],
          insert: [createSparqlGraphQuads(subject, insertionTriples)],
          where: deletionTriples.map(
            (triple): Pattern => createSparqlOptional([createSparqlBasicGraphPattern([triple])]),
          ),
          using: {
            default: [subject],
          },
        } as InsertDeleteOperation,
      ];
      if (this.setTimestamps) {
        const modifiedVariable = DataFactory.variable(this.variableGenerator.getNext());
        const modifiedDeletionTriple = { subject, predicate: modified, object: modifiedVariable };
        const modifiedInsertionTriple = { subject, predicate: modified, object: now };
        updates.push({
          updateType: 'insertdelete',
          delete: [createSparqlGraphQuads(subject, [modifiedDeletionTriple])],
          insert: [createSparqlGraphQuads(subject, [modifiedInsertionTriple])],
          where: [createSparqlOptional([createSparqlBasicGraphPattern([modifiedDeletionTriple])]), bindNow],
          using: {
            default: [subject],
          },
        } as InsertDeleteOperation);
      }

      return updates;
    });
  }

  private entitiesToGraphDeletionsAndInsertions(entities: Entity[]): EntityUpdateQueries {
    return entities.reduce(
      (obj: EntityUpdateQueries, entity): EntityUpdateQueries => {
        const entityGraphName = DataFactory.namedNode(entity['@id']);
        const { entityTriples, timestampTriples } = this.entityToTriples(entity, entityGraphName);
        obj.clear.push(createSparqlClearUpdate(entityGraphName));
        obj.insertions.push(createSparqlGraphQuads(entityGraphName, entityTriples));
        if (timestampTriples.length > 0) {
          obj.timestampInsertions.push(createSparqlGraphQuads(entityGraphName, timestampTriples));
        }
        return obj;
      },
      { clear: [], insertions: [], timestampInsertions: [] },
    );
  }

  private idsToGraphDropUpdates(ids: string[]): UpdateOperation[] {
    return ids.map((id): UpdateOperation => {
      const entityGraphName = DataFactory.namedNode(id);
      return createSparqlDropUpdate(entityGraphName);
    });
  }

  private entitiesToGraphDropUpdates(entities: Entity[]): UpdateOperation[] {
    return entities.map((entity): UpdateOperation => {
      const entityGraphName = DataFactory.namedNode(entity['@id']);
      return createSparqlDropUpdate(entityGraphName);
    });
  }

  private partialEntityToDeletionTriples(entity: NodeObject, subject: NamedNode): Triple[] {
    return Object.keys(entity).reduce((triples: Triple[], key): Triple[] => {
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
  }

  private partialEntityToTriples(subject: NamedNode, entity: NodeObject): Triple[] {
    const entityTriples = Object.entries(entity).reduce((triples: Triple[], [key, value]): Triple[] => {
      const values = ensureArray(value);
      if (key !== '@id') {
        let predicateTriples: Triple[];
        if (key === '@type') {
          predicateTriples = this.buildTriplesWithSubjectPredicateAndIriValue(
            subject,
            rdfTypeNamedNode,
            values as string[],
          );
        } else {
          predicateTriples = this.buildTriplesForSubjectPredicateAndValues(subject, key, values);
        }
        return [...triples, ...predicateTriples];
      }
      return triples;
    }, []);
    return entityTriples;
  }

  private entityToTriples(entity: NodeObject, subject: BlankNode | NamedNode): EntityUpdateTriples {
    const entityTriples = Object.entries(entity).reduce((triples: Triple[], [key, value]): Triple[] => {
      const values = ensureArray(value);
      if (key !== '@id') {
        if (key === '@type') {
          const predicateTriples = this.buildTriplesWithSubjectPredicateAndIriValue(
            subject,
            rdfTypeNamedNode,
            values as string[],
          );
          return [...triples, ...predicateTriples];
        }
        if (!(this.setTimestamps && key === DCTERMS.modified)) {
          const predicateTriples = this.buildTriplesForSubjectPredicateAndValues(subject, key, values);
          return [...triples, ...predicateTriples];
        }
      }
      return triples;
    }, []);

    const timestampTriples = [];
    if (this.setTimestamps && subject.termType === 'NamedNode') {
      if (!(SKL_V2.dateCreated in entity)) {
        timestampTriples.push({ subject, predicate: created, object: now });
      }
      timestampTriples.push({ subject, predicate: modified, object: now });
    }
    return {
      entityTriples,
      timestampTriples,
    };
  }

  private buildTriplesForSubjectPredicateAndValues(
    subject: BlankNode | NamedNode,
    predicate: string,
    values: any[],
  ): Triple[] {
    const predicateTerm = DataFactory.namedNode(predicate);
    return values.flatMap((value: any): Triple[] =>
      this.buildTriplesWithSubjectPredicateAndValue(subject, predicateTerm, value),
    );
  }

  private buildTriplesWithSubjectPredicateAndIriValue(
    subject: BlankNode | NamedNode,
    predicate: NamedNode,
    values: string[],
  ): Triple[] {
    return values.map(
      (valueItem): Triple =>
        ({
          subject,
          predicate,
          object: DataFactory.namedNode(valueItem),
        } as Triple),
    );
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
      if ('@list' in value) {
        return this.buildTriplesForList(subject, predicate, value['@list']);
      }
      if ('@value' in value) {
        return [{ subject, predicate, object: this.jsonLdValueObjectToLiteral(value) } as Triple];
      }

      const isReferenceObject = '@id' in value;
      const isBlankNodeReferenceObject = !isReferenceObject || (value['@id'] as string).startsWith('_:');
      if (isBlankNodeReferenceObject) {
        return this.buildTriplesForBlankNode(subject, predicate, value as NodeObject);
      }
      if (isReferenceObject) {
        return [{ subject, predicate, object: DataFactory.namedNode(value['@id']) } as Triple];
      }
    }
    return [{ subject, predicate, object: valueToLiteral(value) } as Triple];
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

  private buildTriplesForList(subject: BlankNode | NamedNode, predicate: NamedNode, value: NodeObject[]): Triple[] {
    const blankNode = DataFactory.blankNode(this.variableGenerator.getNext());
    const rest =
      value.length > 1
        ? this.buildTriplesForList(blankNode, restPredicate, value.slice(1))
        : [{ subject: blankNode, predicate: restPredicate, object: nilPredicate }];
    return [
      { subject, predicate, object: blankNode },
      ...this.buildTriplesWithSubjectPredicateAndValue(blankNode, firstPredicate, value[0]),
      ...rest,
    ];
  }

  private buildTriplesForBlankNode(subject: BlankNode | NamedNode, predicate: NamedNode, value: NodeObject): Triple[] {
    const blankNode = DataFactory.blankNode(this.variableGenerator.getNext());
    const { entityTriples } = this.entityToTriples(value, blankNode);
    return [{ subject, predicate, object: blankNode }, ...entityTriples];
  }
}
