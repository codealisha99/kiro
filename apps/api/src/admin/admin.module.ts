import { Global, Module } from "@nestjs/common";
import { AdminController } from "./admin.controller";

@Global()
@Module({
  controllers: [AdminController],
})
export class AdminModule {}