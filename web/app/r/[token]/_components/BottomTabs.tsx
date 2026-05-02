"use client"

import { useRouter } from "next/navigation"

export type TabId = "today" | "journal" | "prompts" | "share"

export function BottomTabs({
	token,
	active,
}: {
	token: string
	active: TabId
}) {
	const router = useRouter()

	const tabs: Array<{ id: TabId; label: string; href: string; icon: React.ReactNode }> = [
		{
			id: "today",
			label: "Today",
			href: `/r/${token}/home`,
			icon: (
				<svg
					viewBox="0 0 24 24"
					fill="currentColor"
					aria-hidden="true"
					className="h-5 w-5"
				>
					<rect x="5" y="3" width="14" height="18" rx="2" />
				</svg>
			),
		},
		{
			id: "journal",
			label: "Journal",
			href: `/r/${token}/journal`,
			icon: (
				<svg
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth="1.5"
					aria-hidden="true"
					className="h-5 w-5"
				>
					<rect x="3" y="3" width="7" height="7" rx="1" />
					<rect x="14" y="3" width="7" height="7" rx="1" />
					<rect x="3" y="14" width="7" height="7" rx="1" />
					<rect x="14" y="14" width="7" height="7" rx="1" />
				</svg>
			),
		},
		{
			id: "prompts",
			label: "Prompts",
			href: `/r/${token}/prompts`,
			icon: (
				<svg
					viewBox="0 0 24 24"
					fill="currentColor"
					aria-hidden="true"
					className="h-5 w-5"
				>
					<path d="M7 6c-2 0-3.5 1.5-3.5 3.5S5 13 7 13c.4 0 .8-.05 1.1-.15-.4 1.7-1.7 3-3.6 3.5v1.4c3.7-.5 6-3 6-6.4V9.5C10.5 7.5 9 6 7 6zm10 0c-2 0-3.5 1.5-3.5 3.5S15 13 17 13c.4 0 .8-.05 1.1-.15-.4 1.7-1.7 3-3.6 3.5v1.4c3.7-.5 6-3 6-6.4V9.5C20.5 7.5 19 6 17 6z" />
				</svg>
			),
		},
		{
			id: "share",
			label: "Share",
			href: `/r/${token}/share`,
			icon: (
				<svg
					viewBox="0 0 24 24"
					fill="currentColor"
					aria-hidden="true"
					className="h-5 w-5"
				>
					<circle cx="6" cy="12" r="1.5" />
					<circle cx="12" cy="12" r="1.5" />
					<circle cx="18" cy="12" r="1.5" />
				</svg>
			),
		},
	]

	return (
		<div
			className="fixed bottom-0 left-0 right-0 border-t border-neutral-300/60"
			style={{ backgroundColor: "#F1ECE2" }}
		>
			<div className="mx-auto w-full max-w-md px-3 py-3 sm:px-5">
				<div className="grid grid-cols-4 gap-2">
					{tabs.map((tab) => {
						const isActive = tab.id === active
						return (
							<button
								key={tab.id}
								type="button"
								onClick={() => router.push(tab.href)}
								className={`flex flex-col items-center gap-1 rounded-2xl py-2.5 transition-colors ${
									isActive
										? "bg-white text-neutral-900"
										: "bg-transparent text-neutral-500 hover:bg-white/40"
								}`}
								aria-current={isActive ? "page" : undefined}
							>
								<span className="block">{tab.icon}</span>
								<span className="text-[11px] font-medium">{tab.label}</span>
							</button>
						)
					})}
				</div>
			</div>
		</div>
	)
}
