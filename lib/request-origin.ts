/** Next's local server can normalize request.url to localhost while keeping Host. */
export function isSameOriginRequest(request: Request): boolean {
  const url = new URL(request.url);
  const host = request.headers.get("host") ?? url.host;
  return request.headers.get("origin") === `${url.protocol}//${host}`;
}
