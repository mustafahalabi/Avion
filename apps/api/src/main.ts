import "reflect-metadata";
import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: false });

  const webOrigin = process.env.WEB_ORIGIN ?? "http://localhost:3000";
  const origins = webOrigin.split(",").map((o) => o.trim());

  // CORS for the REST API. The Socket.IO handshake has its own CORS configured
  // on the gateway decorator (see board.gateway.ts).
  app.enableCors({ origin: origins, credentials: true });

  // All REST routes are served under /api (so /api/health, /api/board/*).
  // WebSocket namespaces are NOT affected by this prefix.
  app.setGlobalPrefix("api");

  app.enableShutdownHooks();

  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port);

  Logger.log(
    `avion-api listening on http://localhost:${port}  •  REST under /api  •  Socket.IO namespace /board  •  CORS: ${origins.join(", ")}`,
    "Bootstrap",
  );
}

void bootstrap();
