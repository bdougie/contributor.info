import { assertEquals, assert } from 'https://deno.land/std@0.177.0/testing/asserts.ts';
import {
  successResponse,
  errorResponse,
  validationError,
  notFoundError,
  unauthorizedError,
  forbiddenError,
  rateLimitError,
  corsPreflightResponse,
  legacySuccessResponse,
  handleError,
} from './responses.ts';
import { createTestRequest, assertSuccessResponse, assertErrorResponse } from '../tests/setup.ts';

Deno.test('successResponse - returns JSON response with success flag', async () => {
  const data = { message: 'Success' };
  const response = successResponse(data);

  assertEquals(response.status, 200);
  assertEquals(response.headers.get('Content-Type'), 'application/json');
  assert(response.headers.get('Access-Control-Allow-Origin'));

  const body = await response.json();
  assertEquals(body.success, true);
  assertEquals(body.data, data);
});

Deno.test('successResponse - accepts custom status code', async () => {
  const response = successResponse({ created: true }, 'Created', 201);
  assertEquals(response.status, 201);
  
  const body = await response.json();
  assertEquals(body.message, 'Created');
});

Deno.test('successResponse - handles optional parameters', async () => {
  const response = successResponse();
  assertEquals(response.status, 200);
  
  const body = await response.json();
  assertEquals(body.success, true);
  assertEquals(body.data, undefined);
});

Deno.test('successResponse - includes meta data', async () => {
  const meta = { requestId: '123', timing: 500 };
  const response = successResponse({ test: true }, 'Success', 200, meta);
  
  const body = await response.json();
  assertEquals(body.meta, meta);
});

Deno.test('errorResponse - returns JSON response with error', async () => {
  const errorMessage = 'Something went wrong';
  const response = errorResponse(errorMessage, 400);

  assertEquals(response.status, 400);
  assertEquals(response.headers.get('Content-Type'), 'application/json');

  const body = await response.json();
  assertEquals(body.success, false);
  assertEquals(body.error, errorMessage);
});

Deno.test('errorResponse - includes optional details and code', async () => {
  const response = errorResponse('Test error', 400, 'More details', 'TEST_ERROR');

  const body = await response.json();
  assertEquals(body.details, 'More details');
  assertEquals(body.code, 'TEST_ERROR');
});

Deno.test('validationError - returns 400 with validation code', async () => {
  const response = validationError('Invalid input', 'Field is required');
  assertEquals(response.status, 400);
  
  const body = await response.json();
  assertEquals(body.code, 'VALIDATION_ERROR');
  assertEquals(body.details, 'Field is required');
});

Deno.test('notFoundError - returns 404 with not found message', async () => {
  const response = notFoundError('User', 'User with ID 123 not found');
  assertEquals(response.status, 404);
  
  const body = await response.json();
  assertEquals(body.error, 'User not found');
  assertEquals(body.code, 'NOT_FOUND');
});

Deno.test('unauthorizedError - returns 401 with unauthorized code', async () => {
  const response = unauthorizedError('Token expired');
  assertEquals(response.status, 401);
  
  const body = await response.json();
  assertEquals(body.error, 'Token expired');
  assertEquals(body.code, 'UNAUTHORIZED');
});

Deno.test('forbiddenError - returns 403 with forbidden code', async () => {
  const response = forbiddenError('Access denied');
  assertEquals(response.status, 403);
  
  const body = await response.json();
  assertEquals(body.error, 'Access denied');
  assertEquals(body.code, 'FORBIDDEN');
});

Deno.test('rateLimitError - returns 429 with rate limit code', async () => {
  const response = rateLimitError(3600);
  assertEquals(response.status, 429);
  assertEquals(response.headers.get('Retry-After'), '3600');
  
  const body = await response.json();
  assertEquals(body.code, 'RATE_LIMIT_EXCEEDED');
  assertEquals(body.meta?.retryAfter, 3600);
});

Deno.test('rateLimitError - works without retry after', async () => {
  const response = rateLimitError();
  assertEquals(response.status, 429);
  assertEquals(response.headers.get('Retry-After'), null);
  
  const body = await response.json();
  assertEquals(body.code, 'RATE_LIMIT_EXCEEDED');
});

Deno.test('corsPreflightResponse - returns OPTIONS response', () => {
  const response = corsPreflightResponse();
  assertEquals(response.status, 200);
  assert(response.headers.has('Access-Control-Allow-Origin'));
});

Deno.test('legacySuccessResponse - spreads payload at top level', async () => {
  const payload = { processed: 5, errors: 0 };
  const response = legacySuccessResponse(payload, 'Completed');
  
  const body = await response.json();
  assertEquals(body.success, true);
  assertEquals(body.processed, 5);
  assertEquals(body.errors, 0);
  assertEquals(body.message, 'Completed');
});

Deno.test('handleError - wraps Error objects', async () => {
  const error = new Error('Test error');
  const response = handleError(error, 'test operation', 400);
  
  assertEquals(response.status, 400);
  const body = await response.json();
  assertEquals(body.error, 'test operation failed');
  assertEquals(body.details, 'Test error');
  assertEquals(body.code, 'OPERATION_FAILED');
});

Deno.test('handleError - handles non-Error objects', async () => {
  const error = 'string error';
  const response = handleError(error, 'test operation');
  
  assertEquals(response.status, 500);
  const body = await response.json();
  assertEquals(body.error, 'test operation failed');
  assertEquals(body.details, 'string error');
});