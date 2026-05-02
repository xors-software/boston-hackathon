"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useState } from "react"

/**
 * react-query provider. Single QueryClient per app instance, lazily
 * created so SSR doesn't reuse client state across users.
 *
 * Defaults are conservative for an interactive messaging app:
 *   - staleTime 30s: avoid hammering the API on every focus event
 *   - gcTime 5min:    keep recently-unmounted queries warm for tab
 *                     navigations
 *   - refetchOnWindowFocus: true (default) — picks up new messages
 *                     when the user comes back to the tab
 */
export function QueryProvider({ children }: { children: React.ReactNode }) {
	const [client] = useState(
		() =>
			new QueryClient({
				defaultOptions: {
					queries: {
						staleTime: 30_000,
						gcTime: 5 * 60_000,
						retry: (failureCount, error) => {
							// Don't retry auth failures — the user needs to sign in.
							if (
								error &&
								typeof error === "object" &&
								"status" in error &&
								(error as { status: number }).status === 401
							) {
								return false
							}
							return failureCount < 2
						},
					},
				},
			}),
	)

	return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
