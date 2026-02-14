import { ApiError } from '@synqit/shared';

import { API_URL } from './constants';

export const toApiError = (value: unknown): ApiError => {
  if (value instanceof Error) {
    return {
      code: 'client_error',
      message: value.message,
    };
  }

  if (
    value &&
    typeof value === 'object' &&
    'code' in value &&
    typeof value.code === 'string' &&
    'message' in value &&
    typeof value.message === 'string'
  ) {
    return value as ApiError;
  }

  return {
    code: 'unknown_error',
    message: 'Unexpected error.',
  };
};

export const callApi = async <TResponse>(
  path: string,
  init: RequestInit,
  parser: (payload: unknown) => TResponse,
): Promise<TResponse> => {
  const hasBody = init.body !== undefined && init.body !== null;

  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      ...(hasBody ? { 'content-type': 'application/json' } : {}),
      ...(init.headers ?? {}),
    },
  });

  const payload = (await response.json().catch(() => ({}))) as unknown;
  if (!response.ok) {
    throw toApiError(payload);
  }

  return parser(payload);
};
