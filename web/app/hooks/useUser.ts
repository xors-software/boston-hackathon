import { useQuery } from "@tanstack/react-query"
import { api, ApiError } from "@/lib/api"

export const userQueryKey = ["currentUser"] as const

export function useUser() {
	return useQuery({
		queryKey: userQueryKey,
		queryFn: async () => {
			const { data, error } = await api.auth.me.get()
			if (error) {
				// 401 = signed out, not an error state.
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
