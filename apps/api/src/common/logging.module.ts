import { Module } from "@nestjs/common";
import { LoggerModule } from "nestjs-pino";

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env["LOG_LEVEL"] ?? "info",
        transport:
          process.env["NODE_ENV"] !== "production"
            ? { target: "pino-pretty", options: { colorize: true } }
            : undefined,
        autoLogging: {
          ignore: (req) => req.url === "/admin/health" || req.url === "/health" || req.url === "/metrics/prometheus",
        },
        redact: {
          paths: [
            "req.headers.authorization",
            "req.headers.cookie",
            "*.password",
            "*.token",
          ],
          censor: "[REDACTED]",
        },
      },
    }),
  ],
})
export class LoggingModule {}
