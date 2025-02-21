# SHACL Shapes Validation Guide

## Overview

SHACL (Shapes Constraint Language) validation occurs at multiple points in the system:
1. Entity validation during CRUD operations
2. Capability input validation
3. Capability output validation
4. Mapping result validation

## Validation Points

### 1. Entity CRUD Validation

```typescript
// During save operation
await engine.save({
  '@id': 'user1',
  '@type': 'User',
  name: 'John Doe',
  email: 'john@example.com'
});
```

Validates:
- Entity matches its type's shape
- Required properties present
- Property types correct
- Property constraints satisfied
- Parent type constraints satisfied

### 2. Capability Input Validation

```typescript
// In capability definition
{
  "@type": "skl:Capability",
  "skl:inputs": {
    "@type": "sh:NodeShape",
    "sh:property": [...]
  }
}
```

Validates:
- Input parameters structure
- Required parameters present
- Parameter types match
- Complex constraints satisfied

### 3. Capability Output Validation

```typescript
// In capability definition
{
  "@type": "skl:Capability",
  "skl:outputs": {
    "@type": "sh:NodeShape",
    "sh:property": [...]
  }
}
```

Validates:
- Output structure matches shape
- Required fields present
- Type constraints satisfied
- Business rules enforced

## SHACL Shape Components

### 1. Node Shapes
```typescript
interface NodeShape {
  '@type': typeof SHACL.NodeShape;
  [SKL_V2.label]?: ValueObject<string>;
  [SHACL.property]: OrArray<PropertyShape>;
  [SHACL.targetClass]?: ShaclIRI;
}
```

### 2. Property Shapes
```typescript
interface PropertyShape {
  [SHACL.path]: PathTypes;
  [SHACL.datatype]?: ShaclIRI;
  [SHACL.node]?: OrArray<NodeShape>;
  [SHACL.minCount]?: ValueObject<number>;
  [SHACL.maxCount]?: ValueObject<number>;
  [SHACL.class]?: OrArray<ShaclIRI>;
}
```

## Common Shape Patterns

### 1. Basic Property Validation
```json
{
  "@type": "sh:NodeShape",
  "sh:targetClass": "User",
  "sh:property": [
    {
      "sh:path": "name",
      "sh:datatype": "xsd:string",
      "sh:minCount": 1,
      "sh:maxCount": 1
    }
  ]
}
```

### 2. Complex Type Validation
```json
{
  "@type": "sh:NodeShape",
  "sh:property": [
    {
      "sh:path": "address",
      "sh:node": {
        "sh:property": [
          {
            "sh:path": "street",
            "sh:datatype": "xsd:string"
          },
          {
            "sh:path": "city",
            "sh:datatype": "xsd:string"
          }
        ]
      }
    }
  ]
}
```

### 3. Enumeration Validation
```json
{
  "sh:property": [
    {
      "sh:path": "status",
      "sh:in": {
        "@list": ["active", "pending", "inactive"]
      }
    }
  ]
}
```

## Mapping Considerations

### 1. Type Preservation
```typescript
// Mapping must preserve required types
const mapping = {
  outputsMapping: {
    "@type": "User",  // Must match shape's targetClass
    "name": "$.userName",  // Must produce string
    "age": "$.userAge"    // Must produce integer
  }
};
```

### 2. Cardinality Handling
```typescript
// Handle array vs single value correctly
const mapping = {
  outputsMapping: {
    "tags": "$.categories[*]",  // Produces array
    "email": "$.primaryEmail"   // Produces single value
  }
};
```

### 3. Required Fields
```typescript
// Ensure required fields are always mapped
const mapping = {
  outputsMapping: {
    "@type": "User",
    "id": "$.userId",      // Required
    "name": "$.userName",  // Required
    "avatar": "$.image"    // Optional
  }
};
```

## Best Practices

### 1. Shape Design
- Keep shapes focused and specific
- Use inheritance for common patterns
- Document constraints clearly
- Version shapes with capabilities

### 2. Validation Strategy
- Validate early in process
- Fail fast on invalid data
- Provide clear error messages
- Log validation failures

### 3. Mapping Alignment
- Match shape structure
- Handle all required fields
- Preserve data types
- Consider null cases

### 4. Performance
- Minimize shape complexity
- Reuse common shapes
- Cache validation results
- Monitor validation time

## Common Validation Issues

### 1. Type Mismatches
```typescript
// Shape expects
{
  "age": { "sh:datatype": "xsd:integer" }
}

// Mapping produces
{
  "age": "25" // String instead of integer
}
```

### 2. Missing Required Fields
```typescript
// Shape requires
{
  "email": { "sh:minCount": 1 }
}

// Mapping missing field
{
  "name": "John" // Missing required email
}
```

### 3. Cardinality Violations
```typescript
// Shape expects single value
{
  "name": { "sh:maxCount": 1 }
}

// Mapping produces array
{
  "name": ["John", "Johnny"] // Multiple values
}
```

## Debugging Validation

### 1. Enable Debug Mode
```typescript
const engine = new SKLEngine({
  debugMode: true
});
```

### 2. Check Validation Reports
```typescript
try {
  await engine.save(entity);
} catch (error) {
  console.log('Validation Report:', error.message);
}
```

### 3. Test Shape Constraints
```typescript
const report = await engine.validateAgainstShape(
  data,
  shape
);
console.log('Validation Results:', report);
```

## Shape Testing Tips

1. Test with valid data
2. Test with invalid data
3. Test edge cases
4. Test null/undefined
5. Test type conversions
6. Test cardinality
7. Test inheritance
8. Test complex constraints

## Performance Tips

1. **Shape Design**
   - Minimize nested shapes
   - Use simple constraints
   - Avoid complex patterns
   - Cache common shapes

2. **Validation Strategy**
   - Validate at right level
   - Batch validations
   - Reuse results
   - Monitor performance

3. **Error Handling**
   - Clear error messages
   - Structured reports
   - Actionable feedback
   - Logging strategy