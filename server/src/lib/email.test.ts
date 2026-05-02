import { describe, expect, test } from "bun:test";
import {
	buildSubject,
	previewLine,
	renderHtml,
	renderText,
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
