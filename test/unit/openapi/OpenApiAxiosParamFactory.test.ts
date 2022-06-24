import { OpenApiAxiosParamFactory } from '../../../src/openapi/OpenApiAxiosParamFactory';

describe('An OpenApiAxiosParamFactory', (): void => {
  const pathName = '/example/api/path';
  const pathReqMethod = 'GET';
  const operation: any = {
    responses: {},
    operationId: 'testOperation',
  };
  const configuration: any = {};
  let openApiAxiosParamFactory: OpenApiAxiosParamFactory;

  it('creates a RequestParams object.', async(): Promise<void> => {
    openApiAxiosParamFactory = new OpenApiAxiosParamFactory(
      { ...operation, pathName, pathReqMethod },
      configuration,
    );
    const response = await openApiAxiosParamFactory.createParams();
    expect(response).toBeInstanceOf(Object);
    expect(response.url).not.toBeNull();
    expect(response.url).toBe(pathName);
    expect(response.options).not.toBeNull();
    expect(response.options).toHaveProperty('method');
    expect(response.options.method).toBe(pathReqMethod);
    expect(response.options).toHaveProperty('headers');
  });

  it('sets the Content-Type header to application/json.', async(): Promise<void> => {
    openApiAxiosParamFactory = new OpenApiAxiosParamFactory(
      { ...operation, pathName, pathReqMethod },
      configuration,
    );
    const response = await openApiAxiosParamFactory.createParams();
    // eslint-disable-next-line @typescript-eslint/naming-convention
    expect(response.options.headers).toEqual({ 'Content-Type': 'application/json' });
  });

  it('does not add the Authorization header if oAuth security scopes or an accessToken are not specified.',
    async(): Promise<void> => {
      openApiAxiosParamFactory = new OpenApiAxiosParamFactory(
        { ...operation, pathName, pathReqMethod },
        configuration,
      );
      const response = await openApiAxiosParamFactory.createParams();
      expect(response.options.headers?.Authorization).toBeUndefined();
    });

  it('adds the Authorization header if oAuth security scopes and an accessToken are specified.',
    async(): Promise<void> => {
      operation.security = [{ oAuth: 'example/scope' }];
      configuration.accessToken = '12345';
      openApiAxiosParamFactory = new OpenApiAxiosParamFactory(
        { ...operation, pathName, pathReqMethod },
        configuration,
      );
      const response = await openApiAxiosParamFactory.createParams();
      expect(response.options.headers?.Authorization).toBe('Bearer 12345');
    });

  it('adds the Authorization header if oAuth security scopes and an accessToken function are specified.',
    async(): Promise<void> => {
      operation.security = [{ oAuth: 'example/scope' }];
      configuration.accessToken = (): string => '12345';
      openApiAxiosParamFactory = new OpenApiAxiosParamFactory(
        { ...operation, pathName, pathReqMethod },
        configuration,
      );
      const response = await openApiAxiosParamFactory.createParams();
      expect(response.options.headers?.Authorization).toBe('Bearer 12345');
    });

  it('adds the configuration\'s baseOptions to the request options.', async(): Promise<void> => {
    configuration.baseOptions = {
      responseType: 'json',
      headers: { token: 'abcd' },
    };
    openApiAxiosParamFactory = new OpenApiAxiosParamFactory(
      { ...operation, pathName, pathReqMethod },
      configuration,
    );
    const response = await openApiAxiosParamFactory.createParams();
    expect(response.options.responseType).toBe('json');
    expect(response.options.headers?.token).toBe('abcd');
  });

  it('overrides the configuration\'s baseOptions with the supplied options.',
    async(): Promise<void> => {
      configuration.baseOptions = {
        responseType: 'json',
        headers: { token: 'abcd' },
      };
      openApiAxiosParamFactory = new OpenApiAxiosParamFactory(
        { ...operation, pathName, pathReqMethod },
        configuration,
      );
      const response = await openApiAxiosParamFactory.createParams(
        {},
        { responseType: 'blob', headers: { token: 'fghi' }},
      );
      expect(response.options.responseType).toBe('blob');
      expect(response.options.headers?.token).toBe('fghi');
    });

  it('adds a serialized representation of the args.',
    async(): Promise<void> => {
      openApiAxiosParamFactory = new OpenApiAxiosParamFactory(
        { ...operation, pathName, pathReqMethod },
        configuration,
      );
      const response = await openApiAxiosParamFactory.createParams({ foo: 'bar' });
      expect(response.options.data).toBe('{"foo":"bar"}');
    });
});
