import { createHash, createHmac, randomBytes, randomInt, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);

export function normalizeEmail(value) {
  const email = String(value || "").trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Enter a valid email address.");
  }
  return email;
}

export function createOtp(secret) {
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  return { code, codeHash: hashOtp(secret, code) };
}

export function hashOtp(secret, code) {
  return createHmac("sha256", secret).update(String(code)).digest("hex");
}

export function safeEqualHex(left, right) {
  if (!/^[\da-f]{64}$/i.test(left || "") || !/^[\da-f]{64}$/i.test(right || "")) return false;
  return timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
}

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const key = await scrypt(String(password), salt, 64);
  return `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
}

export async function verifyPassword(password, encoded) {
  const [algorithm, saltHex, keyHex, extra] = String(encoded || "").split("$");
  if (algorithm !== "scrypt" || !/^[\da-f]{32}$/i.test(saltHex || "") || !/^[\da-f]{128}$/i.test(keyHex || "") || extra) {
    return false;
  }
  const expected = Buffer.from(keyHex, "hex");
  const actual = await scrypt(String(password), Buffer.from(saltHex, "hex"), expected.length);
  return timingSafeEqual(actual, expected);
}

export function createPasswordResetToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashResetToken(token) };
}

export function hashResetToken(token) {
  return createHash("sha256").update(String(token)).digest("hex");
}

export function createSessionToken(userId, secret, now = Date.now(), lifetimeMs = 7 * 24 * 60 * 60 * 1000) {
  const payload = Buffer.from(JSON.stringify({
    sub: String(userId),
    iat: Math.floor(now / 1000),
    exp: Math.floor((now + lifetimeMs) / 1000)
  })).toString("base64url");
  const input = `mfs1.${payload}`;
  const signature = createHmac("sha256", secret).update(input).digest("base64url");
  return `${input}.${signature}`;
}

export function verifySessionToken(token, secret, now = Date.now()) {
  if (typeof token !== "string" || token.length > 2048) return null;
  const [version, payload, signature, extra] = token.split(".");
  if (version !== "mfs1" || !payload || !signature || extra) return null;
  const expected = createHmac("sha256", secret).update(`${version}.${payload}`).digest();
  let actual;
  try {
    actual = Buffer.from(signature, "base64url");
  } catch {
    return null;
  }
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (typeof claims.sub !== "string" || !claims.sub || !Number.isInteger(claims.exp) || claims.exp <= Math.floor(now / 1000)) return null;
    return claims;
  } catch {
    return null;
  }
}
