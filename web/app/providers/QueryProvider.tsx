"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useState } from "react"

export function QueryProvider({ children }: { children: React.ReactNode }) {
	const [client] = useState(
		() =>
			new QueryClient({
				defaultOptions: {
					queries: {
						staleTime: 30_000,
						gcTime: 5 * 60_000,
						// 401 means sign in — retrying won't help.
						retry: (failureCount, error) => {
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
