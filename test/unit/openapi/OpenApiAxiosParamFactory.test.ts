import { OpenApiAxiosParamFactory } from '../../../src/openapi/OpenApiAxiosParamFactory';

describe('An OpenApiAxiosParamFactory', (): void => {
  const pathName = '/example/api/path';
  const pathReqMethod = 'GET';
  let operation: any;
  let configuration: any;
  let openApiAxiosParamFactory: OpenApiAxiosParamFactory;

  beforeEach(async(): Promise<void> => {
    operation = {
      responses: {},
      operationId: 'testOperation',
    };
    configuration = {};
  });

  it('creates a RequestParams object.', async(): Promise<void> => {
    configuration.baseOptions = {
      responseType: 'json',
      headers: { token: 'abcd' },
    };
    openApiAxiosParamFactory = new OpenApiAxiosParamFactory(
      { ...operation, pathName, pathReqMethod },
      configuration,
    );
    const response = await openApiAxiosParamFactory.createParams({ foo: 'bar' });
    expect(response).toBeInstanceOf(Object);
    expect(response.url).not.toBeNull();
    expect(response.url).toBe(pathName);
    expect(response.options).not.toBeNull();
    expect(response.options).toEqual({
      method: pathReqMethod,
      responseType: 'json',
      headers: {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        'Content-Type': 'application/json',
        token: 'abcd',
      },
      data: '{"foo":"bar"}',
    });
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

  it('adds a serialized representation of the args in the data field.',
    async(): Promise<void> => {
      openApiAxiosParamFactory = new OpenApiAxiosParamFactory(
        { ...operation, pathName, pathReqMethod },
        configuration,
      );
      const response = await openApiAxiosParamFactory.createParams({ foo: 'bar' });
      expect(response.options.data).toBe('{"foo":"bar"}');
    });
});
