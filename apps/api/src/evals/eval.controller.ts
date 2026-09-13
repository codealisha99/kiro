import { Controller, Get, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt-payload.interface";
import { EvalService } from "./eval.service";

@Controller("evals")
@UseGuards(JwtAuthGuard)
export class EvalController {
  constructor(private readonly evals: EvalService) {}

  @Get("retrieval")
  retrieval(@CurrentUser() user: AuthenticatedUser) {
    return this.evals.runRetrieval(user);
  }

  @Get("rag")
  rag(@CurrentUser() user: AuthenticatedUser) {
    return this.evals.runRag(user);
  }
}
