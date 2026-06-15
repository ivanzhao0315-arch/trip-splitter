const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function normalizeProjectCode(value) {
  return String(value ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 4);
}

export function createProjectCode(random = Math.random) {
  return Array.from({ length: 4 }, () => {
    const index = Math.floor(random() * CODE_ALPHABET.length);
    return CODE_ALPHABET[index];
  }).join('');
}
