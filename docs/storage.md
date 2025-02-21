# Storage Layer Implementation Guide

## Architecture Overview

The storage layer consists of three main components:

1. **QueryAdapter Interface**: Abstract interface defining CRUD operations
2. **SPARQL Implementation**: Concrete implementation using SPARQL
3. **Query Builders**: Convert high-level queries to SPARQL

```typescript
// Core interface
interface QueryAdapter {
  find(options?: FindOneOptions): Promise<Entity>;
  findAll(options?: FindAllOptions): Promise<Entity[]>;
  save(entity: Entity): Promise<Entity>;
  update(id: string, attributes: Partial<Entity>): Promise<void>;
  delete(id: string): Promise<void>;
  // ... other operations
}
```

## CRUD Operations Flow

### 1. Find Operation

```typescript
// High-level API
const entity = await engine.find({
  where: { type: 'User' },
  select: ['name', 'email'],
  relations: { posts: true }
});
```

Internal Flow:
1. QueryBuilder creates SPARQL patterns from options
2. Constructs SPARQL SELECT query
3. Executes via QueryExecutor
4. Transforms results to JSON-LD
5. Applies framing if relations specified

Generated SPARQL Example:
```sparql
CONSTRUCT {
  ?entity ?p ?o .
  ?o ?p2 ?o2 .
} WHERE {
  ?entity a <User> .
  ?entity ?p ?o .
  OPTIONAL {
    GRAPH ?o {
      ?o ?p2 ?o2 .
    }
  }
}
```

### 2. Save Operation

```typescript
// High-level API
const saved = await engine.save({
  '@id': 'user1',
  '@type': 'User',
  name: 'John',
  email: 'john@example.com'
});
```

Internal Flow:
1. Validates entity against SHACL shapes
2. Converts entity to triples
3. Clears existing graph for entity
4. Inserts new triples
5. Adds timestamps if enabled

Generated SPARQL Example:
```sparql
CLEAR GRAPH <user1>;
INSERT DATA {
  GRAPH <user1> {
    <user1> a <User> ;
           <name> "John" ;
           <email> "john@example.com" ;
           <dateModified> ?now .
  }
}
```

### 3. Update Operation

```typescript
// High-level API
await engine.update('user1', {
  name: 'John Doe'
});
```

Internal Flow:
1. Validates update attributes
2. Generates DELETE pattern for updated fields
3. Generates INSERT pattern for new values
4. Updates timestamps
5. Executes as single transaction

Generated SPARQL Example:
```sparql
WITH <user1>
DELETE { 
  <user1> <name> ?oldName 
}
INSERT { 
  <user1> <name> "John Doe";
          <dateModified> ?now .
}
WHERE {
  OPTIONAL { <user1> <name> ?oldName }
}
```

## Key Points & Assumptions

### 1. Graph Structure
- Each entity stored in its own named graph
- Graph name = entity ID
- Full entity graph included in relations
- Timestamps stored in entity graph

### 2. ID Management
- Entity IDs must be valid IRIs
- IDs must be unique across all types
- System assumes IDs are stable
- Auto-prefixing for certain namespaces

### 3. Type Handling
- Multiple types supported
- Types must be valid IRIs
- Subclass relationships respected in queries
- Type validation via SHACL

### 4. Query Options

```typescript
interface FindOptions {
  // Field selection
  select?: FindOptionsSelect;
  
  // Filtering conditions
  where?: FindOptionsWhere;
  
  // Related entities
  relations?: FindOptionsRelations;
  
  // Sorting
  order?: FindOptionsOrder;
  
  // Pagination
  offset?: number;
  limit?: number;
}
```

## Query Building Process

### 1. Where Conditions to SPARQL

```typescript
// High-level query
where: {
  type: 'User',
  age: GreaterThan(18),
  status: In(['active', 'pending'])
}

// Generates
WHERE {
  ?entity a <User> .
  ?entity <age> ?age .
  FILTER(?age > 18)
  ?entity <status> ?status .
  VALUES ?status { "active" "pending" }
}
```

### 2. Relations to Graph Patterns

```typescript
// High-level query
relations: {
  posts: {
    comments: true
  }
}

// Generates
OPTIONAL {
  ?entity <posts> ?posts .
  GRAPH ?posts {
    ?posts ?postPred ?postObj .
    OPTIONAL {
      ?posts <comments> ?comments .
      GRAPH ?comments {
        ?comments ?commentPred ?commentObj .
      }
    }
  }
}
```

### 3. Order to SPARQL

```typescript
// High-level query
order: {
  name: 'ASC',
  age: 'DESC'
}

// Generates
ORDER BY ASC(?name) DESC(?age)
```

## Query Operators

```typescript
// Available operators
Equal(value)
Not(value)
LessThan(value)
GreaterThan(value)
In(values)
IsNull()
Like(pattern)
Between(x, y)
```

Example Usage:
```typescript
where: {
  age: GreaterThan(18),
  status: Not(In(['deleted', 'banned'])),
  name: Like('%john%')
}
```

## Performance Considerations

1. **Query Optimization**
   - Use specific types in where clause
   - Limit relation depth
   - Use select when possible
   - Add indices for common patterns

2. **Batch Operations**
   - Use bulk save/update
   - Batch related entities
   - Consider transaction size
   - Monitor memory usage

3. **Relation Loading**
   - Lazy load when possible
   - Use selective loading
   - Consider depth limits
   - Cache common queries

## Common Patterns

1. **Type-based Queries**
```typescript
await findAll({
  where: { type: 'User' }
});
```

2. **Relation Traversal**
```typescript
await find({
  where: { id: 'user1' },
  relations: {
    posts: {
      comments: {
        author: true
      }
    }
  }
});
```

3. **Computed Fields**
```typescript
await findAll({
  where: {
    type: 'Order',
    binds: [{
      expression: 'SUM(?amount)',
      variable: '?total'
    }]
  },
  group: '?user'
});
```

## Debug Tips

1. Enable debug mode to log SPARQL queries:
```typescript
const engine = new SKLEngine({
  debugMode: true
});
```

2. Use raw queries for debugging:
```typescript
const results = await engine.executeRawQuery(`
  SELECT * WHERE {
    GRAPH ?g {
      ?s ?p ?o
    }
  }
`);
```

3. Check generated patterns:
```typescript
const queryBuilder = new SparqlQueryBuilder();
const patterns = queryBuilder.buildEntitySelectPatternsFromOptions(
  entityVariable,
  options
);
console.log(patterns);
```