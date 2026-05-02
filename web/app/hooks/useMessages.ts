// Messaging hooks. All endpoints require auth — react-query's
// `enabled: !!user` pattern (or letting 401 surface to useUser) keeps
// these from firing for signed-out visitors.

import {
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query"
import { api, unwrap } from "@/lib/api"
import { userQueryKey } from "./useUser"

export const messagesQueryKey = ["messages"] as const
export const conversationQueryKey = (userId: string) =>
	["messages", "with", userId] as const
export const recipientsQueryKey = ["messages", "recipients"] as const

export function useMyMessages() {
	return useQuery({
		queryKey: messagesQueryKey,
		queryFn: () => unwrap(api.messages.get()),
		select: (data) => data.messages,
	})
}

export function useConversation(userId: string | null | undefined) {
	return useQuery({
		queryKey: userId ? conversationQueryKey(userId) : ["messages", "with", "noop"],
		queryFn: () => unwrap(api.messages.with({ userId: userId ?? "" }).get()),
		enabled: !!userId,
	})
}

export function useRecipients() {
	return useQuery({
		queryKey: recipientsQueryKey,
		queryFn: () => unwrap(api.messages.recipients.get()),
		select: (data) => data.users,
	})
}

export function useSendMessage() {
	const qc = useQueryClient()
	return useMutation({
		mutationFn: (input: { toUserId: string; content: string }) =>
			unwrap(api.messages.post(input)),
		onSuccess: (result) => {
			// Invalidate the inbox + the specific thread so both views
			// pick up the new message without a manual refetch.
			qc.invalidateQueries({ queryKey: messagesQueryKey })
			qc.invalidateQueries({
				queryKey: conversationQueryKey(result.message.toUserId),
			})
		},
	})
}

export function useLogout() {
	const qc = useQueryClient()
	return useMutation({
		mutationFn: () => unwrap(api.auth.logout.post()),
		onSuccess: () => {
			// Drop every cached query — sensitive content shouldn't
			// outlive the session, and the next render will re-fetch
			// with fresh auth state.
			qc.setQueryData(userQueryKey, null)
			qc.invalidateQueries()
		},
	})
}
