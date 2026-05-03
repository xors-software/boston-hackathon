"use client"

import type { ReactNode } from "react"

// ─── Ember design system primitives ──────────────────────────
//
// Used by both child-onboarding and parent-flow pages so the
// "kept journal" treatment stays consistent. Inline-styled with
// the CSS variables defined in globals.css.

export function EmberPage({
	children,
	bg = "cream",
	className = "",
}: {
	children: ReactNode
	bg?: "cream" | "card"
	className?: string
}) {
	return (
		<main
			className={`min-h-dvh w-full ${className}`}
			style={{
				backgroundColor:
					bg === "card"
						? "var(--ember-card)"
						: "var(--ember-cream)",
				color: "var(--ember-ink)",
			}}
		>
			{children}
		</main>
	)
}

export function EmberContainer({
	children,
	className = "",
}: {
	children: ReactNode
	className?: string
}) {
	return (
		<div
			className={`mx-auto w-full max-w-md px-6 sm:px-8 ${className}`}
		>
			{children}
		</div>
	)
}

// "─ A MORNING IN MAY" eyebrow with the terracotta dash leader
export function EmberEyebrow({
	children,
	className = "",
}: {
	children: ReactNode
	className?: string
}) {
	return (
		<div className={`flex items-center gap-3 ${className}`}>
			<span
				aria-hidden="true"
				className="block h-[2px] w-7 shrink-0"
				style={{ backgroundColor: "var(--ember-terracotta)" }}
			/>
			<span
				className="text-[11px] font-medium tracking-[0.22em] uppercase"
				style={{ color: "var(--ember-warm-gray)" }}
			>
				{children}
			</span>
		</div>
	)
}

// Big serif headline. Pass `accent` to render a word in italic terracotta.
export function EmberHeadline({
	children,
	className = "",
}: {
	children: ReactNode
	className?: string
}) {
	return (
		<h1
			className={`font-serif text-[40px] sm:text-[44px] leading-[1.05] tracking-tight ${className}`}
			style={{ color: "var(--ember-ink)" }}
		>
			{children}
		</h1>
	)
}

export function EmberAccentWord({
	children,
}: {
	children: ReactNode
}) {
	return (
		<span
			className="font-serif italic"
			style={{ color: "var(--ember-terracotta)" }}
		>
			{children}
		</span>
	)
}

export function EmberBody({
	children,
	className = "",
}: {
	children: ReactNode
	className?: string
}) {
	return (
		<p
			className={`text-base leading-relaxed ${className}`}
			style={{ color: "var(--ember-warm-gray)" }}
		>
			{children}
		</p>
	)
}

// Dark pill primary button with circular arrow on the right.
export function EmberPrimaryButton({
	children,
	onClick,
	type = "button",
	disabled,
	className = "",
}: {
	children: ReactNode
	onClick?: () => void
	type?: "button" | "submit"
	disabled?: boolean
	className?: string
}) {
	return (
		<button
			type={type}
			onClick={onClick}
			disabled={disabled}
			className={`ember-cta ember-cta-with-arrow ${className}`}
		>
			<span>{children}</span>
			<span aria-hidden="true" className="ember-cta-arrow">
				<svg
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth="1.75"
					strokeLinecap="round"
					strokeLinejoin="round"
					className="h-4 w-4"
				>
					<line x1="5" y1="12" x2="19" y2="12" />
					<polyline points="13 6 19 12 13 18" />
				</svg>
			</span>
		</button>
	)
}

// Ghost-bordered secondary button (cream background, terracotta text)
export function EmberSecondaryButton({
	children,
	onClick,
	type = "button",
	disabled,
	className = "",
}: {
	children: ReactNode
	onClick?: () => void
	type?: "button" | "submit"
	disabled?: boolean
	className?: string
}) {
	return (
		<button
			type={type}
			onClick={onClick}
			disabled={disabled}
			className={`w-full inline-flex items-center justify-center rounded-full py-3.5 px-6 text-base font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
			style={{
				backgroundColor: "transparent",
				color: "var(--ember-ink)",
				border: "1px solid var(--ember-divider)",
			}}
		>
			{children}
		</button>
	)
}

export function EmberHairline({
	className = "",
}: {
	className?: string
}) {
	return (
		<hr
			className={`border-0 h-px ${className}`}
			style={{ backgroundColor: "var(--ember-divider)" }}
		/>
	)
}

// "AMBER" / "a journal, kept" header for parent pages
export function EmberAppHeader({
	rightSlot,
}: {
	rightSlot?: ReactNode
}) {
	return (
		<div
			className="flex items-center justify-between py-4"
			style={{ color: "var(--ember-warm-gray)" }}
		>
			<span className="text-[11px] font-medium tracking-[0.28em] uppercase">
				Ember
			</span>
			<div className="flex items-center gap-3">
				<span
					className="font-serif italic text-base"
					style={{ color: "var(--ember-warm-gray)" }}
				>
					a journal,{" "}
					<span style={{ color: "var(--ember-terracotta)" }}>kept</span>
				</span>
				{rightSlot}
			</div>
		</div>
	)
}

// Romain-numeral list card (i. / ii. / iii.) with arrow chevron
export function EmberNumberedCard({
	numeral,
	title,
	subtitle,
	onClick,
	disabled,
}: {
	numeral: string
	title: ReactNode
	subtitle?: ReactNode
	onClick?: () => void
	disabled?: boolean
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			disabled={disabled}
			className="w-full text-left rounded-2xl px-6 py-5 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
			style={{ backgroundColor: "var(--ember-card)" }}
		>
			<div className="flex items-center gap-5">
				<span
					className="shrink-0 w-8 font-serif italic text-3xl leading-none"
					style={{ color: "var(--ember-terracotta)" }}
				>
					{numeral}.
				</span>
				<div className="flex-1 min-w-0">
					<div
						className="font-serif text-[19px] leading-snug"
						style={{ color: "var(--ember-ink)" }}
					>
						{title}
					</div>
					{subtitle && (
						<div
							className="mt-1 text-base font-serif italic"
							style={{ color: "var(--ember-warm-gray)" }}
						>
							{subtitle}
						</div>
					)}
				</div>
				<span
					aria-hidden="true"
					className="shrink-0"
					style={{ color: "var(--ember-warm-gray)" }}
				>
					<svg
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="1.25"
						strokeLinecap="round"
						strokeLinejoin="round"
						className="h-5 w-5"
					>
						<line x1="5" y1="12" x2="19" y2="12" />
						<polyline points="13 6 19 12 13 18" />
					</svg>
				</span>
			</div>
		</button>
	)
}

export function EmberBack({
	onClick,
	label = "Back",
}: {
	onClick: () => void
	label?: string
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className="-ml-1 inline-flex items-center gap-1.5 py-2 text-base transition-colors"
			style={{ color: "var(--ember-warm-gray)" }}
		>
			<svg
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.75"
				strokeLinecap="round"
				strokeLinejoin="round"
				className="h-4 w-4"
				aria-hidden="true"
			>
				<polyline points="15 6 9 12 15 18" />
			</svg>
			<span className="font-serif italic">{label}</span>
		</button>
	)
}
