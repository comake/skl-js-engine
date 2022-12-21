/* eslint-disable @typescript-eslint/naming-convention */
import DataFactory from '@rdfjs/data-model';
import type { Quad, Quad_Object, Quad_Subject, Literal } from '@rdfjs/types';
import * as jsonld from 'jsonld';
import type { NodeObject, ValueObject } from 'jsonld';
import type { PropertyPath } from 'sparqljs';
import type { OrArray } from './Types';
import { RDF, XSD, RDFS, DCTERMS } from './Vocabularies';

export const rdfTypeNamedNode = DataFactory.namedNode(RDF.type);
export const rdfsSubClassOfNamedNode = DataFactory.namedNode(RDFS.subClassOf);
export const subjectNode = DataFactory.variable('subject');
export const predicateNode = DataFactory.variable('predicate');
export const objectNode = DataFactory.variable('object');
export const entityVariable = DataFactory.variable('entity');
export const now = DataFactory.variable('now');
export const created = DataFactory.namedNode(DCTERMS.created);
export const modified = DataFactory.namedNode(DCTERMS.modified);

export const allTypesAndSuperTypesPath: PropertyPath = {
  type: 'path',
  pathType: '/',
  items: [
    rdfTypeNamedNode,
    {
      type: 'path',
      pathType: '*',
      items: [ rdfsSubClassOfNamedNode ],
    },
  ],
};

export function toJSValueFromDataType(value: string, dataType: string): any {
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

export async function triplesToJsonld(triples: Quad[]): Promise<OrArray<NodeObject>> {
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
    }
    return obj;
  }, {});

  const nodeObject = { '@graph': Object.values(nodesById) };
  const nonBlankNodes = Object.keys(nodesById).filter((id): boolean => !id.startsWith('_:'));
  const framed = await jsonld.frame(
    nodeObject,
    {
      '@context': {},
      '@id': nonBlankNodes as any,
    },
  );
  if (framed['@graph']) {
    return framed['@graph'];
  }
  return framed;
}

export function valueToLiteral(value: string | boolean | number): Literal {
  if (typeof value === 'number') {
    if (Number.isInteger(value)) {
      return DataFactory.literal(value.toString(), XSD.integer);
    }
    return DataFactory.literal(value.toString(), XSD.decimal);
  }
  if (typeof value === 'boolean') {
    return DataFactory.literal(value.toString(), XSD.boolean);
  }
  return DataFactory.literal(value.toString());
}

