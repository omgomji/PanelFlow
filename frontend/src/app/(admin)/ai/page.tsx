'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { askPanelFlow, cancelMeeting, type AiCitation, type PanelFlowAiResponse } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { AlertDialog } from '@/components/ui/AlertDialog';

const SUGGESTIONS = [
  'What did I discuss in my recent meetings?',
  'Find meetings related to payments or API integration.',
  'What action items came up in my previous meetings?',
  'Prepare me for my meeting tomorrow.',
];

function formatDate(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function sourceLabel(citation: AiCitation) {
  if (citation.sourceType === 'feedback') return 'Interview feedback';
  if (citation.sourceType === 'eventType') return 'Meeting type';
  if (citation.sourceType === 'contact') return 'Contact';
  if (citation.sourceType === 'panel') return 'Panel';
  if (citation.sourceType === 'position') return 'Position';
  return 'Meeting';
}

export default function AskPanelFlowPage() {
  const [query, setQuery] = useState('');
  const [history, setHistory] = useState<Array<{ query: string; response: PanelFlowAiResponse }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pendingCancel, setPendingCancel] = useState<number | null>(null);
  const [notice, setNotice] = useState({ isOpen: false, title: '', message: '' });
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const prompt = new URLSearchParams(window.location.search).get('prompt');
    if (prompt) {
      setQuery(prompt);
      window.setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, []);

  const submit = async (event?: FormEvent, queryOverride?: string) => {
    event?.preventDefault();
    const trimmed = (queryOverride ?? query).trim();
    if (!trimmed || loading) return;

    setLoading(true);
    setError('');
    try {
      const response = await askPanelFlow(trimmed);
      setHistory((items) => [...items, { query: trimmed, response }]);
      setQuery('');
    } catch (err: any) {
      const message = err?.response?.data?.error || err?.message || 'PanelFlow AI could not answer right now.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const retryLast = async () => {
    const last = history[history.length - 1];
    if (!last) return;
    setQuery(last.query);
    await submit(undefined, last.query);
  };

  const confirmCancel = async () => {
    if (pendingCancel === null) return;
    const id = pendingCancel;
    setPendingCancel(null);
    try {
      await cancelMeeting(id);
      setHistory((items) => items.map((item) => {
        if (item.response.pendingAction?.bookingId !== id) return item;
        return {
          ...item,
          response: {
            ...item.response,
            answer: `${item.response.answer}\n\nThe meeting was cancelled using PanelFlow's existing booking service.`,
            pendingAction: undefined,
          },
        };
      }));
    } catch (err: any) {
      setNotice({
        isOpen: true,
        title: 'Action failed',
        message: err?.response?.data?.error || err?.message || 'The meeting could not be cancelled.',
      });
    }
  };

  const latest = history[history.length - 1];

  return (
    <div className="space-y-8">
      <header>
        <div className="flex items-center gap-2 mb-2">
          <span className="stamp-chip">AI ASSISTANT</span>
          <span className="text-xs font-mono text-ink/40">GROUNDED IN YOUR AUTHORIZED PANELFLOW DATA</span>
        </div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-ink">Ask PanelFlow</h1>
        <p className="mt-2 max-w-2xl text-sm text-ink/60">
          Ask contextual questions about meetings, interview context, contacts, and scheduling. Exact calendar questions use PanelFlow&apos;s deterministic scheduling data.
        </p>
      </header>

      <Card className="shadow-[4px_4px_0px_rgba(27,31,43,0.12)]">
        <CardHeader>
          <CardTitle>What do you need?</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <textarea
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  void submit();
                }
              }}
              rows={4}
              maxLength={2000}
              placeholder="e.g. What did we discuss about the payment integration?"
              className="w-full resize-y border-2 border-ink bg-paper px-4 py-3 text-sm text-ink placeholder:text-clay/60 focus:outline-none focus:ring-2 focus:ring-stamp"
              disabled={loading}
            />
            <div className="flex items-center justify-between gap-4">
              <div className="text-xs font-mono text-ink/40">Enter to ask · Shift+Enter for a new line</div>
              <Button type="submit" size="md" disabled={loading || !query.trim()}>
                {loading ? 'Thinking…' : 'Ask PanelFlow'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {!history.length && (
        <section>
          <div className="mb-3 text-xs font-mono uppercase tracking-wider text-ink/40">Try a question</div>
          <div className="grid gap-3 sm:grid-cols-2">
            {SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => setQuery(suggestion)}
                className="border border-clay/40 bg-paper p-4 text-left text-sm text-ink transition-colors hover:border-ink hover:bg-clay/5"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </section>
      )}

      {error && (
        <Card className="border-oxblood">
          <CardContent className="space-y-4">
            <div>
              <div className="font-display font-bold text-oxblood">PanelFlow AI ran into a problem</div>
              <div className="mt-1 text-sm text-ink/70">{error}</div>
            </div>
            {latest && <Button variant="secondary" onClick={() => void retryLast()}>Retry</Button>}
          </CardContent>
        </Card>
      )}

      <div className="space-y-6">
        {[...history].reverse().map((item, index) => (
          <section key={`${item.query}-${index}`} className="space-y-3">
            <div className="border-l-4 border-stamp pl-4">
              <div className="text-xs font-mono uppercase tracking-wider text-ink/40">You asked</div>
              <div className="mt-1 font-display font-bold text-ink">{item.query}</div>
            </div>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <CardTitle>PanelFlow answer</CardTitle>
                  <span className="text-[10px] font-mono uppercase tracking-widest text-ink/40">{item.response.intent}</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="whitespace-pre-wrap text-sm leading-7 text-ink">{item.response.answer}</div>

                {item.response.pendingAction?.type === 'cancel_meeting' && (
                  <div className="flex flex-col gap-3 border-2 border-oxblood bg-oxblood/5 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="font-display font-bold text-oxblood">Confirmation required</div>
                      <div className="mt-1 text-sm text-ink/70">{item.response.pendingAction.confirmationText}</div>
                    </div>
                    <Button variant="danger" onClick={() => setPendingCancel(item.response.pendingAction!.bookingId)}>
                      Confirm cancellation
                    </Button>
                  </div>
                )}

                {item.response.citations.length > 0 ? (
                  <div>
                    <div className="mb-3 text-xs font-mono uppercase tracking-wider text-ink/40">Sources</div>
                    <div className="grid gap-3 md:grid-cols-2">
                      {item.response.citations.map((citation) => (
                        <div key={`${citation.sourceType}:${citation.sourceId}`} className="border border-clay/30 p-3">
                          <div className="text-[10px] font-mono uppercase tracking-widest text-stamp">{sourceLabel(citation)}</div>
                          <div className="mt-1 font-display font-bold text-ink">{citation.title}</div>
                          {citation.date && <div className="mt-1 text-xs font-mono text-ink/50">{formatDate(citation.date)}</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="border border-clay/30 bg-clay/5 p-3 text-xs text-ink/60">
                    No source records were returned with this answer.
                  </div>
                )}
              </CardContent>
            </Card>
          </section>
        ))}
      </div>

      {history.length > 0 && !loading && (
        <div className="text-center text-xs font-mono text-ink/30">PanelFlow does not retain this chat history in the database.</div>
      )}

      <ConfirmDialog
        isOpen={pendingCancel !== null}
        title="Cancel meeting?"
        message="This confirmation will call PanelFlow's existing booking cancellation service."
        confirmText="Cancel meeting"
        cancelText="Keep meeting"
        variant="danger"
        onConfirm={() => void confirmCancel()}
        onCancel={() => setPendingCancel(null)}
      />

      <AlertDialog
        isOpen={notice.isOpen}
        title={notice.title}
        message={notice.message}
        onClose={() => setNotice((value) => ({ ...value, isOpen: false }))}
      />
    </div>
  );
}
