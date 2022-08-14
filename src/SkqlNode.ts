/* eslint-disable import/no-unresolved */
import { OpenApiOperationExecutor } from '@comake/openapi-operation-executor';
import { setOpenApiOperationExecutor } from './OpenApiOperationExecutor';
setOpenApiOperationExecutor(OpenApiOperationExecutor);
export * from './Skql';
