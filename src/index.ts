import "dotenv/config";
import { buildApp } from "./app.js";
import { loadEnv } from "./config/env.js";
import { isEmailConfigured } from "./lib/email.js";

async function main() {
  const env = loadEnv();
  const app = await buildApp();

  if (!isEmailConfigured()) {
    app.log.warn(
      "Email delivery is NOT configured (RESEND_API_KEY or SMTP). Telehealth sign-up and login will fail until email is set up.",
    );
  } else {
    app.log.info("Email delivery configured for telehealth OTP codes");
  }

  try {
    await app.listen({ port: env.PORT, host: env.HOST });
    app.log.info({ port: env.PORT, host: env.HOST }, "Server listening");
  } catch (error) {
    app.log.error(error, "Failed to start server");
    process.exit(1);
  }

  const shutdown = async (signal: string) => {
    app.log.info({ signal }, "Shutting down");
    await app.close();
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main();
