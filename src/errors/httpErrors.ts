
import { AppError } from './AppError';

export class BadRequestError extends AppError {
  constructor(message = 'Bad Request', errors?: any[]) {
    super(message, 400, true, errors);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401, true);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, 403, true);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`, 404, true);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Resource already exists') {
    super(message, 409, true);
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation failed', errors?: any[]) {
    super(message, 422, true, errors);
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message = 'Too many requests, please try again later') {
    super(message, 429, true);
  }
}

export class InternalServerError extends AppError {
  constructor(message = 'Internal server error') {
    super(message, 500, false);
  }
}