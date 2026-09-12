/**
 * Generates a unique UUID (v4).
 * Uses crypto.randomUUID() if available (secure contexts/localhost),
 * otherwise falls back to a math-based generator for insecure contexts (non-HTTPS network IPs).
 */
export const generateUUID = (): string => {
  // Use crypto.randomUUID if available
  if (typeof window !== 'undefined' && window.crypto && typeof window.crypto.randomUUID === 'function') {
    return window.crypto.randomUUID();
  }

  // Fallback for insecure contexts (HTTP / Network IP)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};
