/**
 * User-facing copy for HTTP 429 using Retry-After header and/or JSON retryAfterSeconds.
 */
export function messageFor429Response(res: Response, body: unknown): string {
  let seconds: number | null = null;
  const header = res.headers.get('Retry-After');
  if (header) {
    const n = parseInt(header, 10);
    if (Number.isFinite(n) && n >= 0) seconds = n;
  }
  if (seconds === null && body && typeof body === 'object' && body !== null && 'retryAfterSeconds' in body) {
    const n = Number((body as { retryAfterSeconds: unknown }).retryAfterSeconds);
    if (Number.isFinite(n) && n >= 0) seconds = n;
  }

  const err =
    body && typeof body === 'object' && body !== null && typeof (body as { error?: unknown }).error === 'string'
      ? (body as { error: string }).error.trim()
      : '';

  const isGenerationLimit = /generation/i.test(err);

  if (seconds === null || seconds <= 0) {
    return err || 'Too many attempts; please try again in a few minutes.';
  }

  const minutes = Math.max(1, Math.ceil(seconds / 60));
  const label = isGenerationLimit ? 'Too many generation requests' : 'Too many attempts';
  if (minutes === 1) {
    return `${label}; try again in about 1 minute.`;
  }
  return `${label}; try again in about ${minutes} minutes.`;
}

/** Prefer 429 formatting when status is 429; otherwise return JSON error or fallback. */
export function errorMessageFromApi(res: Response, body: unknown, fallback: string): string {
  if (res.status === 429) {
    return messageFor429Response(res, body);
  }
  if (body && typeof body === 'object' && body !== null && typeof (body as { error?: unknown }).error === 'string') {
    return (body as { error: string }).error;
  }
  return fallback;
}
