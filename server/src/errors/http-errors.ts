export class ValidationError extends Error {
  public readonly statusCode = 400;
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class UpstreamServiceError extends Error {
  public readonly statusCode = 502;
  constructor(message: string) {
    super(message);
    this.name = 'UpstreamServiceError';
  }
}
