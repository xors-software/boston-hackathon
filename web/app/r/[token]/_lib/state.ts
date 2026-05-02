"use client"

import { useEffect, useState } from "react"

export const PARENT_STEPS = [
	"welcome",
	"letter",
	"how-it-works",
	"account",
	"home",
] as const

export type ParentStep = (typeof PARENT_STEPS)[number]

export type ParentState = {
	step: ParentStep
	data: Record<string, unknown>
}

const DEFAULT_STATE: ParentState = { step: "welcome", data: {} }
const storageKey = (token: string) => `ember:parent:${token}:v1`
const RECENT_TOKEN_KEY = "ember:parent:recent-token"

export function useParentState(token: string) {
	const [state, setState] = useState<ParentState>(DEFAULT_STATE)
	const [hydrated, setHydrated] = useState(false)

	useEffect(() => {
		if (!token) return
		try {
			const raw = localStorage.getItem(storageKey(token))
			if (raw) setState({ ...DEFAULT_STATE, ...JSON.parse(raw) })
			localStorage.setItem(RECENT_TOKEN_KEY, token)
		} catch {}
		setHydrated(true)
	}, [token])

	const update = (patch: Partial<ParentState>) => {
		setState((prev) => {
			const next: ParentState = {
				step: patch.step ?? prev.step,
				data: { ...prev.data, ...(patch.data ?? {}) },
			}
			if (token) {
				try {
					localStorage.setItem(storageKey(token), JSON.stringify(next))
				} catch {}
			}
			return next
		})
	}

	// Only advance the step forward — never backwards. So if a screen
	// re-mounts after the parent has moved on, we don't reset their progress.
	const markStep = (step: ParentStep) => {
		const current = PARENT_STEPS.indexOf(state.step)
		const incoming = PARENT_STEPS.indexOf(step)
		if (incoming > current) update({ step })
	}

	return { state, hydrated, update, markStep }
}

const ROUTES: Record<ParentStep, (token: string) => string> = {
	welcome: (t) => `/r/${t}`,
	letter: (t) => `/r/${t}/letter`,
	"how-it-works": (t) => `/r/${t}/start`,
	account: (t) => `/r/${t}/account`,
	home: (t) => `/r/${t}/home`,
}

export function routeForStep(step: ParentStep, token: string): string {
	return ROUTES[step](token)
}
