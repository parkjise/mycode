const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

export function parseAnswerIds(value) {
  if (!Array.isArray(value) || value.length === 0 || value.length > 100) return null;
  if (!value.every((id) => typeof id === 'string' && uuid.test(id))) return null;
  return [...new Set(value.map((id) => id.toLowerCase()))];
}
