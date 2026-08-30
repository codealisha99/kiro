"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import type {
  BrainQueryResponse,
  CitationSource,
  ConversationDto,
  DemoSeedResponse,
  DocumentDetail,
  DocumentListItem,
  SourceDto,
  UserDto,
} from "@company/shared";
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
  const [activeConversationId, setActiveConversationId] = useState<string | null>(
    null,
  );
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [ingest, setIngest] = useState({
    title: "",
    content: "",
    classification: "internal",
  });
  const [file, setFile] = useState<File | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [seedInfo, setSeedInfo] = useState<DemoSeedResponse | null>(null);
  const [ledgerTab, setLedgerTab] = useState<"library" | "evidence">("library");
  const [openDoc, setOpenDoc] = useState<DocumentDetail | null>(null);
  const [activeCite, setActiveCite] = useState<CitationSource | null>(null);
  const [docLoading, setDocLoading] = useState(false);
  const [railOpen, setRailOpen] = useState(false);

  const load = useCallback(async () => {
    if (!getToken()) {
      return;
    }
    try {
      const [me, srcs, docs, convs] = await Promise.all([
        api.me(),
        api.sources(),
        api.documents(),
        api.conversations(),
      ]);
      setUser(me);
      setSources(srcs);
      setDocuments(docs);
      setConversations(convs);
    } catch {
      clearToken();
      setAuthed(false);
    }
  }, []);

  useEffect(() => {
    setAuthed(!!getToken());
    setReady(true);
  }, []);

  useEffect(() => {
    if (authed) {
      void load();
    }
  }, [authed, load]);

  const openDocument = useCallback(async (id: string, cite?: CitationSource) => {
    setDocLoading(true);
    setLedgerTab("evidence");
    setActiveCite(cite ?? null);
    try {
      const detail = await api.document(id);
      setOpenDoc(detail);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Could not open document");
    } finally {
      setDocLoading(false);
    }
  }, []);

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
      setNotice(err instanceof Error ? err.message : "Could not open conversation");
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
        setNotice(
          res.created || res.contentChanged
            ? `Filed “${res.title}” (v${res.version}). Indexing in the background.`
            : `“${res.title}” is already up to date.`,
        );
        setIngest({ title: "", content: "", classification: "internal" });
        setFile(null);
        void load();
      } catch (err) {
        setNotice(err instanceof Error ? err.message : "Ingest failed");
      }
    },
    [file, ingest, load],
  );

  const seed = useCallback(async () => {
    setNotice(null);
    try {
      const result = await api.seedDemo();
      setSeedInfo(result);
      setNotice(
        `Loaded ${result.documentCount} Northwind records into “${result.sourceName}”.`,
      );
      void load();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Could not load demo knowledge");
    }
  }, [load]);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      /* ignore */
    }
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
    return <AuthScreen onAuthed={() => { setAuthed(true); void load(); }} />;
  }

  return (
    <div
      className={`desk ${ledgerTab === "evidence" ? "evidence-open" : ""} ${railOpen ? "rail-open" : ""}`}
    >
      <aside className="rail">
        <div className="brand">
          <div className="brand-mark">Internal desk</div>
          <h1>Company Brain</h1>
          <p>Answers with a paper trail.</p>
        </div>
        <div className="who">
          <div className="who-name">
            <strong>{user?.name || user?.role}</strong>
            <span>{user?.email}</span>
          </div>
          <button className="btn ghost small" onClick={() => void logout()}>
            Log out
          </button>
        </div>
        <div className="scroll">
          <div>
            <button className="btn block" onClick={newChat}>
              New question
            </button>
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
                    <span className="badge">{s.status}</span>
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
          <button className="btn ghost small mobile-only rail-toggle" onClick={() => setRailOpen((v) => !v)}>
            Menu
          </button>
          <h2>
            {activeConversationId
              ? conversations.find((c) => c.id === activeConversationId)?.title ??
                "Conversation"
              : "New question"}
          </h2>
          <button
            className="btn ghost small mobile-only ledger-toggle"
            onClick={() => setLedgerTab((t) => (t === "library" ? "evidence" : "library"))}
          >
            {ledgerTab === "library" ? "Open ledger" : "Library"}
          </button>
        </div>

        <div className="chat">
          {messages.length === 0 && (
            <div className="empty-ask">
              <h2>What does the company already know?</h2>
              <p>
                Ask a factual question. The brain only answers from documents you
                can see, and shows the source beside the answer.
              </p>
              <div className="prompts">
                {PROMPTS.map((q) => (
                  <button key={q} className="prompt" onClick={() => void send(q)}>
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
                      <span className={`badge ${m.status}`}>{m.status}</span>
                      {m.response && (
                        <span className="muted">
                          {m.response.sources.length} source
                          {m.response.sources.length === 1 ? "" : "s"}
                        </span>
                      )}
                    </div>
                  )}
                  <div className="answer">{renderAnswer(m.content, m.response?.sources, (cite) => void openDocument(cite.documentId, cite))}</div>
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
                      <button
                        className="btn ghost small"
                        onClick={() => void api.feedback({ requestId: m.response!.requestId, helpful: true })}
                      >
                        Helpful
                      </button>
                      <button
                        className="btn ghost small"
                        onClick={() => void api.feedback({ requestId: m.response!.requestId, helpful: false })}
                      >
                        Not helpful
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}

          {busy && (
            <div className="msg assistant">
              <div className="spinner">Retrieving authorized evidence…</div>
            </div>
          )}
        </div>

        <div className="composer">
          <div className="composer-box">
            <input
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
            <button className="btn" onClick={() => void send()} disabled={busy}>
              Ask
            </button>
          </div>
        </div>
      </main>

      <aside className="ledger">
        <div className="ledger-head">
          <h2>{ledgerTab === "library" ? "Library" : "Evidence"}</h2>
          <div className="tabs">
            <button
              className={ledgerTab === "library" ? "active" : ""}
              onClick={() => setLedgerTab("library")}
            >
              Library
            </button>
            <button
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
            <button className="btn signal block" onClick={() => void seed()}>
              Load Northwind demo
            </button>
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
                <input
                  type="file"
                  accept=".pdf,.md,.txt,.csv,text/plain,text/markdown,text/csv,application/pdf"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
                {file && <div className="kicker">{file.name}</div>}
              </div>
              <input
                placeholder={file ? "Title (optional)" : "Title"}
                value={ingest.title}
                onChange={(e) => setIngest({ ...ingest, title: e.target.value })}
                required={!file}
              />
              {!file && (
                <textarea
                  placeholder="Or paste the document here"
                  value={ingest.content}
                  onChange={(e) => setIngest({ ...ingest, content: e.target.value })}
                  required
                />
              )}
              <select
                value={ingest.classification}
                onChange={(e) =>
                  setIngest({ ...ingest, classification: e.target.value })
                }
              >
                <option value="public">Public</option>
                <option value="internal">Internal</option>
                <option value="confidential">Confidential — managers</option>
                <option value="restricted">Restricted — you only</option>
              </select>
              <button className="btn ghost" type="submit">
                {file ? "Upload and index" : "File this text"}
              </button>
              {notice && <div className={notice.toLowerCase().includes("fail") ? "err" : "notice"}>{notice}</div>}
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
                      <span className={`badge ${d.classification}`}>
                        {d.classification}
                      </span>
                    </div>
                    <div className="kicker">
                      {sourceNames.get(d.sourceId) ?? "Source"} · v{d.versionCount}
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
        onClick={() => onCite(source)}
        type="button"
      >
        {match[1]}
      </button>
    );
  });
}
