import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { HealthController } from "./health/health.controller";
import { PrismaModule } from "./prisma/prisma.module";
import { RedisModule } from "./redis/redis.module";
import { LoggingModule } from "./common/logging.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env", "../../.env"],
    }),
    LoggingModule,
    PrismaModule,
    RedisModule,
  ],
  controllers: [HealthController],
  providers: [],
})
export class AppModule {}
