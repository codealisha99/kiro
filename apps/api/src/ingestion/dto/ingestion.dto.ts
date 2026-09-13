import { IsIn, IsOptional, IsString, MinLength } from "class-validator";

export class CreateSourceDto {
  @IsIn(["google_drive", "slack", "crm", "manual"])
  type!: string;

  @IsString()
  @MinLength(1)
  name!: string;
}

export class AclGrantDto {
  @IsIn(["user", "role", "group"])
  principalType!: string;

  @IsString()
  @MinLength(1)
  principalId!: string;

  @IsOptional()
  @IsIn(["read", "write", "admin"])
  permission?: string;
}

export class IngestDocumentDto {
  @IsString()
  @MinLength(1)
  title!: string;

  @IsString()
  @MinLength(1)
  content!: string;

  @IsOptional()
  @IsIn(["public", "internal", "confidential", "restricted"])
  classification?: string;

  @IsOptional()
  acl?: AclGrantDto[];
}

export class RevokeAclDto {
  @IsIn(["user", "role", "group"])
  principalType!: string;

  @IsString()
  @MinLength(1)
  principalId!: string;
}