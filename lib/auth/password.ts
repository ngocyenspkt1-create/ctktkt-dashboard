import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const KEY_LENGTH = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, KEY_LENGTH).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, KEY_LENGTH);
  const expected = Buffer.from(hash, "hex");
  if (candidate.length !== expected.length) return false;
  return timingSafeEqual(candidate, expected);
}

export const PASSWORD_MIN_LENGTH = 8;

// Common passwords, including the former shared defaults that were once committed to the repository.
const COMMON_PASSWORDS = new Set([
  "password", "password1", "password12", "password123", "password1234", "passw0rd",
  "12345678", "123456789", "1234567890", "123123123", "11111111", "00000000", "abc12345", "abcd1234",
  "qwerty123", "qwertyuiop", "admin123", "admin1234", "matkhau123", "matkhau", "123456aa", "aa123456",
  "duyenhai1", "duyenhai123", "pxvh1234", "pxvh12345", "tpc123456",
]);

/** Returns a Vietnamese error message, or null when the password is acceptable. */
export function validateNewPassword(password: string, username = ""): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) return `Mật khẩu phải có ít nhất ${PASSWORD_MIN_LENGTH} ký tự.`;
  if (password.length > 128) return "Mật khẩu quá dài.";
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return "Mật khẩu phải có cả chữ và số.";
  const lower = password.toLowerCase();
  if (COMMON_PASSWORDS.has(lower)) return "Mật khẩu quá phổ biến, hãy chọn mật khẩu khác.";
  const name = username.trim().toLowerCase();
  if (name && lower.includes(name)) return "Mật khẩu không được chứa tên đăng nhập.";
  return null;
}

/** A password that would not be accepted today must be replaced after login. */
export function requiresPasswordChange(password: string, username: string): boolean {
  return validateNewPassword(password, username) !== null;
}
