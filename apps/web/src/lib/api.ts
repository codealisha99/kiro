import type {
  AuthResponse,
  BrainQueryRequest,
  BrainQueryResponse,
  ConversationDetail,
  ConversationDto,
  DemoSeedResponse,
  DocumentDetail,
  DocumentListItem,
  IngestDocumentResponse,
  InviteUserRequest,
  LoginRequest,
  RegisterRequest,
  SourceDto,
  UserDto,
} from "@company/shared";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const TOKEN_KEY = "company-brain-token";

export function getToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  window.localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function readError(res: Response): Promise<string> {
  let detail = `Request failed (${res.status})`;
  try {
    const data = (await res.json()) as { message?: string | string[] };
    if (Array.isArray(data.message)) {
      detail = data.message.join(", ");
    } else if (data.message) {
      detail = data.message;
    }
  } catch {
    /* ignore non-JSON error bodies */
  }
  return detail;
}

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (!res.ok) {
    const detail = await readError(res);
    if (res.status === 401) {
      clearToken();
    }
    throw new ApiError(res.status, detail);
  }
  return (await res.json()) as T;
}

async function requestForm<T>(path: string, form: FormData): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers,
    body: form,
  });
  if (!res.ok) {
    const detail = await readError(res);
    if (res.status === 401) {
      clearToken();
    }
    throw new ApiError(res.status, detail);
  }
  return (await res.json()) as T;
}

export const api = {
  login: (body: LoginRequest) =>
    request<AuthResponse>("/auth/login", { method: "POST", body }),
  register: (body: RegisterRequest) =>
    request<AuthResponse>("/auth/register", { method: "POST", body }),
  logout: () => request<{ ok: boolean }>("/auth/logout", { method: "POST" }),
  me: () => request<UserDto>("/auth/me"),

  query: (body: BrainQueryRequest) =>
    request<BrainQueryResponse>("/brain/query", { method: "POST", body }),

  sources: () => request<SourceDto[]>("/sources"),
  createSource: (body: { type: string; name: string }) =>
    request<SourceDto>("/sources", { method: "POST", body }),

  documents: () => request<DocumentListItem[]>("/documents"),
  document: (id: string) => request<DocumentDetail>(`/documents/${id}`),
  ingestDocument: (body: {
    title: string;
    content: string;
    classification?: string;
  }) =>
    request<IngestDocumentResponse>("/documents", { method: "POST", body }),
  uploadDocument: (file: File, extras: { title?: string; classification?: string }) => {
    const form = new FormData();
    form.append("file", file);
    if (extras.title) {
      form.append("title", extras.title);
    }
    if (extras.classification) {
      form.append("classification", extras.classification);
    }
    return requestForm<IngestDocumentResponse>("/documents/upload", form);
  },
  seedDemo: () => request<DemoSeedResponse>("/documents/demo", { method: "POST" }),

  conversations: () => request<ConversationDto[]>("/conversations"),
  conversation: (id: string) => request<ConversationDetail>(`/conversations/${id}`),
  createConversation: (title?: string) =>
    request<ConversationDto>("/conversations", { method: "POST", body: { title } }),

  invite: (body: InviteUserRequest) =>
    request<UserDto>("/users/invite", { method: "POST", body }),

  feedback: (body: { requestId: string; helpful: boolean; comment?: string }) =>
    request<{ ok: boolean }>("/feedback", { method: "POST", body }),
};
