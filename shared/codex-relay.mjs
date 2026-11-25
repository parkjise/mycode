const encoder = new TextEncoder();
const maxQuestionBytes = 100 * 1024;
export const codexRelayConfig = { config: { private: true, broadcast: { ack: true } } };
export const codexRelayTopic = (userId) => `mycode-codex:${userId}`;
export const relayId = (id) => typeof id === 'string' && /^[0-9a-f-]{36}$/i.test(id);

export function readLlmRequest(text) {
  const marker = /^\s*llm[ \t]*(?:\r\n?|\n|$)/.exec(text);
  return marker ? text.slice(marker[0].length) : null;
}

function encode(buffer) {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 8192;
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}
const decode = (value) => Uint8Array.from(atob(value), (character) => character.charCodeAt(0));

export async function createRelayKeys() {
  const pair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveKey']);
  return {
    privateKey: pair.privateKey,
    publicKey: encode(await crypto.subtle.exportKey('raw', pair.publicKey)),
  };
}

async function sharedKey(privateKey, publicKey) {
  if (typeof publicKey !== 'string' || publicKey.length !== 88) throw new Error('Invalid relay key');
  const publicPeer = await crypto.subtle.importKey('raw', decode(publicKey), { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  return crypto.subtle.deriveKey({ name: 'ECDH', public: publicPeer }, privateKey, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

export async function encryptRelayQuestion(text, recipientKey, id, publish = false) {
  const bytes = encoder.encode(text);
  if (!bytes.length || bytes.length > maxQuestionBytes) throw new Error('질문은 100KB 이내로 붙여넣어 주세요.');
  const sender = await createRelayKeys();
  const key = await sharedKey(sender.privateKey, recipientKey);
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const additionalData = encoder.encode(publish ? `${id}:publish` : id);
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce, additionalData }, key, bytes);
  return { publicKey: sender.publicKey, nonce: encode(nonce), ciphertext: encode(data), ...(publish ? { publish: true } : {}) };
}

export async function decryptRelayQuestion(privateKey, packet) {
  const { id, nonce, ciphertext, publicKey, publish } = packet;
  if (!relayId(id) || typeof nonce !== 'string' || nonce.length !== 16 ||
    typeof ciphertext !== 'string' || ciphertext.length > Math.ceil((maxQuestionBytes + 16) / 3) * 4) {
    throw new Error('Invalid relay packet');
  }
  const key = await sharedKey(privateKey, publicKey);
  const additionalData = encoder.encode(publish === true ? `${id}:publish` : id);
  const data = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: decode(nonce), additionalData }, key, decode(ciphertext));
  if (!data.byteLength || data.byteLength > maxQuestionBytes) throw new Error('Invalid relay question size');
  return new TextDecoder().decode(data);
}
