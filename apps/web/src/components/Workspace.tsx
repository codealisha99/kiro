"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  CitationSource,
  ConversationDto,
  DocumentDetail,
  DocumentListItem,
  EmbedStatus,
  SourceDto,
  UserDto,
} from "@kiro/shared";
import { Alert, Button, Dialog } from "@/components/ui";
import {
  api,
  ApiError,
  clearToken,
  getToken,
  SESSION_EXPIRED_EVENT,
} from "@/lib/api";
import { useThemePreference } from "./shell/use-theme";
import { useShortcuts } from "./shell/use-shortcuts";
import { useDrawer } from "./shell/use-drawer";
import { AppSidebar } from "./shell/AppSidebar";
import { TopBar } from "./shell/TopBar";
import { CommandPalette } from "./shell/CommandPalette";
import { KeyboardHelp } from "./shell/KeyboardHelp";
import { buildPaletteEntries } from "./shell/palette-entries";
import {
  searchForView,
  viewFromSearch,
  VIEW_LABELS,
  type WorkspaceView,
} from "./shell/nav";
import { AccountProfile } from "./AccountProfile";
import AuthScreen from "./AuthScreen";
import { AskView, type ChatMessage } from "./AskView";
import DocumentEditor from "./DocumentEditor";
import type { DocumentEditorHandle } from "./DocumentEditor";
import DocumentActions from "./DocumentActions";
import EvidencePanel from "./EvidencePanel";
import GoalsPage from "./GoalsPage";
import KnowledgeLibrary from "./KnowledgeLibrary";
import HomeDashboard from "./HomeDashboard";
import WorkDashboard from "./WorkDashboard";
import OrganizationWorkspace from "./OrganizationWorkspace";
import { KiroMark, WorkspaceIcon } from "./WorkspaceIcon";
import "./workspace.css";
import "./shell/shell.css";

const SIDEBAR_STORAGE_KEY = "kiro-sidebar";

function readSidebarCollapsed(): boolean {
  try {
    return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "collapsed";
  } catch {
    return false;
  }
}

export default function Workspace({
  initialAuthMode = "login",
}: {
  initialAuthMode?: "login" | "register";
}) {
  const [loaded, setLoaded] = useState(false);
  const [libraryAddRequest, setLibraryAddRequest] = useState(0);
  const [goalCreateRequest, setGoalCreateRequest] = useState(0);
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
  const [success, setSuccess] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<WorkspaceView>("home");
  const [railOpen, setRailOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(readSidebarCollapsed);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
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
  const { preference, resolved, setPreference } = useThemePreference();

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

  // Moves the view and records it in the URL so views can be shared and the back button works.
  const navigate = useCallback((next: WorkspaceView) => {
    // "New goal" and "Add document" are one-shot requests: leaving the page drops them, so a
    // later visit through the sidebar or a shortcut does not reopen the dialog.
    if (next !== "goals") setGoalCreateRequest(0);
    if (next !== "library") setLibraryAddRequest(0);
    setView(next);
    setRailOpen(false);
    window.history.pushState(
      null,
      "",
      `${window.location.pathname}${searchForView(window.location.search, next)}`,
    );
  }, []);

  useEffect(() => {
    setAuthed(!!getToken());
    setReady(true);
    const initial = viewFromSearch(window.location.search);
    if (initial) setView(initial);
    const onPop = () => setView(viewFromSearch(window.location.search) ?? "home");
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
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
    try {
      window.localStorage.setItem(SIDEBAR_STORAGE_KEY, sidebarCollapsed ? "collapsed" : "expanded");
    } catch {
      /* The sidebar state still applies for this visit. */
    }
  }, [sidebarCollapsed]);

  useDrawer(railOpen, railRef, () => setRailOpen(false));
  const shortcutsEnabled = authed && loaded;
  useShortcuts({ enabled: shortcutsEnabled, onNavigate: navigate, onOpenHelp: () => setHelpOpen(true) });
  useEffect(() => {
    if (!shortcutsEnabled) return;
    const onCommandKey = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "k") return;
      // A modal dialog makes the page inert; opening the palette behind it would trap focus nowhere.
      if (document.querySelector("dialog[open]")) return;
      event.preventDefault();
      setPaletteOpen((open) => !open);
    };
    document.addEventListener("keydown", onCommandKey);
    return () => document.removeEventListener("keydown", onCommandKey);
  }, [shortcutsEnabled]);

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
      navigate("ask");
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
    [input, busy, activeConversationId, load, navigate],
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
      navigate("ask");
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
    navigate("ask");
    requestAnimationFrame(() => composerRef.current?.focus());
  }
  function addKnowledge() {
    setLibraryAddRequest((request) => request + 1);
    navigate("library");
  }
  function showLibrary() {
    setLibraryAddRequest(0);
    navigate("library");
  }
  function newGoal() {
    setGoalCreateRequest((request) => request + 1);
    navigate("goals");
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
    setGoalCreateRequest(0);
    setUser(null);
    setLoaded(false);
    setMessages([]);
    setActiveConversationId(null);
    setRailOpen(false);
    setProfileOpen(false);
    setDocumentOpen(false);
    setEditingDocument(false);
    setDocumentBusy(false);
    setNotice(null);
    setSuccess(null);
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

  const paletteEntries = buildPaletteEntries(conversations, {
        navigate,
        newQuestion: newChat,
        newGoal,
        openConversation: (id) => void openConversation(id),
        toggleTheme: () => setPreference(resolved === "dark" ? "light" : "dark"),
        setTheme: setPreference,
        openShortcuts: () => setHelpOpen(true),
        toggleSidebar: () => setSidebarCollapsed((value) => !value),
  });

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
  const recentDocuments = [...documents]
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    )
    .slice(0, 3);
  const currentTitle = conversations.find(
    (conversation) => conversation.id === activeConversationId,
  )?.title;
  const crumbs =
    view === "ask" && currentTitle
      ? ["Workspace", VIEW_LABELS.ask, currentTitle]
      : ["Workspace", VIEW_LABELS[view]];

  return (
    <div
      className={`workspace ${railOpen ? "navigation-open" : ""} ${sidebarCollapsed ? "is-collapsed" : ""}`}
    >
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
      {user && (
        <AppSidebar
          asideRef={railRef}
          view={view}
          collapsed={sidebarCollapsed}
          onToggleCollapsed={() => setSidebarCollapsed((value) => !value)}
          onNavigate={navigate}
          onNewQuestion={newChat}
          onAddDocument={addKnowledge}
          busy={busy}
          documentCount={documents.length}
          showSetup={loaded && documents.length === 0}
          conversations={conversations}
          activeConversationId={activeConversationId}
          onOpenConversation={(id) => void openConversation(id)}
          user={user}
          preference={preference}
          onThemeChange={setPreference}
          onProfile={() => setProfileOpen(true)}
          onSignOut={() => void logout()}
        />
      )}

      <main
        id="workspace-content"
        className="workspace-main"
        inert={railOpen || undefined}
        tabIndex={-1}
      >
        <TopBar
          crumbs={crumbs}
          navExpanded={railOpen}
          onOpenNavigation={() => setRailOpen(true)}
          onOpenPalette={() => setPaletteOpen(true)}
        />
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
        ) : view === "home" ? (
          <HomeDashboard key={user?.id} />
        ) : view === "organization" ? (
          <OrganizationWorkspace key={user?.id} />
        ) : view === "work" ? (
          <WorkDashboard key={user?.id} />
        ) : view === "goals" ? (
          <GoalsPage createRequest={goalCreateRequest} />
        ) : view === "library" ? (
          <KnowledgeLibrary
            documents={documents}
            sources={sources}
            embedStatus={embedStatus}
            onOpen={(id) => void openDocument(id)}
            onRefresh={load}
            addRequest={libraryAddRequest}
          />
        ) : (
          <AskView
            loaded={loaded}
            user={user}
            documents={documents}
            recentDocuments={recentDocuments}
            messages={messages}
            busy={busy}
            input={input}
            onInputChange={setInput}
            composerRef={composerRef}
            chatEndRef={chatEndRef}
            feedback={feedback}
            send={send}
            rate={rate}
            openDocument={openDocument}
            showLibrary={showLibrary}
            addKnowledge={addKnowledge}
          />
        )}
      </main>
      <CommandPalette
        open={paletteOpen}
        entries={paletteEntries}
        onClose={() => setPaletteOpen(false)}
        onAsk={(text) => void send(text)}
      />
      <KeyboardHelp open={helpOpen} onClose={() => setHelpOpen(false)} />
      {user && (
        <AccountProfile
          user={user}
          open={profileOpen}
          onClose={() => setProfileOpen(false)}
          onLogout={logout}
        />
      )}
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
              navigate("library");
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
