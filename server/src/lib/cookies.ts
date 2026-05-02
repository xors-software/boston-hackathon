// Tiny cookie helpers shared across routes. Avoids a dependency on a
// cookie-parsing package — Elysia gives us raw Headers and that's all we
// need for an HttpOnly session cookie set by the Next.js /oauth callback.

export function parseCookies(
	header: string | null | undefined,
): Record<string, string> {
	if (!header) return {};
	const out: Record<string, string> = {};
	for (const piece of header.split(";")) {
		const eq = piece.indexOf("=");
		if (eq === -1) continue;
		const k = piece.slice(0, eq).trim();
		const v = piece.slice(eq + 1).trim();
		if (!k) continue;
		try {
			out[k] = decodeURIComponent(v);
		} catch {
			out[k] = v;
		}
	}
	return out;
}

export function readCookie(headers: Headers, name: string): string | null {
	return parseCookies(headers.get("cookie"))[name] ?? null;
}
