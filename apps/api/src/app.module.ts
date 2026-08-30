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
import { ConversationsModule } from "./conversations/conversations.module";
import { BrainModule } from "./brain/brain.module";
import { FeedbackModule } from "./feedback/feedback.module";
import { AdminModule } from "./admin/admin.module";

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
    ConversationsModule,
    BrainModule,
    FeedbackModule,
    AdminModule,
  ],
  controllers: [HealthController],
  providers: [],
})
export class AppModule {}
