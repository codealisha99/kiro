"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type {
  BrainQueryResponse,
  CitationSource,
  ConversationDto,
  DocumentDetail,
  DocumentListItem,
  EmbedStatus,
  SourceDto,
  UserDto,
} from "@kiro/shared";
import {
  Alert,
  Button,
  Dialog,
  Input,
  StatefulButton,
  Textarea,
} from "@/components/ui";
import {
  api,
  ApiError,
  clearToken,
  getToken,
  SESSION_EXPIRED_EVENT,
} from "@/lib/api";
import { AccountProfile } from "./AccountProfile";
import AuthScreen from "./AuthScreen";
import DocumentEditor from "./DocumentEditor";
import type { DocumentEditorHandle } from "./DocumentEditor";
import DocumentActions from "./DocumentActions";
import EvidencePanel from "./EvidencePanel";
import KnowledgeLibrary from "./KnowledgeLibrary";
import WorkDashboard from "./WorkDashboard";
import OrganizationWorkspace from "./OrganizationWorkspace";
import { KiroMark, WorkspaceIcon } from "./WorkspaceIcon";
import "./workspace.css";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  status?: BrainQueryResponse["status"];
  response?: BrainQueryResponse;
}

const PROMPTS = [
  {
    label: "Understand a policy",
    query: "What is our refund policy?",
    icon: "book" as const,
  },
  {
    label: "Find a process",
    query: "How do we onboard a new supplier?",
    icon: "search" as const,
  },
  {
    label: "Catch up on a client",
    query: "What happened with Client Helios?",
    icon: "message" as const,
  },
];

export default function Workspace({
  initialAuthMode = "login",
}: {
  initialAuthMode?: "login" | "register";
}) {
  const [loaded, setLoaded] = useState(false);
  const [libraryAddRequest, setLibraryAddRequest] = useState(0);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [user, setUser] = useState<UserDto | null>(null);
  const [sources, setSources] = useState<SourceDto[]>([]);
  const [documents, setDocuments] = useState<DocumentListItem[]>([]);
  const [conversations, setConversations] = useState<ConversationDto[]>([]);
  const [embedStatus, setEmbedStatus] = useState<EmbedStatus | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<
    string | null
  >(null);
  const [conversationSearch, setConversationSearch] = useState("");
  const [success, setSuccess] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<"ask" | "library" | "work" | "organization">("ask");
  const [railOpen, setRailOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [editingDocument, setEditingDocument] = useState(false);
  const [documentBusy, setDocumentBusy] = useState(false);
  const documentEditorRef = useRef<DocumentEditorHandle>(null);
  const documentVersionRef = useRef<number | undefined>(undefined);
  const [documentOpen, setDocumentOpen] = useState(false);
  const [openDoc, setOpenDoc] = useState<DocumentDetail | null>(null);
  const [activeCite, setActiveCite] = useState<CitationSource | null>(null);
  const [docLoading, setDocLoading] = useState(false);
  const [docError, setDocError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Record<string, "pending" | "saved">>(
    {},
  );
  const railRef = useRef<HTMLElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const activeDocumentId = useRef<string | null>(null);
  const documentRequestRef = useRef(0);

  const load = useCallback(async () => {
    const session = getToken();
    if (!session) return;
    try {
      const [me, srcs, docs, convs, embeds] = await Promise.all([
        api.me(),
        api.sources(),
        api.documents(),
        api.conversations(),
        api.embedStatus().catch(() => null),
      ]);
      if (getToken() !== session) return;
      setUser(me);
      setSources(srcs);
      setDocuments(docs);
      setConversations(convs);
      setEmbedStatus(embeds);
      setLoaded(true);
    } catch (err) {
      if (getToken() !== session) return;
      if (err instanceof ApiError && err.status === 401) {
        clearToken();
        setAuthed(false);
      } else
        setNotice("Your workspace could not be refreshed. Please try again.");
    }
  }, []);

  useEffect(() => {
    setAuthed(!!getToken());
    setReady(true);
    if (new URLSearchParams(window.location.search).get("integration") === "xero") setView("organization");
  }, []);
  useEffect(() => {
    const expire = () => {
      setAuthed(false);
      setSessionExpired(true);
      setLoaded(false);
      setUser(null);
      setDocuments([]);
      setSources([]);
      setConversations([]);
      setMessages([]);
      setActiveConversationId(null);
      setEmbedStatus(null);
      setDocumentOpen(false);
      setEditingDocument(false);
      setDocumentBusy(false);
      setOpenDoc(null);
      setActiveCite(null);
      documentRequestRef.current += 1;
      setRailOpen(false);
      setFeedback({});
      setInput("");
      setConversationSearch("");
      setSuccess(null);
      setNotice(null);
      setView("ask");
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, expire);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, expire);
  }, []);
  useEffect(() => {
    if (authed) void load();
  }, [authed, load]);
  const indexing = authed && embedStatus !== null && !embedStatus.ready;
  useEffect(() => {
    if (!indexing) return;
    const timer = window.setInterval(() => {
      const session = getToken();
      void api
        .embedStatus()
        .then((status) => { if (getToken() === session) setEmbedStatus(status); })
        .catch(() => undefined);
    }, 10_000);
    return () => window.clearInterval(timer);
  }, [indexing]);
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ block: "end" });
  }, [messages, busy]);
  useEffect(() => {
    const textarea = composerRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
    }
  }, [input]);

  useEffect(() => {
    if (!railOpen || !railRef.current) return;
    const panel = railRef.current;
    const previous = document.activeElement as HTMLElement | null;
    const controls = () =>
      Array.from(
        panel.querySelectorAll<HTMLElement>("button:not(:disabled), a[href], input:not(:disabled)"),
      ).filter((element) => element.getClientRects().length > 0);
    controls()[0]?.focus();
    const handleKey = (event: KeyboardEvent) => {
      // A native modal owns keyboard focus until it closes.
      if (document.querySelector("dialog[open]")) return;
      if (event.key === "Escape") setRailOpen(false);
      if (event.key !== "Tab") return;
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
    };
    const media = window.matchMedia("(min-width: 761px)");
    const closeOnDesktop = () => {
      if (media.matches) setRailOpen(false);
    };
    media.addEventListener("change", closeOnDesktop);
    document.addEventListener("keydown", handleKey);
    return () => {
      media.removeEventListener("change", closeOnDesktop);
      document.removeEventListener("keydown", handleKey);
      if (previous?.isConnected) previous.focus();
    };
  }, [railOpen]);

  const openDocument = useCallback(
    async (id: string, cite?: CitationSource, version = cite?.version) => {
      const request = ++documentRequestRef.current;
      activeDocumentId.current = id;
      documentVersionRef.current = version;
      setEditingDocument(false);
      setDocumentOpen(true);
      setDocLoading(true);
      setDocError(null);
      setOpenDoc(null);
      setActiveCite(cite ?? null);
      try {
        const detail = version === undefined ? await api.document(id) : await api.documentVersion(id, version);
        if (request === documentRequestRef.current) setOpenDoc(detail);
      } catch (err) {
        if (request === documentRequestRef.current)
          setDocError(
            err instanceof Error
              ? err.message
              : "Could not open this document.",
          );
      } finally {
        if (request === documentRequestRef.current) setDocLoading(false);
      }
    },
    [],
  );

  const send = useCallback(
    async (text?: string) => {
      const question = (text ?? input).trim();
      if (!question || busy) return;
      const session = getToken();
      setView("ask");
      setNotice(null);
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
        if (getToken() !== session) return;
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
        if (getToken() !== session) return;
        const content =
          err instanceof ApiError && err.status === 503
            ? "Answers are temporarily unavailable. You can still browse your documents in the library."
            : err instanceof Error
              ? err.message
              : "We couldn’t find an answer. Please try again.";
        setMessages((prev) => [
          ...prev,
          {
            id: `e-${Date.now()}`,
            role: "assistant",
            content,
            status: "error",
          },
        ]);
      } finally {
        setBusy(false);
      }
    },
    [input, busy, activeConversationId, load],
  );

  async function openConversation(id: string) {
    if (busy) return;
    setBusy(true);
    setNotice(null);
    const session = getToken();
    try {
      const detail = await api.conversation(id);
      if (getToken() !== session) return;
      setActiveConversationId(detail.id);
      setMessages(
        detail.messages.flatMap((item): ChatMessage[] => [
          { id: `${item.id}-q`, role: "user", content: item.query },
          {
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
          },
        ]),
      );
      setView("ask");
      setRailOpen(false);
    } catch {
      if (getToken() !== session) return;
      setNotice("This conversation could not be opened. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function newChat() {
    if (busy) return;
    setActiveConversationId(null);
    setMessages([]);
    setInput("");
    setNotice(null);
    setView("ask");
    setRailOpen(false);
    requestAnimationFrame(() => composerRef.current?.focus());
  }
  function addKnowledge() {
    setLibraryAddRequest((request) => request + 1);
    setView("library");
    setRailOpen(false);
  }
  function showLibrary() {
    setLibraryAddRequest(0);
    setView("library");
    setRailOpen(false);
  }
  async function logout() {
    try {
      await api.logout();
    } catch {
      /* Clear the local session even if the API is unavailable. */
    }
    clearToken();
    setAuthed(false);
    setSessionExpired(false);
    setLibraryAddRequest(0);
    setUser(null);
    setLoaded(false);
    setMessages([]);
    setActiveConversationId(null);
    setRailOpen(false);
    setDocumentOpen(false);
    setEditingDocument(false);
    setDocumentBusy(false);
    setNotice(null);
    setSuccess(null);
    setConversationSearch("");
    documentRequestRef.current += 1;
    setOpenDoc(null);
    setActiveCite(null);
    setView("ask");
    setDocuments([]);
    setSources([]);
    setConversations([]);
    setEmbedStatus(null);
    setInput("");
    setFeedback({});
  }
  async function rate(requestId: string, helpful: boolean) {
    const session = getToken();
    setFeedback((prev) => ({ ...prev, [requestId]: "pending" }));
    try {
      await api.feedback({ requestId, helpful });
      if (getToken() !== session) return;
      setFeedback((prev) => ({ ...prev, [requestId]: "saved" }));
    } catch {
      if (getToken() !== session) return;
      setFeedback((prev) => {
        const next = { ...prev };
        delete next[requestId];
        return next;
      });
      setNotice("Feedback could not be saved. Please try again.");
    }
  }

  if (!ready) return null;
  if (!authed)
    return (
      <AuthScreen
        initialMode={initialAuthMode}
        sessionExpired={sessionExpired}
        onAuthed={() => {
          setSessionExpired(false);
          setAuthed(true);
        }}
      />
    );
  const empty = messages.length === 0;
  const recentDocuments = [...documents]
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    )
    .slice(0, 3);
  const matchingConversations = conversations.filter((conversation) =>
    (conversation.title ?? "Untitled question").toLowerCase().includes(conversationSearch.trim().toLowerCase()),
  );
  const currentTitle = conversations.find(
    (conversation) => conversation.id === activeConversationId,
  )?.title;

  return (
    <div className={`workspace ${railOpen ? "navigation-open" : ""}`}>
      <a className="skip-link" href="#workspace-content">
        Skip to knowledge desk
      </a>
      {railOpen && (
        <button
          className="workspace-backdrop"
          aria-label="Close navigation"
          tabIndex={-1}
          onClick={() => setRailOpen(false)}
        />
      )}
      <aside
        className="workspace-sidebar"
        ref={railRef}
        id="workspace-navigation"
        aria-label="Workspace navigation"
      >
        <div className="workspace-brand">
          <span className="workspace-mark">
            <KiroMark />
          </span>
          <Link href="/" className="workspace-home" aria-label="Kiro home">
            kiro
          </Link>
          <Button
            className="workspace-mobile icon-button"
            variant="secondary"
            aria-label="Close navigation"
            onClick={() => setRailOpen(false)}
          >
            <WorkspaceIcon name="close" />
          </Button>
        </div>
        <p className="workspace-label">Your knowledge desk</p>
        <nav className="workspace-nav" aria-label="Main">
          <Button
            variant="secondary"
            className="new-question"
            onClick={newChat}
            disabled={busy}
          >
            <WorkspaceIcon name="plus" />
            New question
          </Button>
          <button
            className={`nav-item ${view === "ask" ? "selected" : ""}`}
            aria-current={view === "ask" ? "page" : undefined}
            onClick={() => {
              setView("ask");
              setRailOpen(false);
            }}
          >
            <WorkspaceIcon name="message" />
            Ask Kiro
          </button>
          <button
            className={`nav-item ${view === "library" ? "selected" : ""}`}
            aria-current={view === "library" ? "page" : undefined}
            onClick={showLibrary}
          >
            <WorkspaceIcon name="book" />
            Library<span className="nav-count">{documents.length || ""}</span>
          </button>
          <button className={`nav-item ${view === "work" ? "selected" : ""}`}
            aria-current={view === "work" ? "page" : undefined}
            onClick={() => { setView("work"); setRailOpen(false); }}>
            <WorkspaceIcon name="book" />Work &amp; insights
          </button>
          <button className={`nav-item ${view === "organization" ? "selected" : ""}`} aria-current={view === "organization" ? "page" : undefined} onClick={() => { setView("organization"); setRailOpen(false); }}>
            <WorkspaceIcon name="book" /><span>Company dashboards</span>
          </button>
        </nav>
        <div className="workspace-recents">
          <h2>Recent conversations</h2>
          {conversations.length > 0 && (
            <div className="conversation-search">
              <Input type="search" aria-label="Search conversations" placeholder="Find a conversation…" value={conversationSearch} onChange={(event) => setConversationSearch(event.target.value)} />
            </div>
          )}
          {conversations.length > 0 && matchingConversations.length === 0 && (
            <p role="status">No matching conversations. Try another search.</p>
          )}
          {conversations.length === 0 ? (
            <p>A little clarity starts with a question.</p>
          ) : (
            matchingConversations.map((conversation) => (
              <button
                key={conversation.id}
                className={
                  conversation.id === activeConversationId && view === "ask"
                    ? "active"
                    : ""
                }
                onClick={() => void openConversation(conversation.id)}
                disabled={busy}
                title={conversation.title ?? "Untitled question"}
              >
                <WorkspaceIcon name="message" />
                <span>{conversation.title ?? "Untitled question"}</span>
              </button>
            ))
          )}
        </div>
        {loaded && documents.length === 0 && (
          <button className="sidebar-setup" onClick={addKnowledge}>
            <WorkspaceIcon name="upload" />
            <span>
              <strong>Make this desk yours</strong>
              <small>Add your first document</small>
            </span>
            <WorkspaceIcon name="chevron" />
          </button>
        )}
        {user && <AccountProfile user={user} onLogout={logout} />}
      </aside>

      <main
        id="workspace-content"
        className="workspace-main"
        inert={railOpen || undefined}
        tabIndex={-1}
      >
        <header className="workspace-header">
          <div>
            <Button
              variant="secondary"
              className="workspace-mobile icon-button"
              aria-label="Open navigation"
              aria-expanded={railOpen}
              aria-controls="workspace-navigation"
              onClick={() => setRailOpen(true)}
            >
              <WorkspaceIcon name="menu" />
            </Button>
            <span className="workspace-breadcrumb">
              Workspace <span aria-hidden="true">/</span>
            </span>
            <span>
              {view === "organization" ? "Company dashboards" : view === "work" ? "Work & insights" : view === "library"
                ? "Knowledge library"
                : currentTitle || "Ask Kiro"}
            </span>
          </div>
          <button className="workspace-library-link" onClick={showLibrary}>
            <WorkspaceIcon name="book" />
            <span>
              {documents.length} document{documents.length === 1 ? "" : "s"}
            </span>
          </button>
        </header>
        {success && (
          <div className="workspace-notice">
            <Alert tone="success">{success}<Button variant="secondary" size="small" onClick={() => setSuccess(null)}>Dismiss</Button></Alert>
          </div>
        )}
        {notice && (
          <div className="workspace-notice">
            <Alert tone="danger">
              {notice}
              <button
                className="dismiss-notice"
                aria-label="Dismiss message"
                onClick={() => setNotice(null)}
              >
                <WorkspaceIcon name="close" />
              </button>
            </Alert>
          </div>
        )}
        {!loaded ? (
          <div className="workspace-loading" role="status">
            <KiroMark />
            <p>
              {notice
                ? "Your desk could not be loaded."
                : "Opening your knowledge desk…"}
            </p>
            {notice && (
              <Button variant="secondary" onClick={() => { setNotice(null); void load(); }}>
                Try again
              </Button>
            )}
          </div>
        ) : view === "organization" ? <OrganizationWorkspace key={user?.id} /> : view === "work" ? <WorkDashboard key={user?.id} /> : view === "library" ? (
          <KnowledgeLibrary
            documents={documents}
            sources={sources}
            embedStatus={embedStatus}
            onOpen={(id) => void openDocument(id)}
            onRefresh={load}
            addRequest={libraryAddRequest}
          />
        ) : (
          <div
            className={`question-view ${empty ? "is-empty" : "has-messages"}`}
          >
            {empty ? (
              <div className="question-welcome">
                <span className="welcome-eyebrow">
                  <span className="welcome-emblem">
                    <KiroMark />
                  </span>
                  {user?.name
                    ? `Welcome, ${user.name.split(" ")[0]}`
                    : "Your company knowledge, within reach"}
                </span>
                <h1>
                  {loaded && !documents.length ? (
                    <>
                      Give your knowledge
                      <br />a place to work.
                    </>
                  ) : (
                    <>
                      Your next answer
                      <br />
                      starts here.
                    </>
                  )}
                </h1>
                <p>
                  {loaded && !documents.length
                    ? "Start with a handbook, a process guide, or a few useful notes."
                    : "Ask a question. Follow the evidence. Get on with your day."}
                </p>
                {loaded && !documents.length && (
                  <div className="welcome-setup">
                    <Button variant="primary" onClick={addKnowledge}>
                      <WorkspaceIcon name="plus" />
                      Add your first document
                    </Button>
                    <Button variant="secondary" onClick={showLibrary}>
                      Explore with samples
                    </Button>
                    <span>
                      PDF, Word, spreadsheets, Markdown, or plain text.
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="conversation-scroll">
                <div className="conversation-content">
                  {messages.map((message, index) => (
                    <article
                      className={`conversation-message ${message.role} ${message.status === "error" ? "has-error" : ""}`}
                      key={message.id}
                    >
                      {message.role === "user" ? (
                        <h2>{message.content}</h2>
                      ) : message.status === "error" ? (
                        <div className="answer-error" role="alert">
                          <span className="answer-label">Unable to answer</span>
                          <p>{message.content}</p>
                          <div>
                            <button
                              onClick={() =>
                                void send(messages[index - 1]?.content)
                              }
                              disabled={busy}
                            >
                              Try again
                            </button>
                            <button onClick={showLibrary}>
                              Browse library
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="answer-byline">
                            <KiroMark />
                            <span>Kiro</span>
                            {message.status &&
                              message.status !== "answered" && (
                                <span className="answer-status">
                                  {message.status === "unknown"
                                    ? "No matching answer"
                                    : message.status === "partial"
                                      ? "Partial answer"
                                      : "Sources differ"}
                                </span>
                              )}
                          </div>
                          <div className="answer">
                            {renderAnswer(
                              message.content,
                              message.response?.sources,
                              (cite) =>
                                void openDocument(cite.documentId, cite),
                            )}
                          </div>
                          {!!message.response?.sources.length && (
                            <div className="answer-source-group">
                              <p className="answer-source-label">
                                Supporting sources
                              </p>
                              <div className="answer-sources">
                                {message.response.sources.map((source, i) => (
                                  <button
                                    key={`${source.documentId}-${i}`}
                                    onClick={() =>
                                      void openDocument(
                                        source.documentId,
                                        source,
                                      )
                                    }
                                  >
                                    <span>{source.citationIndex ?? i + 1}</span>
                                    {source.title}
                                    <WorkspaceIcon
                                      name="chevron"
                                      width="12"
                                      height="12"
                                    />
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                          {message.response && (
                            <div className="answer-feedback">
                              {feedback[message.id] === "saved" ? (
                                <span role="status">
                                  Thanks for your feedback.
                                </span>
                              ) : (
                                <>
                                  <span>Was this helpful?</span>
                                  <button
                                    disabled={!!feedback[message.id]}
                                    onClick={() => void rate(message.id, true)}
                                  >
                                    Yes
                                  </button>
                                  <button
                                    disabled={!!feedback[message.id]}
                                    onClick={() => void rate(message.id, false)}
                                  >
                                    No
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </article>
                  ))}
                  {busy && (
                    <p className="answer-loading" role="status">
                      <span className="status-dot" />
                      Finding the right sources…
                    </p>
                  )}
                  <div ref={chatEndRef} />
                </div>
              </div>
            )}
            {(!empty || documents.length > 0) && (
              <div className="question-entry">
                <form
                  className="question-composer"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void send();
                  }}
                >
                  <Textarea
                    ref={composerRef}
                    aria-label="Ask a question"
                    placeholder={
                      empty
                        ? "Ask anything about your company…"
                        : "Ask a follow-up question…"
                    }
                    rows={2}
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (
                        event.key === "Enter" &&
                        !event.shiftKey &&
                        !event.nativeEvent.isComposing
                      ) {
                        event.preventDefault();
                        void send();
                      }
                    }}
                    disabled={busy}
                  />
                  <div className="composer-toolbar">
                    <span>
                      <WorkspaceIcon name="lock" width="13" height="13" />
                      {documents.length} document
                      {documents.length === 1 ? "" : "s"} in your library
                    </span>
                    <span className="composer-shortcut">
                      Enter to ask <kbd>↵</kbd>
                    </span>
                    <StatefulButton
                      loading={busy}
                      variant="primary"
                      type="submit"
                      className="send-question"
                      aria-label={busy ? "Finding an answer" : "Send question"}
                      disabled={busy || !input.trim()}
                    >
                      {!busy && (
                        <WorkspaceIcon name="arrow" width="20" height="20" />
                      )}
                    </StatefulButton>
                  </div>
                </form>
                {empty ? (
                  <div className="question-suggestions">
                    {PROMPTS.map((prompt) => (
                      <button
                        key={prompt.label}
                        onClick={() => {
                          setInput(prompt.query);
                          composerRef.current?.focus();
                        }}
                      >
                        <WorkspaceIcon name={prompt.icon} />
                        <span>
                          <strong>{prompt.label}</strong>
                          <small>{prompt.query}</small>
                        </span>
                        <WorkspaceIcon name="chevron" />
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="composer-note">
                    Knowledge answers cite your sources. Ask “What is blocked on my team?” for a snapshot of work you can access.
                  </p>
                )}
              </div>
            )}
            {empty && documents.length > 0 && (
              <section
                className="desk-documents"
                aria-labelledby="desk-documents-title"
              >
                <div className="desk-documents-heading">
                  <h2 id="desk-documents-title">From your library</h2>
                  <button onClick={showLibrary}>
                    View all <WorkspaceIcon name="chevron" />
                  </button>
                </div>
                <div className="desk-document-list">
                  {recentDocuments.map((doc) => (
                    <button
                      key={doc.id}
                      onClick={() => void openDocument(doc.id)}
                    >
                      <WorkspaceIcon name="file" />
                      <span>{doc.title}</span>
                      <WorkspaceIcon name="chevron" />
                    </button>
                  ))}
                </div>
              </section>
            )}
            {empty && (
              <p className="welcome-footnote">
                <WorkspaceIcon name="lock" width="12" height="12" />
                Answers grounded in your team’s knowledge.
              </p>
            )}
          </div>
        )}
      </main>
      <Dialog
        open={documentOpen}
        closeDisabled={documentBusy}
        onClose={() => {
          if (documentBusy) return;
          if (editingDocument) documentEditorRef.current?.requestClose();
          else {
            documentRequestRef.current += 1;
            setDocumentOpen(false);
          }
        }}
        title={editingDocument ? "Edit document" : activeCite ? "Answer source" : "Document"}
        className="document-dialog"
      >
        {docError ? (
          <Alert tone="danger">{docError}
            <Button variant="secondary" onClick={() => { if (activeDocumentId.current) void openDocument(activeDocumentId.current, activeCite ?? undefined, documentVersionRef.current); }}>Try again</Button>
          </Alert>
        ) : editingDocument && openDoc ? (
          <DocumentEditor ref={documentEditorRef} key={`${openDoc.id}-${openDoc.selectedVersion}`}
            document={openDoc} onBusyChange={setDocumentBusy}
            onCancel={() => setEditingDocument(false)}
            onSaved={(detail) => {
              setOpenDoc(detail);
              setEditingDocument(false);
              setActiveCite(null);
              documentVersionRef.current = undefined;
              setDocuments((docs) => docs.map((doc) => doc.id === detail.id ? detail : doc));
              setSuccess(`Version ${detail.selectedVersion} saved. New answers will use this revision.`);
              void load();
            }} />
        ) : (
          <>
          <EvidencePanel
            document={openDoc}
            citation={activeCite}
            loading={docLoading}
          />
          {openDoc && !docLoading && (
            <DocumentActions key={`${openDoc.id}-${openDoc.selectedVersion}`} document={openDoc} disabled={busy || documentBusy}
              onEdit={() => setEditingDocument(true)} onBusyChange={setDocumentBusy}
              onOpenVersion={(version) => void openDocument(openDoc.id, activeCite?.version === version ? activeCite : undefined, version)}
              onDeleted={(id) => {
              documentRequestRef.current += 1;
              setDocuments((docs) => docs.filter((doc) => doc.id !== id));
              setOpenDoc(null);
              setActiveCite(null);
              setDocumentOpen(false);
              setMessages([]);
              setActiveConversationId(null);
              setView("library");
              setSuccess("Document removed from the workspace library.");
              void load();
            }} />
          )}
          </>
        )}
      </Dialog>
    </div>
  );
}

function renderAnswer(
  text: string,
  sources: CitationSource[] | undefined,
  onCite: (source: CitationSource) => void,
) {
  return text.split(/(\[\d+\])/g).map((part, index) => {
    const match = part.match(/^\[(\d+)\]$/);
    const source = match ? sources?.find((source, index) => (source.citationIndex ?? index + 1) === Number(match[1])) : undefined;
    return source ? (
      <button
        key={index}
        className="cite-chip"
        aria-label={`Open source ${match![1]}: ${source.title}`}
        onClick={() => onCite(source)}
      >
        {match![1]}
      </button>
    ) : (
      <span key={index}>{part}</span>
    );
  });
}
