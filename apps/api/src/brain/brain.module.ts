import { Global, Module } from "@nestjs/common";
import { BrainService } from "./brain.service";
import { BrainController } from "./brain.controller";

@Global()
@Module({
  controllers: [BrainController],
  providers: [BrainService],
  exports: [BrainService],
})
export class BrainModule {}