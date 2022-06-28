export async function executeSequentially(
  arrayOfFnWrappedPromises: (() => Promise<any>)[],
  returnedValues: any[] = [],
): Promise<any[]> {
  const firstPromise = arrayOfFnWrappedPromises.shift();
  if (firstPromise) {
    return firstPromise()
      .then((returnValue: any): Promise<any[]> => {
        returnedValues.push(returnValue);
        return executeSequentially(arrayOfFnWrappedPromises, returnedValues);
      });
  }

  return Promise.resolve(returnedValues);
}
