"use client"

import { useEffect, useState } from "react"
import { clearStoredGiftId } from "./sync"

const STORAGE_KEY = "ember:onboarding:v1"

export const ONBOARDING_STEPS = [
	"welcome",
	"intent",
	"account",
	"recipient",
	"why",
	"world",
	"questions",
	"delivery",
	"send",
	"complete",
] as const

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number]

export type OnboardingState = {
	step: OnboardingStep
	data: Record<string, unknown>
}

const DEFAULT_STATE: OnboardingState = { step: "welcome", data: {} }

export function useOnboardingState() {
	const [state, setState] = useState<OnboardingState>(DEFAULT_STATE)
	const [hydrated, setHydrated] = useState(false)

	useEffect(() => {
		try {
			const raw = localStorage.getItem(STORAGE_KEY)
			if (raw) setState({ ...DEFAULT_STATE, ...JSON.parse(raw) })
		} catch {}
		setHydrated(true)
	}, [])

	const update = (patch: Partial<OnboardingState>) => {
		setState((prev) => {
			const next: OnboardingState = {
				step: patch.step ?? prev.step,
				data: { ...prev.data, ...(patch.data ?? {}) },
			}
			try {
				localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
			} catch {}
			return next
		})
	}

	const advance = () => {
		const idx = ONBOARDING_STEPS.indexOf(state.step)
		const next = ONBOARDING_STEPS[Math.min(idx + 1, ONBOARDING_STEPS.length - 1)]
		update({ step: next })
	}

	const reset = () => {
		try {
			localStorage.removeItem(STORAGE_KEY)
		} catch {}
		clearStoredGiftId()
		setState(DEFAULT_STATE)
	}

	return { state, hydrated, update, advance, reset }
}
