/* eslint-disable @typescript-eslint/naming-convention */
import { PassThrough } from 'stream';
import type { QueryEngine } from '@comunica/query-sparql-rdfjs';
import { Store } from 'n3';
import { Literal, NamedNode, Quad } from 'rdf-data-factory';
import { Generator } from 'sparqljs';
import {
  InMemorySparqlQueryExecutor,
} from '../../../../../../src/storage/query-adapter/sparql/query-executor/InMemorySparqlQueryExecutor';
import { XSD } from '../../../../../../src/util/Vocabularies';

const queryQuads = jest.fn();
const queryBindings = jest.fn();
const queryVoid = jest.fn();
const queryBoolean = jest.fn();

jest.mock('@comunica/query-sparql-rdfjs', (): any => ({
  QueryEngine: jest.fn().mockImplementation((): QueryEngine => ({
    queryQuads,
    queryBindings,
    queryVoid,
    queryBoolean,
  } as any)),
}));

const stringify = jest.fn((): string => 'query');

jest.mock('sparqljs', (): any => {
  const actual = jest.requireActual('sparqljs');
  return {
    ...actual,
    Generator: jest.fn(actual.Generator),
  };
});

jest.mock('n3', (): any => {
  const actual = jest.requireActual('n3');
  return {
    ...actual,
    Store: jest.fn(actual.Store),
  };
});

describe('a MemoryQueryAdapter', (): void => {
  let executor: InMemorySparqlQueryExecutor;
  const store = {};
  let mockStream: PassThrough;
  const quad = new Quad(
    new NamedNode('s'),
    new NamedNode('p'),
    new NamedNode('o'),
    new NamedNode('g'),
  );
  const binding = {
    type: 'bindings',
    entries: new Map([[ 'bound', new NamedNode('s') ]]),
  };
  const countBinding = {
    type: 'bindings',
    entries: new Map([[ 'count', new Literal('1', XSD.integer) ]]),
  };

  beforeEach(async(): Promise<void> => {
    jest.clearAllMocks();
    mockStream = new PassThrough();
    queryQuads.mockResolvedValue(mockStream);
    queryBindings.mockResolvedValue(mockStream);
    queryVoid.mockReturnValue(undefined);
    queryBoolean.mockReturnValue(true);
    (Generator as jest.Mock).mockReturnValueOnce({ stringify } as any);
    (Store as jest.Mock).mockReturnValueOnce(store);
    executor = new InMemorySparqlQueryExecutor();
  });

  describe('executeSparqlSelectAndGetData', (): void => {
    it('executes a quads query if the query is a construct.', async(): Promise<void> => {
      const promise = executor.executeSparqlSelectAndGetData({ queryType: 'CONSTRUCT' } as any);
      await new Promise((resolve): any => setImmediate(resolve));
      mockStream.emit('data', quad);
      mockStream.emit('end');
      await expect(promise).resolves.toEqual([ quad ]);
      expect(stringify).toHaveBeenCalledTimes(1);
      expect(stringify).toHaveBeenCalledWith({ queryType: 'CONSTRUCT' });
      expect(queryQuads).toHaveBeenCalledTimes(1);
      expect(queryQuads).toHaveBeenCalledWith(
        'query',
        { sources: [ store ], unionDefaultGraph: true },
      );
    });

    it('executes a bindings query if the query is a select.', async(): Promise<void> => {
      const promise = executor.executeSparqlSelectAndGetData({ queryType: 'SELECT' } as any);
      await new Promise((resolve): any => setImmediate(resolve));
      mockStream.emit('data', binding);
      mockStream.emit('end');
      await expect(promise).resolves.toEqual([{ bound: new NamedNode('s') }]);
      expect(stringify).toHaveBeenCalledTimes(1);
      expect(stringify).toHaveBeenCalledWith({ queryType: 'SELECT' });
      expect(queryBindings).toHaveBeenCalledTimes(1);
      expect(queryBindings).toHaveBeenCalledWith(
        'query',
        { sources: [ store ], unionDefaultGraph: true },
      );
    });
  });

  describe('executeSparqlSelectAndGetDataRaw', (): void => {
    it('executes a quads query if the query is a construct.', async(): Promise<void> => {
      const promise = executor.executeSparqlSelectAndGetDataRaw('query', true);
      await new Promise((resolve): any => setImmediate(resolve));
      mockStream.emit('data', quad);
      mockStream.emit('end');
      await expect(promise).resolves.toEqual([ quad ]);
      expect(queryQuads).toHaveBeenCalledTimes(1);
      expect(queryQuads).toHaveBeenCalledWith(
        'query',
        { sources: [ store ], unionDefaultGraph: true },
      );
    });

    it('executes a bindings query if the query is a select.', async(): Promise<void> => {
      const promise = executor.executeSparqlSelectAndGetDataRaw('query');
      await new Promise((resolve): any => setImmediate(resolve));
      mockStream.emit('data', binding);
      mockStream.emit('end');
      await expect(promise).resolves.toEqual([{ bound: new NamedNode('s') }]);
      expect(queryBindings).toHaveBeenCalledTimes(1);
      expect(queryBindings).toHaveBeenCalledWith(
        'query',
        { sources: [ store ], unionDefaultGraph: true },
      );
    });

    it('throws an error if there\'s an error while reading the stream.', async(): Promise<void> => {
      const promise = executor.executeSparqlSelectAndGetDataRaw('query');
      await new Promise((resolve): any => setImmediate(resolve));
      mockStream.emit('error', new Error('error'));
      await expect(promise).rejects.toThrow('error');
      expect(queryBindings).toHaveBeenCalledTimes(1);
      expect(queryBindings).toHaveBeenCalledWith(
        'query',
        { sources: [ store ], unionDefaultGraph: true },
      );
    });
  });

  describe('executeSparqlUpdate', (): void => {
    it('executes a void query and returns undefined.', async(): Promise<void> => {
      const updateQuery = { type: 'update', updates: [{}]} as any;
      await expect(
        executor.executeSparqlUpdate(updateQuery),
      ).resolves.toBeUndefined();
      expect(stringify).toHaveBeenCalledTimes(1);
      expect(stringify).toHaveBeenCalledWith(updateQuery);
      expect(queryVoid).toHaveBeenCalledTimes(1);
      expect(queryVoid).toHaveBeenCalledWith(
        'query',
        { sources: [ store ], unionDefaultGraph: true },
      );
    });
  });

  describe('executeAskQueryAndGetResponse', (): void => {
    it('executes a boolean query and returns a boolean.', async(): Promise<void> => {
      await expect(
        executor.executeAskQueryAndGetResponse({} as any),
      ).resolves.toBe(true);
      expect(stringify).toHaveBeenCalledTimes(1);
      expect(stringify).toHaveBeenCalledWith({});
      expect(queryBoolean).toHaveBeenCalledTimes(1);
      expect(queryBoolean).toHaveBeenCalledWith(
        'query',
        { sources: [ store ], unionDefaultGraph: true },
      );
    });
  });

  describe('executeSelectCountAndGetResponse', (): void => {
    it('executes a bindings query and returns the count.', async(): Promise<void> => {
      const promise = executor.executeSelectCountAndGetResponse({} as any);
      await new Promise((resolve): any => setImmediate(resolve));
      mockStream.emit('data', countBinding);
      mockStream.emit('end');
      await expect(promise).resolves.toBe(1);
      expect(queryBindings).toHaveBeenCalledTimes(1);
      expect(queryBindings).toHaveBeenCalledWith(
        'query',
        { sources: [ store ], unionDefaultGraph: true },
      );
    });

    it('throws an error if there\'s an error while reading the stream.', async(): Promise<void> => {
      const promise = executor.executeSelectCountAndGetResponse({} as any);
      await new Promise((resolve): any => setImmediate(resolve));
      mockStream.emit('error', new Error('error'));
      await expect(promise).rejects.toThrow('error');
      expect(queryBindings).toHaveBeenCalledTimes(1);
      expect(queryBindings).toHaveBeenCalledWith(
        'query',
        { sources: [ store ], unionDefaultGraph: true },
      );
    });
  });
});
