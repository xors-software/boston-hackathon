import { randomBytes } from "node:crypto";

export function genId(prefix: string): string {
	return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

// Cryptographically random — used for unguessable recipient access
// tokens (token IS the auth, no session). 24 bytes → 32 base64url chars.
export function genToken(): string {
	return randomBytes(24).toString("base64url");
}
