/**
 * Lives apart from `api-client` so `mock-api` can throw it without the two
 * modules importing each other in a cycle. Re-exported from `api-client`,
 * which is where callers should import it from.
 */
export class ApiRequestError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
