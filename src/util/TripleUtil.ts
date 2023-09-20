/* eslint-disable @typescript-eslint/naming-convention */
import DataFactory from '@rdfjs/data-model';
import type { Quad, Quad_Object, Quad_Subject, Literal } from '@rdfjs/types';
import * as jsonld from 'jsonld';
import type { ContextDefinition, GraphObject, NodeObject, ValueObject } from 'jsonld';
import type { Frame } from 'jsonld/jsonld-spec';
import { FindOperator } from '../storage/FindOperator';
import type { FindOptionsRelations, FindOptionsWhere } from '../storage/FindOptionsTypes';
import type { InverseRelationOperatorValue } from '../storage/operator/InverseRelation';
import type { OrArray } from './Types';
import type { JSONArray, JSONObject } from './Util';
import { ensureArray } from './Util';
import { RDF, XSD } from './Vocabularies';

const BLANK_NODE_PREFIX = '_:';

export function toJSValueFromDataType(value: string, dataType: string): number | boolean | string {
  switch (dataType) {
    case XSD.int:
    case XSD.positiveInteger:
    case XSD.negativeInteger:
    case XSD.integer: {
      return Number.parseInt(value, 10);
    }
    case XSD.boolean: {
      if (value === 'true') {
        return true;
      }
      if (value === 'false') {
        return false;
      }
      return value;
    }
    case XSD.double:
    case XSD.decimal:
    case XSD.float: {
      return Number.parseFloat(value);
    }
    case RDF.JSON:
      return JSON.parse(value);
    default: {
      return value;
    }
  }
}

function toJsonLdObject(object: Quad_Object): NodeObject | ValueObject {
  if (object.termType === 'Literal') {
    if (object.language && object.language.length > 0) {
      return {
        '@value': object.value,
        '@language': object.language,
      };
    }
    return {
      '@value': toJSValueFromDataType(object.value, object.datatype.value),
      '@type': object.datatype.value === RDF.JSON ? '@json' : object.datatype.value,
    };
  }
  if (object.termType === 'BlankNode') {
    return { '@id': `_:${object.value}` };
  }
  return { '@id': object.value };
}

function toJsonLdSubject(object: Quad_Subject): string {
  if (object.termType === 'BlankNode') {
    return `_:${object.value}`;
  }
  return object.value;
}

function relationsToFrame(relations: FindOptionsRelations): NodeObject {
  return Object.entries(relations).reduce((obj: NodeObject, [ field, value ]): NodeObject => {
    const fieldFrame: Frame = {};
    let contextAddition: ContextDefinition | undefined;
    if (typeof value === 'object' && value.type === 'operator') {
      const { resolvedName, relations: subRelations } = value.value as InverseRelationOperatorValue;
      contextAddition = { [resolvedName]: { '@reverse': field }};
      if (subRelations) {
        fieldFrame[resolvedName] = relationsToFrame(subRelations);
      } else {
        fieldFrame[resolvedName] = {};
      }
    } else if (typeof value === 'boolean') {
      fieldFrame[field] = {};
    } else {
      fieldFrame[field] = relationsToFrame(value as FindOptionsRelations);
    }
    if (contextAddition) {
      return {
        ...obj,
        '@context': {
          ...obj['@context'] as ContextDefinition,
          ...contextAddition,
        },
        ...fieldFrame,
      };
    }
    return {
      ...obj,
      ...fieldFrame,
    };
  }, {});
}

function whereToFrame(where: FindOptionsWhere): NodeObject {
  if (where.id && typeof where.id === 'string') {
    return { '@id': where.id };
  }
  if (where.id && FindOperator.isFindOperator(where.id) && (where.id as FindOperator<any, any>).operator === 'in') {
    return { '@id': (where.id as FindOperator<any, any>).value };
  }
  return {};
}

function triplesToNodes(triples: Quad[]): {
  nodesById: Record<string, NodeObject>;
  nodeIdOrder: string[];
} {
  const nodeIdOrder: string[] = [];
  const nodesById = triples.reduce((obj: Record<string, NodeObject>, triple): Record<string, NodeObject> => {
    const subject = toJsonLdSubject(triple.subject);
    const isTypePredicate = triple.predicate.value === RDF.type;
    const predicate = isTypePredicate ? '@type' : triple.predicate.value;
    const object = isTypePredicate ? triple.object.value : toJsonLdObject(triple.object);
    if (obj[subject]) {
      if (obj[subject][predicate]) {
        if (Array.isArray(obj[subject][predicate])) {
          (obj[subject][predicate]! as any[]).push(object);
        } else {
          obj[subject][predicate] = [
            obj[subject][predicate]!,
            object,
          ] as any;
        }
      } else {
        obj[subject][predicate] = object;
      }
    } else {
      obj[subject] = {
        '@id': subject,
        [predicate]: object,
      };
      if (!subject.startsWith(BLANK_NODE_PREFIX)) {
        nodeIdOrder.push(subject);
      }
    }
    return obj;
  }, {});
  return { nodesById, nodeIdOrder };
}

async function frameWithRelationsOrNonBlankNodes(
  nodesById: Record<string, NodeObject>,
  frame?: Frame,
  relations?: FindOptionsRelations,
  where?: FindOptionsWhere,
): Promise<NodeObject> {
  if (!frame) {
    const relationsFrame = relations ? relationsToFrame(relations) : {};
    const whereFrame = where ? whereToFrame(where) : {};
    frame = { ...relationsFrame, ...whereFrame };
    if (Object.keys(frame).length > 0) {
      const results = await jsonld.frame(
        { '@graph': Object.values(nodesById) },
        frame,
      );
      if (typeof frame === 'object' && '@context' in frame &&
        Object.keys(frame['@context']!).length > 0
      ) {
        let resultsList;
        if (Array.isArray(results)) {
          resultsList = results;
        } else if ('@graph' in results) {
          resultsList = ensureArray(results['@graph']);
        } else {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { '@context': unusedContext, ...entityResult } = results;
          resultsList = [ entityResult ];
        }
        return {
          '@graph': resultsList.filter((result): boolean =>
            Object.keys((frame as NodeObject)['@context']!).some((relationField): boolean => relationField in result)),
        };
      }
      return results;
    }
    const nonBlankNodes = Object.keys(nodesById)
      .filter((nodeId: string): boolean => !nodeId.startsWith(BLANK_NODE_PREFIX));
    return await jsonld.frame(
      { '@graph': Object.values(nodesById) },
      { '@id': nonBlankNodes as any },
    );
  }
  return await jsonld.frame(
    { '@graph': Object.values(nodesById) },
    frame,
  );
}

function sortNodesByOrder(nodes: NodeObject[], nodeIdOrder: string[]): NodeObject[] {
  return nodes
    .sort((aNode: NodeObject, bNode: NodeObject): number =>
      nodeIdOrder.indexOf(aNode['@id']!) - nodeIdOrder.indexOf(bNode['@id']!));
}

function sortGraphOfNodeObject(graphObject: GraphObject, nodeIdOrder: string[]): GraphObject {
  return {
    ...graphObject,
    '@graph': sortNodesByOrder(graphObject['@graph'] as NodeObject[], nodeIdOrder),
  };
}

export async function triplesToJsonld(
  triples: Quad[],
  skipFraming?: boolean,
  relations?: FindOptionsRelations,
  where?: FindOptionsWhere,
  orderedNodeIds?: string[],
): Promise<OrArray<NodeObject>> {
  if (triples.length === 0) {
    return [];
  }
  const { nodeIdOrder, nodesById } = triplesToNodes(triples);
  if (skipFraming) {
    return Object.values(nodesById);
  }
  const framed = await frameWithRelationsOrNonBlankNodes(nodesById, undefined, relations, where);
  if ('@graph' in framed) {
    return sortNodesByOrder(framed['@graph'] as NodeObject[], orderedNodeIds ?? nodeIdOrder);
  }
  return framed;
}

export async function triplesToJsonldWithFrame(
  triples: Quad[],
  frame?: Frame,
): Promise<GraphObject> {
  const { nodeIdOrder, nodesById } = triplesToNodes(triples);
  const framed = await frameWithRelationsOrNonBlankNodes(nodesById, frame);
  if ('@graph' in framed) {
    return sortGraphOfNodeObject(framed as GraphObject, nodeIdOrder);
  }
  const { '@context': context, ...framedWithoutContext } = framed;
  const graphObject: GraphObject = {
    '@graph': [ framedWithoutContext as NodeObject ],
  };
  if (context) {
    graphObject['@context'] = context;
  }
  return graphObject;
}

export function valueToLiteral(
  value: string | boolean | number | Date | JSONObject | JSONArray,
  datatype?: string,
): Literal {
  if (datatype) {
    if (datatype === '@json' || datatype === RDF.JSON) {
      return DataFactory.literal(JSON.stringify(value), RDF.JSON);
    }
    return DataFactory.literal((value as string | boolean | number).toString(), datatype);
  }
  if (typeof value === 'number') {
    if (Number.isInteger(value)) {
      return DataFactory.literal(value.toString(), XSD.integer);
    }
    return DataFactory.literal(value.toString(), XSD.decimal);
  }
  if (typeof value === 'boolean') {
    return DataFactory.literal(value.toString(), XSD.boolean);
  }
  if (value instanceof Date) {
    return DataFactory.literal(value.toISOString(), XSD.dateTime);
  }
  // eslint-disable-next-line @typescript-eslint/no-base-to-string
  return DataFactory.literal(value.toString());
}

