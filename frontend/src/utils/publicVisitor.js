const PUBLIC_VISITOR_KEY = 'synthosite_public_visitor_id';

export function getPublicVisitorId() {
  const existingId = localStorage.getItem(PUBLIC_VISITOR_KEY);

  if (existingId) {
    return existingId;
  }

  const nextId = globalThis.crypto?.randomUUID
    ? globalThis.crypto.randomUUID()
    : `visitor-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  localStorage.setItem(PUBLIC_VISITOR_KEY, nextId);
  return nextId;
}
