import { useMutation, useQueryClient } from "@tanstack/react-query"
import { api, unwrap } from "@/lib/api"
import { userQueryKey } from "./useUser"

export function useLogin() {
	const qc = useQueryClient()
	return useMutation({
		mutationFn: (input: { email: string; password: string }) =>
			unwrap(api.auth.login.post(input)),
		onSuccess: () => {
			// Force the user query to refetch — the next render flips
			// from signed-out to signed-in without a full page reload.
			qc.invalidateQueries({ queryKey: userQueryKey })
		},
	})
}
