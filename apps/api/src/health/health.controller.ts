import { Controller, Get } from "@nestjs/common";

@Controller("admin")
export class HealthController {
  @Get("health")
  health() {
    return {
      status: "ok",
      service: "kiro-api",
      timestamp: new Date().toISOString(),
    };
  }
}
