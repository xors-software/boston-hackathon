import { cors } from "@elysiajs/cors";
import { swagger } from "@elysiajs/swagger";
import { Elysia } from "elysia";
import { aiRoutes } from "./routes/ai";
import { authRoutes } from "./routes/auth";
import { healthRoutes } from "./routes/health";
import { messagesRoutes } from "./routes/messages";
import { transcribeRoutes } from "./routes/transcribe";
import { usersRoutes } from "./routes/users";

// Loud boot log: missing API_AES_KEY/API_IV_KEY breaks /oauth decrypt,
// and a silent failure is hard to diagnose in deploy logs.
console.log(
	"[boot] env:",
	"CORS_ORIGIN=",
	process.env.CORS_ORIGIN ?? "(default http://localhost:3000)",
	"PORT=",
	process.env.PORT ?? "(default 3001)",
	"API_AES_KEY=",
	process.env.API_AES_KEY ? "set" : "MISSING",
	"API_IV_KEY=",
	process.env.API_IV_KEY ? "set" : "MISSING",
	"XORS_API_URL=",
	process.env.XORS_API_URL ?? "(default https://api.xors.xyz)",
);

const app = new Elysia()
	.use(
		cors({
			origin: process.env.CORS_ORIGIN || "http://localhost:3000",
			credentials: true,
		}),
	)
	.use(
		swagger({
			documentation: {
				info: {
					title: "XORS API",
					version: "1.0.0",
					description: "Elysia-powered API for XORS projects",
				},
			},
		}),
	)
	.use(healthRoutes)
	.use(authRoutes)
	.use(usersRoutes)
	.use(messagesRoutes)
	.use(transcribeRoutes)
	.use(aiRoutes)
	.listen(process.env.PORT || 3001);

console.log(
	`🦊 Elysia is running at http://${app.server?.hostname}:${app.server?.port}`,
);
console.log(
	`📚 Swagger docs at http://${app.server?.hostname}:${app.server?.port}/swagger`,
);

export type App = typeof app;
