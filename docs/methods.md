# Public API Methods

## Core Methods (SKLEngine)

### CRUD Operations

```typescript
// Find a single entity
find(options?: FindOneOptions): Promise<Entity>

// Find an entity by criteria
findBy(where: FindOptionsWhere, notFoundErrorMessage?: string): Promise<Entity>

// Find an entity if it exists, otherwise return undefined
findByIfExists(options: FindOptionsWhere): Promise<Entity | undefined>

// Find multiple entities
findAll(options?: FindAllOptions): Promise<Entity[]>

// Find multiple entities by criteria
findAllBy(where: FindOptionsWhere): Promise<Entity[]>

// Check if entities exist
exists(options?: FindAllOptions): Promise<boolean>

// Count entities
count(options?: FindAllOptions): Promise<number>

// Group entities by specified criteria
groupBy(options: GroupByOptions): Promise<GroupByResponse>

// Save single or multiple entities
save(entity: Entity): Promise<Entity>
save(entities: Entity[]): Promise<Entity[]>

// Update entity(ies) by ID
update(id: string, attributes: Partial<Entity>): Promise<void>
update(ids: string[], attributes: Partial<Entity>): Promise<void>

// Delete entity(ies) by ID
delete(id: string): Promise<void>
delete(ids: string[]): Promise<void>

// Destroy entity(ies)
destroy(entity: Entity): Promise<Entity>
destroy(entities: Entity[]): Promise<Entity[]>

// Delete all entities
destroyAll(): Promise<void>
```

### Raw Query Operations

```typescript
// Execute raw SPARQL queries
executeRawQuery<T extends RawQueryResult>(query: string): Promise<T[]>
executeRawUpdate(query: string): Promise<void>
executeRawConstructQuery(query: string, frame?: Frame): Promise<GraphObject>
```

### Capability & Mapping Operations

```typescript
// Execute capabilities
capability[capabilityName](args: JSONObject, config?: CapabilityConfig): Promise<OrArray<NodeObject>>

// Execute mappings
performMapping(
    args: JSONValue,
    mapping: OrArray<NodeObject>,
    frame?: Record<string, any>,
    capabilityConfig?: CapabilityConfig
): Promise<NodeObject>

// Execute triggers
executeTrigger(
    integration: string,
    payload: any
): Promise<void>
```

## Configuration Options

```typescript
interface SklEngineOptions {
    // Query Adapter type ('memory' | 'sparql')
    readonly type: QueryAdapterType;
    
    // SPARQL endpoint URL (required for type='sparql')
    readonly endpointUrl?: string;
    
    // SPARQL update endpoint URL (optional)
    readonly updateUrl?: string;
    
    // Enable auto-timestamping of entities
    readonly setTimestamps?: boolean;
    
    // Event callbacks
    readonly callbacks?: Callbacks;
    
    // Custom mapping functions
    readonly functions?: Record<string, (args: any | any[]) => any>;
    
    // Disable validation
    readonly disableValidation?: boolean;
    
    // Input files for mappings
    readonly inputFiles?: Record<string, string>;
    
    // Enable debug mode
    readonly debugMode?: boolean;
}
```

## Key Interfaces

### FindOptions

```typescript
interface FindOneOptions {
    select?: FindOptionsSelect;
    where?: FindOptionsWhere;
    relations?: FindOptionsRelations;
    order?: FindOptionsOrder;
    skipFraming?: boolean;
    group?: Variable;
}

interface FindAllOptions extends FindOneOptions {
    offset?: number;
    limit?: number;
    subQueries?: SubQuery[];
}
```

### GroupByOptions

```typescript
interface GroupByOptions {
    where?: FindOptionsWhere;
    groupBy?: string[];
    dateRange?: {
        start: string;
        end: string;
    };
    dateGrouping?: "month" | "day";
    limit?: number;
    offset?: number;
}
```

### CapabilityConfig

```typescript
interface CapabilityConfig {
    callbacks?: Callbacks;
    disableValidation?: boolean;
    inputFiles?: Record<string, string>;
    functions?: Record<string, (args: any | any[]) => any>;
}
```