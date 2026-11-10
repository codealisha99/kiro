"use client";

import type { RefObject } from "react";
import type {
  BrainQueryResponse,
  CitationSource,
  DocumentListItem,
  UserDto,
} from "@kiro/shared";
import { Button, StatefulButton, Textarea } from "@/components/ui";
import { KiroMark, WorkspaceIcon } from "./WorkspaceIcon";
import "./ask-view.css";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  status?: BrainQueryResponse["status"];
  response?: BrainQueryResponse;
}

const PROMPTS = [
  { label: "Understand a policy", query: "What is our refund policy?" },
  { label: "Find a process", query: "How do we onboard a new supplier?" },
  { label: "Catch up on everything", query: "What's happening?" },
];

export interface AskViewProps {
  loaded: boolean;
  user: UserDto | null;
  documents: DocumentListItem[];
  recentDocuments: DocumentListItem[];
  messages: ChatMessage[];
  busy: boolean;
  input: string;
  onInputChange: (value: string) => void;
  composerRef: RefObject<HTMLTextAreaElement | null>;
  chatEndRef: RefObject<HTMLDivElement | null>;
  feedback: Record<string, "pending" | "saved">;
  send: (text?: string) => void | Promise<void>;
  rate: (requestId: string, helpful: boolean) => void | Promise<void>;
  openDocument: (id: string, cite?: CitationSource) => void | Promise<void>;
  showLibrary: () => void;
  addKnowledge: () => void;
}

// The question screen: welcome, conversation, composer, and starters.
export function AskView({
  loaded,
  user,
  documents,
  recentDocuments,
  messages,
  busy,
  input,
  onInputChange,
  composerRef,
  chatEndRef,
  feedback,
  send,
  rate,
  openDocument,
  showLibrary,
  addKnowledge,
}: AskViewProps) {
  const empty = messages.length === 0;
  return (
            <div
              className={`question-view ask-view ${empty ? "is-empty" : "has-messages"}`}
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
                      onChange={(event) => onInputChange(event.target.value)}
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
                        <kbd>Enter</kbd> to send · <kbd>Shift</kbd>+<kbd>Enter</kbd> for a new line
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
                    <div className="ask-chips" role="group" aria-label="Suggested questions">
                      {PROMPTS.map((prompt) => (
                        <button
                          key={prompt.label}
                          type="button"
                          className="ask-chip"
                          title={prompt.label}
                          onClick={() => {
                            onInputChange(prompt.query);
                            composerRef.current?.focus();
                          }}
                        >
                          {prompt.query}
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

