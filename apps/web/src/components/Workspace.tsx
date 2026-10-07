"use client";

import { Alert, Badge, Button, Field, Input, Textarea, Select } from "@/components/ui";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  BrainQueryResponse,
  CitationSource,
  ConversationDto,
  DemoSeedResponse,
  DocumentDetail,
  DocumentListItem,
  EmbedStatus,
  SourceDto,
  UserDto,
} from "@kiro/shared";
import { api, clearToken, getToken } from "@/lib/api";
import AuthScreen from "./AuthScreen";
import EvidencePanel from "./EvidencePanel";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  status?: BrainQueryResponse["status"];
  response?: BrainQueryResponse;
}

const PROMPTS = [
  "What is our refund policy?",
  "Find documents related to supplier onboarding.",
  "Summarize the latest supplier policy.",
  "What happened with Client Helios?",
  "What was our revenue in 2035?",
];

export default function Workspace() {
  const [authed, setAuthed] = useState(false);
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<UserDto | null>(null);
  const [sources, setSources] = useState<SourceDto[]>([]);
  const [documents, setDocuments] = useState<DocumentListItem[]>([]);
  const [conversations, setConversations] = useState<ConversationDto[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<
    string | null
  >(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [ingest, setIngest] = useState({
    title: "",
    content: "",
    classification: "internal",
  });
  const [file, setFile] = useState<File | null>(null);
  const [notice, setNotice] = useState<{
    message: string;
    tone: "info" | "danger";
  } | null>(null);
  const [seedInfo, setSeedInfo] = useState<DemoSeedResponse | null>(null);
  const [embedStatus, setEmbedStatus] = useState<EmbedStatus | null>(null);
  const [showReadyBanner, setShowReadyBanner] = useState(false);
  const wasIndexingRef = useRef(false);
  const [ledgerTab, setLedgerTab] = useState<"library" | "evidence">("library");
  const [openDoc, setOpenDoc] = useState<DocumentDetail | null>(null);
  const [activeCite, setActiveCite] = useState<CitationSource | null>(null);
  const [docLoading, setDocLoading] = useState(false);
  const [railOpen, setRailOpen] = useState(false);
  const [ledgerOpen, setLedgerOpen] = useState(false);
  const railRef = useRef<HTMLElement>(null);
  const ledgerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const panel = railOpen ? railRef.current : ledgerOpen ? ledgerRef.current : null;
    const media = window.matchMedia(
      railOpen ? "(max-width: 760px)" : "(max-width: 1100px)",
    );
    if (!panel || !media.matches) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const controls = () =>
      Array.from(
        panel.querySelectorAll<HTMLElement>(
          'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled)',
        ),
      ).filter((element) => element.getClientRects().length > 0);
    controls()[0]?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (!media.matches) return;
      if (event.key === "Escape") {
        setRailOpen(false);
        setLedgerOpen(false);
      }
      if (event.key === "Tab") {
        const items = controls();
        const first = items[0];
        const last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [railOpen, ledgerOpen]);

  const load = useCallback(async () => {
    if (!getToken()) {
      return;
    }
    try {
      const [me, srcs, docs, convs, embeds] = await Promise.all([
        api.me(),
        api.sources(),
        api.documents(),
        api.conversations(),
        api.embedStatus(),
      ]);
      setUser(me);
      setSources(srcs);
      setDocuments(docs);
      setConversations(convs);
      wasIndexingRef.current = !embeds.ready && embeds.totalChunks > 0;
      setEmbedStatus(embeds);
    } catch {
      clearToken();
      setAuthed(false);
    }
  }, []);

  const refreshEmbedStatus = useCallback(async () => {
    if (!getToken()) {
      return null;
    }
    try {
      const status = await api.embedStatus();
      if (wasIndexingRef.current && status.ready && status.totalChunks > 0) {
        setShowReadyBanner(true);
      }
      wasIndexingRef.current = !status.ready && status.totalChunks > 0;
      setEmbedStatus(status);
      return status;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    if (!showReadyBanner) {
      return;
    }
    const id = window.setTimeout(() => setShowReadyBanner(false), 8000);
    return () => window.clearTimeout(id);
  }, [showReadyBanner]);

  useEffect(() => {
    setAuthed(!!getToken());
    setReady(true);
  }, []);

  useEffect(() => {
    if (authed) {
      void load();
    }
  }, [authed, load]);

  const shouldPollEmbeddings = authed && embedStatus !== null && !embedStatus.ready;

  useEffect(() => {
    if (!shouldPollEmbeddings) {
      return;
    }
    const id = window.setInterval(() => {
      void refreshEmbedStatus();
    }, 2000);
    return () => window.clearInterval(id);
  }, [shouldPollEmbeddings, refreshEmbedStatus]);

  const openDocument = useCallback(
    async (id: string, cite?: CitationSource) => {
      setDocLoading(true);
      setLedgerTab("evidence");
      setRailOpen(false);
      setLedgerOpen(true);
      setActiveCite(cite ?? null);
      try {
        const detail = await api.document(id);
        setOpenDoc(detail);
      } catch (err) {
        setNotice({ message: err instanceof Error ? err.message : "Could not open document", tone: "danger" });
        setLedgerTab("library");
      } finally {
        setDocLoading(false);
      }
    },
    [],
  );

  const send = useCallback(
    async (text?: string) => {
      const question = (text ?? input).trim();
      if (!question || busy) {
        return;
      }
      setMessages((prev) => [
        ...prev,
        { id: `u-${Date.now()}`, role: "user", content: question },
      ]);
      setInput("");
      setBusy(true);
      try {
        const res = await api.query({
          query: question,
          conversationId: activeConversationId ?? undefined,
        });
        setActiveConversationId(res.conversationId);
        setMessages((prev) => [
          ...prev,
          {
            id: res.requestId,
            role: "assistant",
            content: res.answer,
            status: res.status,
            response: res,
          },
        ]);
        void load();
      } catch (err) {
        setMessages((prev) => [
          ...prev,
          {
            id: `e-${Date.now()}`,
            role: "assistant",
            content:
              err instanceof Error ? err.message : "Query failed. Try again.",
            status: "error",
          },
        ]);
      } finally {
        setBusy(false);
      }
    },
    [input, busy, activeConversationId, load],
  );

  const openConversation = useCallback(async (id: string) => {
    try {
      const detail = await api.conversation(id);
      setActiveConversationId(detail.id);
      const next: ChatMessage[] = [];
      for (const item of detail.messages) {
        next.push({ id: `${item.id}-q`, role: "user", content: item.query });
        next.push({
          id: item.id,
          role: "assistant",
          content: item.answer,
          status: item.status,
          response: {
            requestId: item.id,
            conversationId: detail.id,
            question: item.query,
            answer: item.answer,
            status: item.status,
            confidence: 0,
            sources: item.sources,
          },
        });
      }
      setMessages(next);
      setRailOpen(false);
    } catch (err) {
      setNotice({ message: err instanceof Error ? err.message : "Could not open conversation", tone: "danger" });
      setRailOpen(false);
      setLedgerOpen(true);
    }
  }, []);

  const newChat = useCallback(() => {
    setActiveConversationId(null);
    setMessages([]);
    setRailOpen(false);
  }, []);

  const submitIngest = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setNotice(null);
      try {
        const res = file
          ? await api.uploadDocument(file, {
              title: ingest.title || undefined,
              classification: ingest.classification,
            })
          : await api.ingestDocument({
              title: ingest.title,
              content: ingest.content,
              classification: ingest.classification,
            });
        setNotice({
          message: res.created || res.contentChanged
            ? `Filed “${res.title}” (v${res.version}). Indexing in the background.`
            : `“${res.title}” is already up to date.`,
          tone: "info",
        });
        setIngest({ title: "", content: "", classification: "internal" });
        setFile(null);
        await load();
        void refreshEmbedStatus();
      } catch (err) {
        setNotice({ message: err instanceof Error ? err.message : "Ingest failed", tone: "danger" });
      }
    },
    [file, ingest, load, refreshEmbedStatus],
  );

  const seed = useCallback(async () => {
    setNotice(null);
    try {
      const result = await api.seedDemo();
      setSeedInfo(result);
      setNotice({ message: `Loaded ${result.documentCount} Northwind records into “${result.sourceName}”. Indexing for semantic search…`, tone: "info" });
      await load();
      void refreshEmbedStatus();
    } catch (err) {
      setNotice({ message: err instanceof Error ? err.message : "Could not load demo knowledge", tone: "danger" });
    }
  }, [load, refreshEmbedStatus]);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch {}
    clearToken();
    setAuthed(false);
    setUser(null);
    setMessages([]);
    setActiveConversationId(null);
    setSeedInfo(null);
  }, []);

  const sourceNames = useMemo(
    () => new Map(sources.map((s) => [s.id, s.name])),
    [sources],
  );

  if (!ready) {
    return null;
  }

  if (!authed) {
    return (
      <AuthScreen
        onAuthed={() => {
          setAuthed(true);
          void load();
        }}
      />
    );
  }

  return (
    <div
      className={`desk ${ledgerOpen ? "ledger-open" : ""} ${railOpen ? "rail-open" : ""}`}
    >
      {(railOpen || ledgerOpen) && (
        <button className="drawer-backdrop" aria-label="Close open panel" tabIndex={-1}
          onClick={() => { setRailOpen(false); setLedgerOpen(false); }} />
      )}
      <aside className="rail" id="workspace-navigation" ref={railRef} aria-label="Workspace navigation">
        <div className="brand">
          <div className="brand-mark">Internal knowledge</div>
          <div className="rail-heading">
            <h1>Kiro</h1>
            <Button variant="secondary"
            size="small"
            className="mobile-only rail-toggle"
              onClick={() => setRailOpen(false)}>Close menu</Button>
          </div>
          <p>Answers with a paper trail.</p>
        </div>
        <div className="who">
          <div className="who-name">
            <strong>{user?.name || user?.role}</strong>
            <span>{user?.email}</span>
          </div>
          <Button
            variant="secondary"
            size="small"
            onClick={() => void logout()}
          >
            Log out
          </Button>
        </div>
        <div className="scroll">
          <div>
            <Button fullWidth onClick={newChat}>
              New question
            </Button>
          </div>
          <div>
            <div className="section-label">Conversations</div>
            <div className="stack">
              {conversations.length === 0 && (
                <p className="muted">Nothing asked yet.</p>
              )}
              {conversations.map((c) => (
                <button
                  key={c.id}
                  className={`ticket ${c.id === activeConversationId ? "active" : ""}`}
                  onClick={() => void openConversation(c.id)}
                >
                  <div className="title">{c.title ?? "Untitled"}</div>
                  <div className="kicker">
                    {new Date(c.updatedAt).toLocaleString()}
                  </div>
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="section-label">Sources</div>
            <div className="stack">
              {sources.length === 0 && (
                <p className="muted">Load the demo or upload a file.</p>
              )}
              {sources.map((s) => (
                <div className="ticket" key={s.id}>
                  <div className="row">
                    <span className="title">{s.name}</span>
                    <Badge tone={s.status === "connected" ? "success" : s.status === "error" ? "danger" : "warning"}>{s.status}</Badge>
                  </div>
                  <div className="kicker">
                    {s.documentCount} records · {s.type.replace("_", " ")}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </aside>

      <main className="stage">
        <div className="stage-head">
          <Button
            variant="secondary"
            size="small"
            className="mobile-only rail-toggle"
            aria-expanded={railOpen}
            aria-controls="workspace-navigation"
            onClick={() => {
              setLedgerOpen(false);
              setRailOpen((v) => !v);
            }}
          >
            Menu
          </Button>
          <h2>
            {activeConversationId
              ? (conversations.find((c) => c.id === activeConversationId)
                  ?.title ?? "Conversation")
              : "New question"}
          </h2>
          <Button
            variant="secondary"
            size="small"
            className="mobile-only ledger-toggle"
            aria-expanded={ledgerOpen}
            aria-controls="source-ledger"
            onClick={() => {
              setRailOpen(false);
              setLedgerOpen((v) => !v);
            }}
          >
            Open ledger
          </Button>
        </div>

        {embedStatus && embedStatus.totalChunks > 0 && !embedStatus.ready && (
          <div className="index-banner pending" role="status">
            Indexing knowledge… {embedStatus.embeddedChunks}/
            {embedStatus.totalChunks} chunks ready. Keyword search works now;
            wait for semantic search before the best answers.
          </div>
        )}
        {showReadyBanner && embedStatus?.ready && (
          <div className="index-banner ready" role="status">
            Knowledge ready — {embedStatus.embeddedChunks} chunks indexed for
            hybrid search.
          </div>
        )}

        <div className="chat">
          {messages.length === 0 && (
            <div className="empty-ask">
              <h2>What does the company already know?</h2>
              <p>
                Ask a factual question. The brain only answers from documents
                you can see, and shows the source beside the answer.
              </p>
              <div className="prompts">
                {PROMPTS.map((q) => (
                  <button
                    key={q}
                    className="prompt"
                    onClick={() => void send(q)}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m) => (
            <div className={`msg ${m.role}`} key={m.id}>
              {m.role === "user" ? (
                m.content
              ) : (
                <>
                  {m.status && (
                    <div className="meta-line">
                      <Badge tone={m.status === "answered" ? "success" : m.status === "error" ? "danger" : "warning"}>{m.status}</Badge>
                      {m.response && (
                        <span className="muted">
                          {m.response.sources.length} source
                          {m.response.sources.length === 1 ? "" : "s"}
                        </span>
                      )}
                    </div>
                  )}
                  <div className="answer">
                    {renderAnswer(
                      m.content,
                      m.response?.sources,
                      (cite) => void openDocument(cite.documentId, cite),
                    )}
                  </div>
                  {m.response && m.response.sources.length > 0 && (
                    <div className="citations">
                      {m.response.sources.map((s, i) => (
                        <button
                          className={`citation ${activeCite?.documentId === s.documentId ? "active" : ""}`}
                          key={`${m.id}-${s.documentId}-${i}`}
                          onClick={() => void openDocument(s.documentId, s)}
                        >
                          <div className="title">
                            [{i + 1}] {s.title}
                          </div>
                          <div className="meta">
                            {s.sourceName} · v{s.version} · {s.classification}
                          </div>
                          <div className="excerpt">{s.excerpt}</div>
                        </button>
                      ))}
                    </div>
                  )}
                  {m.response && (
                    <div className="actions">
                      <Button
                        variant="secondary"
                        size="small"
                        onClick={() =>
                          void api.feedback({
                            requestId: m.response!.requestId,
                            helpful: true,
                          })
                        }
                      >
                        Helpful
                      </Button>
                      <Button
                        variant="secondary"
                        size="small"
                        onClick={() =>
                          void api.feedback({
                            requestId: m.response!.requestId,
                            helpful: false,
                          })
                        }
                      >
                        Not helpful
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}

          {busy && (
            <div className="msg assistant">
              <div className="spinner" role="status">
                Retrieving authorized evidence…
              </div>
            </div>
          )}
        </div>

        <div className="composer">
          <div className="composer-box">
            <Input
              aria-label="Ask a question"
              placeholder="Ask about a policy, a client, a decision…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  void send();
                }
              }}
              disabled={busy}
            />
            <Button variant="primary" onClick={() => void send()} disabled={busy || !input.trim()}>
              Ask
            </Button>
          </div>
        </div>
      </main>

      <aside className="ledger" id="source-ledger" ref={ledgerRef} aria-label="Source ledger">
        <div className="ledger-head">
          <div className="ledger-heading">
            <h2>{ledgerTab === "library" ? "Library" : "Evidence"}</h2>
            <Button variant="secondary"
            size="small"
            className="mobile-only ledger-toggle"
              onClick={() => setLedgerOpen(false)} aria-label="Close ledger">Close</Button>
          </div>
          <div className="tabs" aria-label="Source ledger views">
            <button
              aria-pressed={ledgerTab === "library"}
              className={ledgerTab === "library" ? "active" : ""}
              onClick={() => setLedgerTab("library")}
            >
              Library
            </button>
            <button
              aria-pressed={ledgerTab === "evidence"}
              className={ledgerTab === "evidence" ? "active" : ""}
              onClick={() => setLedgerTab("evidence")}
            >
              Evidence
            </button>
          </div>
        </div>

        {ledgerTab === "evidence" ? (
          <EvidencePanel
            document={openDoc}
            citation={activeCite}
            loading={docLoading}
            onClose={() => {
              setOpenDoc(null);
              setActiveCite(null);
              setLedgerTab("library");
            }}
          />
        ) : (
          <div className="scroll">
            <Button variant="primary" fullWidth onClick={() => void seed()}>
              Load Northwind demo
            </Button>
            {seedInfo?.viewer && (
              <div className="viewer-card">
                <div className="section-label">Permission check</div>
                <p>
                  Sign in as the employee to see what they cannot. They will not
                  see compensation bands or the board cash note.
                </p>
                <p style={{ marginTop: 8 }}>
                  <code>{seedInfo.viewer.email}</code>
                  <br />
                  <code>{seedInfo.viewer.password}</code>
                </p>
              </div>
            )}

            <form className="form" onSubmit={(e) => void submitIngest(e)}>
              <div className="section-label">File a record</div>
              <div className="drop">
                PDF, Markdown, text, or CSV
                <Input
                  aria-label="Upload a document"
                  type="file"
                  accept=".pdf,.md,.txt,.csv,text/plain,text/markdown,text/csv,application/pdf"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
                {file && <div className="kicker">{file.name}</div>}
              </div>
              <Field label="Record title">
                {(field) => (
                  <Input
                    {...field}
                    placeholder={file ? "Title (optional)" : "Title"}
                    value={ingest.title}
                    onChange={(e) =>
                      setIngest({ ...ingest, title: e.target.value })
                    }
                    required={!file}
                  />
                )}
              </Field>
              {!file && (
                <Field label="Document text">
                  {(field) => (
                    <Textarea
                      {...field}
                      placeholder="Or paste the document here"
                      value={ingest.content}
                      onChange={(e) =>
                        setIngest({ ...ingest, content: e.target.value })
                      }
                      required
                    />
                  )}
                </Field>
              )}
              <Field label="Classification">
                {(field) => (
                  <Select
                    {...field}
                    value={ingest.classification}
                    onChange={(e) =>
                      setIngest({ ...ingest, classification: e.target.value })
                    }
                  >
                    <option value="public">Public</option>
                    <option value="internal">Internal</option>
                    <option value="confidential">
                      Confidential — managers
                    </option>
                    <option value="restricted">Restricted — you only</option>
                  </Select>
                )}
              </Field>
              <Button variant="secondary" type="submit">
                {file ? "Upload and index" : "File this text"}
              </Button>
              {notice && (
                <Alert tone={notice.tone}>{notice.message}</Alert>
              )}
            </form>

            <div>
              <div className="section-label">Documents you can see</div>
              <div className="stack">
                {documents.length === 0 && (
                  <p className="muted">Nothing in the library yet.</p>
                )}
                {documents.map((d) => (
                  <button
                    className="ticket"
                    key={d.id}
                    onClick={() => void openDocument(d.id)}
                  >
                    <div className="row">
                      <span className="title">{d.title}</span>
                      <Badge className={d.classification}>
                        {d.classification}
                      </Badge>
                    </div>
                    <div className="kicker">
                      {sourceNames.get(d.sourceId) ?? "Source"} · v
                      {d.versionCount}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}

function renderAnswer(
  text: string,
  sources: CitationSource[] | undefined,
  onCite: (source: CitationSource) => void,
) {
  const parts = text.split(/(\[\d+\])/g);
  return parts.map((part, i) => {
    const match = part.match(/^\[(\d+)\]$/);
    if (!match) {
      return <span key={i}>{part}</span>;
    }
    const idx = Number(match[1]) - 1;
    const source = sources?.[idx];
    if (!source) {
      return <span key={i}>{part}</span>;
    }
    return (
      <button
        key={i}
        className="cite-chip"
        aria-label={`Show source ${match[1]}: ${source.title}`}
        onClick={() => onCite(source)}
        type="button"
      >
        {match[1]}
      </button>
    );
  });
}
