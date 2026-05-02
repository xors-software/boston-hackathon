import { describe, expect, it } from "bun:test";
import { parseCookies, readCookie } from "./cookies";

describe("parseCookies", () => {
	it("returns {} for null/empty headers", () => {
		expect(parseCookies(null)).toEqual({});
		expect(parseCookies(undefined)).toEqual({});
		expect(parseCookies("")).toEqual({});
	});

	it("parses a single cookie", () => {
		expect(parseCookies("foo=bar")).toEqual({ foo: "bar" });
	});

	it("parses multiple cookies", () => {
		expect(parseCookies("foo=bar; baz=qux")).toEqual({
			foo: "bar",
			baz: "qux",
		});
	});

	it("trims whitespace around keys and values", () => {
		expect(parseCookies("  foo  =  bar  ;  baz=qux  ")).toEqual({
			foo: "bar",
			baz: "qux",
		});
	});

	it("URL-decodes values", () => {
		expect(parseCookies("token=hello%20world")).toEqual({
			token: "hello world",
		});
	});

	it("falls back to raw value if URL decode throws", () => {
		// %ZZ isn't a valid percent-encoding — decodeURIComponent throws.
		// Falling back keeps a malformed cookie addressable instead of
		// blowing up the whole request.
		expect(parseCookies("token=%ZZ")).toEqual({ token: "%ZZ" });
	});

	it("skips pieces with no '=' separator", () => {
		expect(parseCookies("nope; foo=bar; alsonope")).toEqual({ foo: "bar" });
	});

	it("skips empty keys", () => {
		expect(parseCookies("=bar; foo=baz")).toEqual({ foo: "baz" });
	});

	it("preserves an empty value", () => {
		expect(parseCookies("foo=")).toEqual({ foo: "" });
	});
});

describe("readCookie", () => {
	function makeHeaders(cookie: string | null): Headers {
		const h = new Headers();
		if (cookie !== null) h.set("cookie", cookie);
		return h;
	}

	it("returns the named cookie value", () => {
		expect(readCookie(makeHeaders("xors_session=abc; other=1"), "xors_session")).toBe("abc");
	});

	it("returns null when the cookie is absent", () => {
		expect(readCookie(makeHeaders("other=1"), "xors_session")).toBeNull();
	});

	it("returns null when there is no cookie header at all", () => {
		expect(readCookie(makeHeaders(null), "xors_session")).toBeNull();
	});
});
