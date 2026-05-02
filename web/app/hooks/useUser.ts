// Current-user query. Returns `null` (not undefined) when the visitor
// is not signed in, so consumers can `if (user === null)` redirect to
// /login without false negatives during the loading flicker.

import { useQuery } from "@tanstack/react-query"
import { api, ApiError } from "@/lib/api"

export const userQueryKey = ["currentUser"] as const

export function useUser() {
	return useQuery({
		queryKey: userQueryKey,
		queryFn: async () => {
			const { data, error } = await api.auth.me.get()
			if (error) {
				// 401 is the expected unauthenticated path — return null
				// so the UI can render a sign-in CTA without flashing
				// an error state.
				if (error.status === 401) return null
				throw new ApiError(
					error.status,
					typeof error.value === "object" &&
					error.value &&
					"error" in error.value
						? String((error.value as { error: unknown }).error)
						: "Failed to load user",
					error.value,
				)
			}
			return data?.user ?? null
		},
	})
}
