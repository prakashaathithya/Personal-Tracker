import { Injectable, inject, signal } from '@angular/core';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  /** Lookups the assistant ran while writing this reply. */
  tools?: string[];
  error?: string;
}

/** One line of the server's newline-delimited JSON stream. */
type ChatEvent =
  | { type: 'text'; text: string }
  | { type: 'tool'; name: string }
  | { type: 'done' }
  | { type: 'error'; message: string };

/** Turns sent with each question. Older ones are dropped to bound cost. */
const HISTORY_TURNS = 20;

/**
 * Holds the assistant conversation. Provided in root so the chat survives
 * navigating to another page and back; it is cleared on reload.
 *
 * Uses fetch rather than HttpClient because the reply streams in pieces and
 * HttpClient only hands over a body once it is complete.
 */
@Injectable({ providedIn: 'root' })
export class AssistantService {
  private readonly auth = inject(AuthService);
  private controller: AbortController | null = null;

  readonly messages = signal<ChatMessage[]>([]);
  readonly busy = signal(false);

  async ask(question: string): Promise<void> {
    const text = question.trim();
    if (!text || this.busy()) return;

    const history = [
      ...this.messages().filter((m) => m.content && !m.error),
      { role: 'user' as const, content: text },
    ].slice(-HISTORY_TURNS);
    // The window must open on a user turn.
    while (history.length && history[0].role !== 'user') history.shift();

    this.messages.update((m) => [
      ...m,
      { role: 'user', content: text },
      { role: 'assistant', content: '', tools: [] },
    ]);
    this.busy.set(true);
    this.controller = new AbortController();

    try {
      const res = await fetch(`${environment.apiUrl}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.auth.accessToken ?? ''}`,
        },
        body: JSON.stringify({
          messages: history.map(({ role, content }) => ({ role, content })),
        }),
        signal: this.controller.signal,
      });

      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => null);
        throw new Error(
          res.status === 429
            ? 'Too many questions in a minute. Wait a moment and try again.'
            : (body?.message ?? `Request failed (${res.status})`),
        );
      }

      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;
        let nl: number;
        while ((nl = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (line) this.apply(JSON.parse(line) as ChatEvent);
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        this.patchLast({ error: (err as Error).message || 'Something went wrong.' });
      }
    } finally {
      this.busy.set(false);
      this.controller = null;
    }
  }

  stop(): void {
    this.controller?.abort();
  }

  clear(): void {
    this.stop();
    this.messages.set([]);
  }

  private apply(e: ChatEvent): void {
    const last = this.messages().at(-1)!;
    if (e.type === 'text') this.patchLast({ content: last.content + e.text });
    else if (e.type === 'tool') this.patchLast({ tools: [...(last.tools ?? []), e.name] });
    else if (e.type === 'error') this.patchLast({ error: e.message });
  }

  private patchLast(patch: Partial<ChatMessage>): void {
    this.messages.update((m) => [...m.slice(0, -1), { ...m.at(-1)!, ...patch }]);
  }
}
