import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // GCM standard IV length is 12 bytes
const SALT_OR_KEY = process.env.SETTLEMENT_ENCRYPTION_KEY || "modelbeauty_default_secret_key_32"; // must be 32 bytes

// Ensure the key is exactly 32 bytes for aes-256
function getEncryptionKey(): Buffer {
  const key = SALT_OR_KEY;
  if (key.length >= 32) {
    return Buffer.from(key.substring(0, 32), "utf-8");
  }
  // Pad with zeroes if too short
  return Buffer.alloc(32, key, "utf-8");
}

/**
 * Encrypt plain text using AES-256-GCM
 */
export function encryptText(text: string): string {
  if (!text) return "";
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  
  const authTag = cipher.getAuthTag().toString("hex");
  
  // Return format: iv:authTag:encryptedText
  return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}

/**
 * Decrypt cipher text using AES-256-GCM
 */
export function decryptText(cipherText: string): string {
  if (!cipherText) return "";
  try {
    const parts = cipherText.split(":");
    if (parts.length !== 3) {
      // If it's not encrypted (e.g. legacy or wrong format), return as is
      return cipherText;
    }
    
    const [ivHex, authTagHex, encryptedHex] = parts;
    const key = getEncryptionKey();
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const encryptedText = Buffer.from(encryptedHex, "hex");
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encryptedText, undefined, "utf8");
    decrypted += decipher.final("utf8");
    
    return decrypted;
  } catch (err) {
    console.error("Failed to decrypt text:", err);
    return "DECRYPTION_ERROR";
  }
}

/**
 * Mask resident registration number: e.g. 950101-1234567 -> 950101-1******
 */
export function maskResidentNumber(rrn: string): string {
  if (!rrn) return "";
  const clean = rrn.replace(/[^0-9-]/g, "");
  if (clean.includes("-")) {
    const [front, back] = clean.split("-");
    if (back && back.length > 0) {
      return `${front}-${back[0]}******`;
    }
    return front;
  }
  if (clean.length >= 7) {
    return `${clean.substring(0, 6)}-${clean[6]}******`;
  }
  return clean;
}

/**
 * Mask bank account number: e.g. 123-456-789012 -> 123-***-****12
 */
export function maskAccountNumber(acc: string): string {
  if (!acc) return "";
  const len = acc.length;
  if (len <= 4) return acc;
  // Mask middle characters
  const visibleStart = Math.min(3, Math.floor(len / 4));
  const visibleEnd = Math.min(4, Math.floor(len / 3));
  const start = acc.substring(0, visibleStart);
  const end = acc.substring(len - visibleEnd);
  const masked = "*".repeat(len - visibleStart - visibleEnd);
  return `${start}${masked}${end}`;
}
