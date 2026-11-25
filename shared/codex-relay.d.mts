export const codexRelayConfig: { config: { private: true; broadcast: { ack: true } } };
export function codexRelayTopic(userId: string): string;
export function readLlmRequest(text: string): string | null;
export function encryptRelayQuestion(text: string, recipientKey: string, id: string): Promise<{
  publicKey: string;
  nonce: string;
  ciphertext: string;
}>;
