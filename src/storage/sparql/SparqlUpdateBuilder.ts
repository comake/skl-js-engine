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
} from '../../util/SparqlUtil';
import {
  valueToLiteral,
} from '../../util/TripleUtil';
import type { Entity } from '../../util/Types';
import { ensureArray } from '../../util/Util';
import { DCTERMS } from '../../util/Vocabularies';
import { VariableGenerator } from './VariableGenerator';

export interface EntityUpdateQueries {
  clear: ClearDropOperation[];
  insertions: GraphQuads[];
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
    const { clear, insertions } = this.entitiesToGraphDeletionsAndInsertions(entities);
    let insertUpdate: InsertDeleteOperation;
    if (this.setTimestamps) {
      insertUpdate = {
        updateType: 'insertdelete',
        delete: [],
        insert: insertions,
        where: [ bindNow ],
      };
    } else {
      insertUpdate = {
        updateType: 'insert',
        insert: insertions,
      };
    }
    return createSparqlUpdate([ ...clear, insertUpdate ]);
  }

  public buildDelete(entityOrEntities: Entity | Entity[]): Update {
    const entities = ensureArray(entityOrEntities);
    const drops = this.entitiesToGraphDropUpdates(entities);
    return createSparqlUpdate(drops);
  }

  public buildDeleteAll(): Update {
    return createSparqlUpdate([ dropAll ]);
  }

  private idsAndAttributesToGraphDeletionsAndInsertions(
    ids: string[],
    attributes: Partial<Entity>,
  ): InsertDeleteOperation[] {
    return ids.map((id): InsertDeleteOperation => {
      const subject = DataFactory.namedNode(id);
      const deletionTriples = this.partialEntityToDeletionTriples(attributes, subject);
      const insertionTriples = this.partialEntityToTriples(subject, attributes);
      const whereTriples = [ ...deletionTriples ];
      const whereAdditions: Pattern[] = [];
      if (this.setTimestamps) {
        const modifiedVariable = DataFactory.variable(this.variableGenerator.getNext());
        const modifiedDeletionTriple = { subject, predicate: modified, object: modifiedVariable };
        const modifiedInsertionTriple = { subject, predicate: modified, object: now };
        deletionTriples.push(modifiedDeletionTriple);
        insertionTriples.push(modifiedInsertionTriple);
        whereTriples.push(modifiedDeletionTriple);
        whereAdditions.push(bindNow);
      }
      const update = {
        updateType: 'insertdelete',
        delete: [ createSparqlGraphQuads(subject, deletionTriples) ],
        insert: [ createSparqlGraphQuads(subject, insertionTriples) ],
        where: [
          ...whereTriples.map((triple): Pattern =>
            createSparqlOptional([
              createSparqlBasicGraphPattern([ triple ]),
            ])),
          ...whereAdditions,
        ],
        using: {
          default: [ subject ],
        },
      } as InsertDeleteOperation;
      return update;
    });
  }

  private entitiesToGraphDeletionsAndInsertions(
    entities: Entity[],
  ): EntityUpdateQueries {
    return entities
      .reduce((obj: EntityUpdateQueries, entity): EntityUpdateQueries => {
        const entityGraphName = DataFactory.namedNode(entity['@id']);
        const insertionTriples = this.entityToTriples(entity, entityGraphName);
        obj.clear.push(createSparqlClearUpdate(entityGraphName));
        obj.insertions.push(createSparqlGraphQuads(entityGraphName, insertionTriples));
        return obj;
      }, { clear: [], insertions: []});
  }

  private entitiesToGraphDropUpdates(
    entities: Entity[],
  ): UpdateOperation[] {
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
    const entityTriples = Object.entries(entity).reduce((triples: Triple[], [ key, value ]): Triple[] => {
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
        return [ ...triples, ...predicateTriples ];
      }
      return triples;
    }, []);
    return entityTriples;
  }

  private entityToTriples(entity: NodeObject, subject: BlankNode | NamedNode): Triple[] {
    const entityTriples = Object.entries(entity).reduce((triples: Triple[], [ key, value ]): Triple[] => {
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
        return [ ...triples, ...predicateTriples ];
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
      if ('@list' in value) {
        return this.buildTriplesForList(subject, predicate, value['@list']);
      }
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

  private buildTriplesForList(subject: BlankNode | NamedNode, predicate: NamedNode, value: NodeObject[]): Triple[] {
    const blankNode = DataFactory.blankNode(this.variableGenerator.getNext());
    const rest = value.length > 1
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
    return [
      { subject, predicate, object: blankNode },
      ...this.entityToTriples(value, blankNode),
    ];
  }
}
