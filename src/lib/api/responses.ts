export function jsonResponse(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

export function errorResponse(message: string, status = 400): Response {
  return Response.json({ error: message }, { status });
}
