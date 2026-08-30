export const RBAC_ROLES = ["employee", "manager", "admin"] as const;
export type RBACRole = (typeof RBAC_ROLES)[number];

export const CLASSIFICATIONS = [
  "public",
  "internal",
  "confidential",
  "restricted",
] as const;
export type Classification = (typeof CLASSIFICATIONS)[number];

export const DOCUMENT_STATUS = [
  "draft",
  "published",
  "archived",
] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUS)[number];

export const APPROVAL_STATUS = [
  "pending",
  "approved",
  "rejected",
] as const;
export type ApprovalStatus = (typeof APPROVAL_STATUS)[number];

export type Permission = "read" | "write" | "admin";
