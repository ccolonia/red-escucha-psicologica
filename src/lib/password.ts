import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;

/**
 * Hash a plaintext password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Compare a plaintext password against a hashed password
 */
export async function comparePassword(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

/**
 * Check if a password is already hashed (bcrypt hashes start with $2a$, $2b$, or $2y$)
 */
export function isHashed(password: string): boolean {
  return /^\$2[aby]\$\d{2}\$/.test(password);
}
