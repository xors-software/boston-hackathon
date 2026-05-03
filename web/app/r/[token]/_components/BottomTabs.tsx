"use client"

import { useRouter } from "next/navigation"

export type TabId = "today" | "journal" | "prompts" | "share"

type Tab = {
	id: TabId
	label: string
	href: string
	icon: React.ReactNode
}

export function BottomTabs({
	token,
	active,
}: {
	token: string
	active: TabId
}) {
	const router = useRouter()

	const tabs: Tab[] = [
		{
			id: "today",
			label: "Today",
			href: `/r/${token}/home`,
			icon: <SparkIcon />,
		},
		{
			id: "journal",
			label: "Archive",
			href: `/r/${token}/journal`,
			icon: <FernIcon />,
		},
		{
			id: "prompts",
			label: "Prompts",
			href: `/r/${token}/prompts`,
			icon: <QuoteIcon />,
		},
		{
			id: "share",
			label: "More",
			href: `/r/${token}/share`,
			icon: <AsterismIcon />,
		},
	]

	return (
		<div
			className="fixed bottom-0 left-0 right-0"
			style={{ backgroundColor: "var(--ember-cream)" }}
		>
			<div
				aria-hidden="true"
				className="h-px w-full"
				style={{ backgroundColor: "var(--ember-sage)", opacity: 0.5 }}
			/>
			<div className="mx-auto w-full max-w-md px-3 pt-3 pb-3 sm:px-5">
				<div className="grid grid-cols-4 gap-2">
					{tabs.map((tab) => {
						const isActive = tab.id === active
						return (
							<button
								key={tab.id}
								type="button"
								onClick={() => router.push(tab.href)}
								className="flex flex-col items-center gap-1.5 py-2 transition-colors"
								style={{
									color: isActive
										? "var(--ember-terracotta)"
										: "var(--ember-warm-gray)",
								}}
								aria-current={isActive ? "page" : undefined}
							>
								<span className="block">{tab.icon}</span>
								<span className="text-[10px] font-medium tracking-[0.22em] uppercase">
									{tab.label}
								</span>
							</button>
						)
					})}
				</div>
			</div>
		</div>
	)
}

function SparkIcon() {
	return (
		<svg
			viewBox="0 0 24 24"
			aria-hidden="true"
			className="h-5 w-5"
			fill="currentColor"
		>
			<path d="M12 2 C12.6 7.5 16.5 11.4 22 12 C16.5 12.6 12.6 16.5 12 22 C11.4 16.5 7.5 12.6 2 12 C7.5 11.4 11.4 7.5 12 2 Z" />
		</svg>
	)
}

function FernIcon() {
	return (
		<svg
			viewBox="0 0 24 24"
			aria-hidden="true"
			className="h-5 w-5"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<path d="M5 21 C 8 18, 11 14, 13 10 C 15 6, 18 4, 20 4" />
			<path d="M9 17 c 0 -2 1 -3 3 -3.5" />
			<path d="M11 14 c 0 -2 1 -3 3 -3.5" />
			<path d="M13 11 c 0 -2 1 -3 3 -3.5" />
			<path d="M15 8 c 0 -1.5 1 -2.5 2.5 -3" />
		</svg>
	)
}

function QuoteIcon() {
	return (
		<svg
			viewBox="0 0 24 24"
			aria-hidden="true"
			className="h-5 w-5"
			fill="currentColor"
		>
			<path d="M7 6c-2 0-3.5 1.5-3.5 3.5S5 13 7 13c.4 0 .8-.05 1.1-.15-.4 1.7-1.7 3-3.6 3.5v1.4c3.7-.5 6-3 6-6.4V9.5C10.5 7.5 9 6 7 6zm10 0c-2 0-3.5 1.5-3.5 3.5S15 13 17 13c.4 0 .8-.05 1.1-.15-.4 1.7-1.7 3-3.6 3.5v1.4c3.7-.5 6-3 6-6.4V9.5C20.5 7.5 19 6 17 6z" />
		</svg>
	)
}

function AsterismIcon() {
	return (
		<svg
			viewBox="0 0 24 24"
			aria-hidden="true"
			className="h-5 w-5"
			fill="currentColor"
		>
			<Star cx={12} cy={6} r={3} />
			<Star cx={6} cy={17} r={3} />
			<Star cx={18} cy={17} r={3} />
		</svg>
	)
}

function Star({ cx, cy, r }: { cx: number; cy: number; r: number }) {
	const points = Array.from({ length: 8 }, (_, i) => {
		const a = (i * Math.PI) / 4
		const radius = i % 2 === 0 ? r : r * 0.4
		return `${cx + Math.cos(a) * radius},${cy + Math.sin(a) * radius}`
	}).join(" ")
	return <polygon points={points} />
}
