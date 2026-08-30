import { IsEmail, IsOptional, IsString, MinLength } from "class-validator";

export class RegisterDto {
  @IsString()
  @MinLength(2)
  tenantName!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsString()
  @IsOptional()
  name?: string;
}

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  password!: string;
}
