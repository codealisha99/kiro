import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { HealthController } from "./health/health.controller";
import { PrismaModule } from "./prisma/prisma.module";
import { RedisModule } from "./redis/redis.module";
import { LoggingModule } from "./common/logging.module";
import { AuthModule } from "./auth/auth.module";
import { UsersModule } from "./users/users.module";
import { AiGatewayModule } from "./ai-gateway/ai-gateway.module";
import { IngestionModule } from "./ingestion/ingestion.module";
import { RetrievalModule } from "./retrieval/retrieval.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env", "../../.env"],
    }),
    LoggingModule,
    PrismaModule,
    RedisModule,
    AuthModule,
    UsersModule,
    AiGatewayModule,
    IngestionModule,
    RetrievalModule,
  ],
  controllers: [HealthController],
  providers: [],
})
export class AppModule {}
