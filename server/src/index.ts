import { cors } from "@elysiajs/cors";
import { swagger } from "@elysiajs/swagger";
import { Elysia } from "elysia";
import { runMigrationsWithRetry } from "./lib/pg";
import { authRoutes } from "./routes/auth";
import { healthRoutes } from "./routes/health";
import { messagesRoutes } from "./routes/messages";
import { usersRoutes } from "./routes/users";

// Loud boot log: missing API_AES_KEY/API_IV_KEY breaks /oauth decrypt,
// missing DATABASE_URL breaks every authenticated route. Both are
// harder to diagnose silently than from a clear startup log.
console.log(
	"[boot] env:",
	"CORS_ORIGIN=",
	process.env.CORS_ORIGIN ?? "(default http://localhost:3000)",
	"PORT=",
	process.env.PORT ?? "(default 3001)",
	"DATABASE_URL=",
	process.env.DATABASE_URL ? "set" : "MISSING",
	"API_AES_KEY=",
	process.env.API_AES_KEY ? "set" : "MISSING",
	"API_IV_KEY=",
	process.env.API_IV_KEY ? "set" : "MISSING",
	"XORS_API_URL=",
	process.env.XORS_API_URL ?? "(default https://api.xors.xyz)",
);

try {
	await runMigrationsWithRetry();
	console.log("[boot] migrations applied");
} catch (err) {
	console.error("[boot] migrations failed — exiting:", err);
	process.exit(1);
}

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
	.listen(process.env.PORT || 3001);

console.log(
	`🦊 Elysia is running at http://${app.server?.hostname}:${app.server?.port}`,
);
console.log(
	`📚 Swagger docs at http://${app.server?.hostname}:${app.server?.port}/swagger`,
);

export type App = typeof app;
