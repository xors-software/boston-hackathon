import { useMutation, useQueryClient } from "@tanstack/react-query"
import { api, unwrap } from "@/lib/api"

export const giftsQueryKey = ["gifts"] as const

export function useCreateGift() {
	const qc = useQueryClient()
	return useMutation({
		mutationFn: (input: { intent?: "mom" | "dad" | "loved-one" | "undecided" }) =>
			unwrap(api.gifts.post(input)),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: giftsQueryKey })
		},
	})
}
