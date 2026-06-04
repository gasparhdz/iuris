import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";
import { env } from "../env.js";

const ALGORITHM = "aes-256-gcm";
const CURRENT_KEY_ID = "v1";
const HKDF_INFO = Buffer.from("iuris:sisfe-session:v1", "utf8");
const HKDF_SALT = Buffer.from("iuris:sisfe-session", "utf8");

type SisfeCryptoContext = {
  usuarioId: number;
  estudioId: number;
};

type DecryptResult = {
  plaintext: string;
  needsReencrypt: boolean;
};

function aadForContext(context: SisfeCryptoContext) {
  return Buffer.from(`sisfe:${context.usuarioId}:${context.estudioId}`, "utf8");
}

function getCurrentKey() {
  const masterKey = Buffer.from(env.ENCRYPTION_KEY, "base64");
  return Buffer.from(hkdfSync("sha256", masterKey, HKDF_SALT, HKDF_INFO, 32));
}

function getLegacyKeys() {
  const keys: Buffer[] = [];
  if (env.ENCRYPTION_KEY_LEGACY) {
    const legacy = env.ENCRYPTION_KEY_LEGACY;
    const decoded = Buffer.from(legacy, "base64");
    if (decoded.length === 32) keys.push(decoded);
    if (Buffer.byteLength(legacy, "utf8") === 32) keys.push(Buffer.from(legacy, "utf8"));
  }
  return keys;
}

export function encrypt(text: string, context: SisfeCryptoContext): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, getCurrentKey(), iv);
  cipher.setAAD(aadForContext(context));
  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [CURRENT_KEY_ID, iv.toString("base64"), authTag.toString("base64"), encrypted.toString("base64")].join(":");
}

export function decrypt(ciphertext: string, context: SisfeCryptoContext): DecryptResult {
  const parts = ciphertext.split(":");

  if (parts.length === 4) {
    const [keyId, ivRaw, authTagRaw, encryptedRaw] = parts;
    if (keyId !== CURRENT_KEY_ID || !ivRaw || !authTagRaw || !encryptedRaw) {
      throw new Error("INVALID_CIPHERTEXT");
    }

    return {
      plaintext: decryptWithKey(getCurrentKey(), ivRaw, authTagRaw, encryptedRaw, aadForContext(context)),
      needsReencrypt: false,
    };
  }

  if (parts.length === 3) {
    const [ivRaw, authTagRaw, encryptedRaw] = parts;
    if (!ivRaw || !authTagRaw || !encryptedRaw) {
      throw new Error("INVALID_CIPHERTEXT");
    }

    for (const legacyKey of getLegacyKeys()) {
      try {
        return {
          plaintext: decryptWithKey(legacyKey, ivRaw, authTagRaw, encryptedRaw),
          needsReencrypt: true,
        };
      } catch {
        // Try the next configured legacy key.
      }
    }
  }

  throw new Error("INVALID_CIPHERTEXT");
}

function decryptWithKey(key: Buffer, ivRaw: string, authTagRaw: string, encryptedRaw: string, aad?: Buffer) {
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivRaw, "base64"));
  if (aad) decipher.setAAD(aad);
  decipher.setAuthTag(Buffer.from(authTagRaw, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedRaw, "base64")),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}
