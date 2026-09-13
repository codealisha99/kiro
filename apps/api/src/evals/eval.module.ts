import { Module } from "@nestjs/common";
import { EvalService } from "./eval.service";
import { EvalController } from "./eval.controller";

@Module({
  controllers: [EvalController],
  providers: [EvalService],
})
export class EvalModule {}
