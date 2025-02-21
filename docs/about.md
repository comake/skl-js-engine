# Codebase Structure

## Core Engine (SklEngine.ts)

The main orchestration class responsible for:

- Handles CRUD operations through a QueryAdapter
- Executes capabilities/mappings 
- Validates inputs/outputs against SHACL shapes
- Manages OAuth flows and credential refresh
- Processes RML mappings
- Handles file uploads

## Storage Layer

### Query Adapters

- Abstract interface for storage operations (`QueryAdapter`)
- SPARQL implementation with two backends:
  - In-memory store (`InMemorySparqlQueryExecutor`)
  - Remote SPARQL endpoint (`SparqlEndpointQueryExecutor`)

### Query Building

- `SparqlQueryBuilder`: Constructs SPARQL SELECT/CONSTRUCT queries
- `SparqlUpdateBuilder`: Constructs SPARQL UPDATE queries
- `FindOperators`: Rich query operators (Equal, Contains, GreaterThan etc.)

## Mapping System

`Mapper.ts` provides the core RML mapping engine with support for:

- Input/output mappings
- Pre-processing mappings
- Series/parallel execution
- Frame-based JSON-LD transformation

## Type System & Validation

- SHACL-based schema validation
- Rich type definitions for:
  - RDF/JSON-LD structures
  - SHACL shapes
  - Query operations
  - Mapping configurations

## Utility Layer

- `TripleUtil`: RDF/JSON-LD conversion utilities
- `SparqlUtil`: SPARQL query construction helpers
- `Types`: Core TypeScript type definitions
- `Vocabularies`: RDF namespace constants

## Integration Points

1. Storage through `QueryAdapter` interface
2. Capability execution through `SKLEngine`
3. Data transformation through `Mapper`
4. Validation through SHACL shapes

## Architecture Pattern

The system follows a capability-driven architecture where each operation is defined as a capability with associated mappings and validations. This allows for:

- Declarative operation definitions
- Consistent validation patterns
- Flexible data transformations
- Pluggable storage backends