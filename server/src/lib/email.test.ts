import { afterEach, describe, expect, test } from "bun:test";
import {
	buildSubject,
	previewLine,
	renderHtml,
	renderText,
	sendInvitation,
} from "./email";

const baseInput = {
	recipientEmail: "ann@example.com",
	recipientName: "Ann",
	giverName: "Sam",
	link: "https://ember.app/r/abc123",
};

describe("email body builders", () => {
	test("preview line uses the spec verbatim", () => {
		expect(previewLine("Ann")).toBe(
			"Ann — I made you something. Open when you have a quiet minute.",
		);
	});

	test("subject is warm, not transactional-sounding", () => {
		expect(buildSubject("Sam")).toBe("Sam sent you an Ember gift");
	});

	test("html body contains the recipient name, giver name, and link", () => {
		const html = renderHtml(baseInput);
		expect(html).toContain("Ann —");
		expect(html).toContain("Sam");
		expect(html).toContain("https://ember.app/r/abc123");
		expect(html).toContain("Open your gift");
		// Hidden preview line for mail clients.
		expect(html).toContain(
			"Ann — I made you something. Open when you have a quiet minute.",
		);
	});

	test("html escapes user-controlled fields", () => {
		const html = renderHtml({
			...baseInput,
			recipientName: "<script>alert(1)</script>",
			giverName: "Sam & Co",
		});
		expect(html).not.toContain("<script>alert(1)</script>");
		expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
		expect(html).toContain("Sam &amp; Co");
	});

	test("plain-text body matches the warm tone and includes the link on its own line", () => {
		const text = renderText(baseInput);
		expect(text).toContain("Ann —");
		expect(text).toContain(
			"I made you something. Open when you have a quiet minute.",
		);
		expect(text).toContain("\nhttps://ember.app/r/abc123\n");
		expect(text).toContain("Love,\nSam");
	});
});

describe("sendInvitation", () => {
	const realFetch = globalThis.fetch;

	afterEach(() => {
		globalThis.fetch = realFetch;
		delete process.env.EMAIL_PROVIDER_API_KEY;
	});

	test("returns {sent:false, no-api-key} without calling fetch when key is unset", async () => {
		delete process.env.EMAIL_PROVIDER_API_KEY;
		let calls = 0;
		globalThis.fetch = (async (
			_input: string | URL | Request,
			_init?: RequestInit,
		) => {
			calls++;
			return new Response("", { status: 200 });
		}) as unknown as typeof fetch;

		const outcome = await sendInvitation(baseInput);
		expect(outcome).toEqual({ sent: false, reason: "no-api-key" });
		expect(calls).toBe(0);
	});

	test("returns {sent:true} on a 200 from Resend", async () => {
		process.env.EMAIL_PROVIDER_API_KEY = "re_test_key";
		const captured: { url?: string; auth?: string | null } = {};
		globalThis.fetch = (async (
			input: string | URL | Request,
			init?: RequestInit,
		) => {
			const url = typeof input === "string" ? input : input.toString();
			captured.url = url;
			const headers = init?.headers as Record<string, string> | undefined;
			captured.auth = headers?.Authorization ?? null;
			return new Response(JSON.stringify({ id: "msg_123" }), {
				status: 200,
				headers: { "content-type": "application/json" },
			});
		}) as unknown as typeof fetch;

		const outcome = await sendInvitation(baseInput);
		expect(outcome).toEqual({ sent: true });
		expect(captured.url).toContain("api.resend.com/emails");
		expect(captured.auth).toBe("Bearer re_test_key");
	});

	test("throws on non-2xx from Resend", async () => {
		process.env.EMAIL_PROVIDER_API_KEY = "re_bad_key";
		globalThis.fetch = (async (
			_input: string | URL | Request,
			_init?: RequestInit,
		) =>
			new Response("invalid api key", { status: 401 })) as unknown as typeof fetch;

		await expect(sendInvitation(baseInput)).rejects.toThrow(/Resend 401/);
	});
});
