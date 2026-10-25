import { request } from "./api";
export type DashboardView = "EMPLOYEE" | "MANAGER" | "DIRECTOR" | "VP" | "CEO";
export type DataRow = Record<string, string | number | boolean | null>;
export interface OrgRole { id: string; name: string; dashboard: string; version: number; permissions: string[] }
export interface OrgSetup {
  canManage: boolean; canManageIntegrations: boolean; views: DashboardView[];
  departments?: DataRow[]; teams?: DataRow[]; users?: DataRow[]; memberships?: DataRow[];
  reporting?: DataRow[]; roles?: OrgRole[]; bindings?: DataRow[];
}
export interface DashboardData {
  view: DashboardView; availableViews: DashboardView[]; calculatedAt: string; method: string;
  metrics: DataRow; tasks: DataRow[]; risks: DataRow[]; projects?: DataRow[]; workload?: DataRow[];
  teams?: DataRow[]; departments?: DataRow[]; reports?: DataRow[]; dependencies?: DataRow[]; resourceGaps?: DataRow[];
}
export interface Provider { id: string; name: string; resourceLabel: string; accountLabel: string; entities: string; permissions: string; sync: string; visibility: string }
export interface Catalog { canManage: boolean; credentialStorageReady: boolean; xeroOAuthConfigured: boolean; googleAnalyticsOAuthConfigured: boolean; googleDriveOAuthConfigured: boolean; providers: Provider[] }
export const orgApi = {
  setup: () => request<OrgSetup>("/organization"),
  dashboard: (view: DashboardView) => request<DashboardData>(`/organization/dashboard?view=${view}`),
  save: (path: string, body: unknown, method = "POST") => request(`/organization/${path}`, { method, body }),
  audit: () => request<DataRow[]>("/organization/audit"),
  teams: () => request<DataRow[]>("/organization/my-teams"),
  audience: (id: string, teamId: string | null, restricted: boolean) => request(`/work/projects/${encodeURIComponent(id)}/audience`, { method: "PUT", body: { teamId, restricted } }),
  catalog: () => request<Catalog>("/integrations/catalog"),
  connections: () => request<DataRow[]>("/integrations"),
  createConnection: (body: unknown) => request<{ id: string }>("/integrations", { method: "POST", body }),
  startXeroOAuth: (id: string) => request<{ authorizationUrl: string }>(`/integrations/${encodeURIComponent(id)}/xero/authorize`, { method: "POST" }),
  startGoogleAnalyticsOAuth: (id: string) => request<{ authorizationUrl: string }>(`/integrations/${encodeURIComponent(id)}/googleanalytics/authorize`, { method: "POST" }),
  startGoogleDriveOAuth: (id: string) => request<{ authorizationUrl: string }>(`/integrations/${encodeURIComponent(id)}/googledrive/authorize`, { method: "POST" }),
  xeroTenants: (id: string) => request<DataRow[]>(`/integrations/${encodeURIComponent(id)}/xero/tenants`),
  selectXeroTenant: (id: string, tenantId: string) => request(`/integrations/${encodeURIComponent(id)}/xero/tenant`, { method: "POST", body: { tenantId } }),
  credential: (id: string, token: string) => request(`/integrations/${encodeURIComponent(id)}/credential`, { method: "PUT", body: { token } }),
  sync: (id: string) => request(`/integrations/${encodeURIComponent(id)}/sync`, { method: "POST" }),
  disconnect: (id: string) => request(`/integrations/${encodeURIComponent(id)}`, { method: "DELETE" }),
  deleteConnectionData: (id: string) => request(`/integrations/${encodeURIComponent(id)}/data`, { method: "DELETE" }),
  records: (id: string, offset = 0) => request<DataRow[]>(`/integrations/${encodeURIComponent(id)}/records?offset=${offset}`),
  runs: (id: string) => request<DataRow[]>(`/integrations/${encodeURIComponent(id)}/runs`),
  mapSource: (projectId: string, body: unknown) => request(`/work/projects/${encodeURIComponent(projectId)}/sources`, { method: "POST", body }),
  projectSources: (projectId: string, offset = 0) => request<DataRow[]>(`/work/projects/${encodeURIComponent(projectId)}/sources?offset=${offset}`),
  revokeSource: (projectId: string, id: string) => request(`/work/projects/${encodeURIComponent(projectId)}/sources/${encodeURIComponent(id)}`, { method: "DELETE" }),
};
