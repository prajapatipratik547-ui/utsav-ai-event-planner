import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { LIMITS } from '../../../shared/constants.js';
import { offlineAssistantReply } from '../../../shared/engine/assistantFallback.js';
import { cleanUserText } from '../../../shared/text.js';
import { ApiError, requestAssistant } from '../../lib/api.js';
import { uid } from '../../lib/browser.js';
import { chatHistory, planContext } from '../../state/selectors.js';
import { useAnnounce, usePlans } from '../../state/PlansContext.js';
import type { PanelProps } from '../Dashboard.js';
import { Icon } from '../Icon.js';

const SUGGESTIONS = [
  'How can I cut 10% from my budget?',
  'What should I do this week?',
  'Suggest a fun entry for the guest of honour',
  'How do I handle guests with dietary needs?',
];

export function AssistantPanel({ saved, today }: PanelProps) {
  const { dispatch } = usePlans();
  const announce = useAnnounce();
  const id = useId();
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const logRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const chat = saved.progress.chat;

  useEffect(() => {
    logRef.current?.scrollTo?.({ top: logRef.current.scrollHeight });
  }, [chat.length, pending]);

  useEffect(() => () => abortRef.current?.abort(), []);

  async function send(text: string) {
    const content = cleanUserText(text, LIMITS.assistantMessageMax);
    if (!content || pending) return;
    setError('');
    setDraft('');
    const userEntry = { id: uid(), role: 'user' as const, content };
    dispatch({ type: 'chat/append', id: saved.id, entry: userEntry });
    setPending(true);

    const context = planContext(saved, today);
    const history = [
      ...chatHistory(saved, LIMITS.assistantHistoryMax - 1),
      { role: 'user' as const, content },
    ];
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      let reply: string;
      let source: 'gemini' | 'groq' | 'offline';
      try {
        ({ reply, source } = await requestAssistant(context, history, controller.signal));
      } catch (err) {
        if (err instanceof ApiError && err.recoverable) {
          reply = offlineAssistantReply(context, content);
          source = 'offline';
        } else {
          throw err;
        }
      }
      dispatch({
        type: 'chat/append',
        id: saved.id,
        entry: { id: uid(), role: 'assistant', content: reply, source },
      });
      announce(`Assistant replied: ${reply.slice(0, 160)}`);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setError(
        err instanceof ApiError ? err.message : 'The assistant could not answer. Please try again.',
      );
    } finally {
      if (!controller.signal.aborted) setPending(false);
    }
  }

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    void send(draft);
  };

  return (
    <div className="panel-grid two">
      <section className="card chat" aria-labelledby={`${id}-title`}>
        <h2 id={`${id}-title`} className="sr-only">
          Chat with the planning assistant
        </h2>
        <div
          className="chat-log"
          ref={logRef}
          role="log"
          aria-live="polite"
          aria-relevant="additions"
          aria-label="Conversation"
        >
          {chat.length === 0 && (
            <div className="empty">
              <h3>Ask anything about this plan</h3>
              <p>
                The assistant knows your budget, timeline and progress. Try a suggestion on the
                right.
              </p>
            </div>
          )}
          {chat.map((entry) => (
            <div key={entry.id} className={`bubble ${entry.role}`}>
              <span className="who">
                {entry.role === 'user'
                  ? 'You'
                  : `Utsav assistant${entry.source === 'offline' ? ' (offline)' : ''}`}
              </span>
              {entry.content}
            </div>
          ))}
          {pending && (
            <div className="bubble assistant" aria-label="Assistant is typing">
              <span className="who">Utsav assistant</span>
              Thinking
              <span className="loading-dots" />
            </div>
          )}
        </div>
        <form className="chat-form" onSubmit={onSubmit}>
          <label htmlFor={`${id}-input`} className="sr-only">
            Your question
          </label>
          <input
            id={`${id}-input`}
            className="input"
            value={draft}
            maxLength={LIMITS.assistantMessageMax}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Ask about budget, vendors, ideas…"
            autoComplete="off"
            aria-describedby={error ? `${id}-error` : undefined}
          />
          <button
            type="submit"
            className="btn btn-primary"
            disabled={pending || draft.trim().length === 0}
          >
            <Icon name="send" /> <span>Send</span>
          </button>
        </form>
        {error && (
          <p
            className="error-text"
            id={`${id}-error`}
            role="alert"
            style={{ padding: '0 14px 14px', margin: 0 }}
          >
            {error}
          </p>
        )}
      </section>
      <div className="stack">
        <section className="card" aria-labelledby={`${id}-ideas`}>
          <h2 id={`${id}-ideas`}>Try asking</h2>
          <div className="suggestions">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                className="btn btn-outline btn-sm"
                style={{ whiteSpace: 'normal', textAlign: 'left' }}
                disabled={pending}
                onClick={() => void send(s)}
              >
                {s}
              </button>
            ))}
          </div>
        </section>
        {chat.length > 0 && (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              dispatch({ type: 'chat/clear', id: saved.id });
              announce('Conversation cleared.');
            }}
          >
            <Icon name="trash" /> Clear conversation
          </button>
        )}
        <p className="hint">
          Replies are AI-generated suggestions. Double-check important details with your vendors.
        </p>
      </div>
    </div>
  );
}
