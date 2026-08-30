import { Global, Module } from "@nestjs/common";
import { FeedbackController } from "./feedback.controller";

@Global()
@Module({
  controllers: [FeedbackController],
})
export class FeedbackModule {}