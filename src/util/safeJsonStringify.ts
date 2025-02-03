// Preserve the native JSON.stringify
const nativeJSONStringify = JSON.stringify;

function stringifyCircular(obj: any) {
  const seen = new WeakSet();
  return nativeJSONStringify(obj, (key, value) => {
    if (value !== null && typeof value === 'object') {
      if (seen.has(value)) {
        // Circular reference found, discard key
        return;
      }
      seen.add(value);
    }
    return value;
  });
}

global.JSON.stringify = stringifyCircular;
JSON.stringify = stringifyCircular;