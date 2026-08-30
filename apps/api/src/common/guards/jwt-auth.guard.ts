import { Injectable } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

/** Passport JWT guard used to protect authenticated routes. */
@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt") {}
