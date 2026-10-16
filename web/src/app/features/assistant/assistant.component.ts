import {
  Component,
  ElementRef,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { marked } from 'marked';
import { AssistantService } from '../../core/assistant.service';

/** Human wording for the lookups shown under a reply. */
const TOOL_LABELS: Record<string, string> = {
  get_financial_summary: 'Totals',
  get_spending_breakdown: 'Spending breakdown',
  get_monthly_trend: 'Monthly trend',
  search_transactions: 'Transactions',
  get_account_balances: 'Account balances',
  get_credit_card_bills: 'Card bills',
  get_loans: 'Loans',
  get_savings_goals: 'Goals',
  get_budget_items: 'Budget',
};

const SUGGESTIONS = [
  'How much did I spend this month, and on what?',
  'Compare my spending over the last 3 months',
  'Which credit card bills are due soon?',
  'What is my net worth right now?',
  'How far along are my loans?',
  'What were my 10 biggest expenses this year?',
];

@Component({
  selector: 'app-assistant',
  imports: [FormsModule, MatButtonModule, MatIconModule, MatTooltipModule],
  template: `
    <div class="page chat-page">
      <div class="page-header">
        <div>
          <h1>Assistant</h1>
          <p class="page-subtitle">Ask about your spending, bills, loans and goals</p>
        </div>
        @if (chat.messages().length) {
          <button matButton (click)="chat.clear()">
            <mat-icon>restart_alt</mat-icon> New chat
          </button>
        }
      </div>

      <div class="thread" #thread>
        @if (!chat.messages().length) {
          <div class="welcome">
            <mat-icon class="welcome-icon">auto_awesome</mat-icon>
            <p>I read your MoneyMap data to answer. I can't change anything.</p>
            <div class="chips">
              @for (s of suggestions; track s) {
                <button class="chip" (click)="send(s)">{{ s }}</button>
              }
            </div>
          </div>
        }

        @for (m of chat.messages(); track $index; let last = $last) {
          @if (m.role === 'user') {
            <div class="bubble user">{{ m.content }}</div>
          } @else {
            <div class="bubble bot">
              @if (m.content) {
                <div class="md" [innerHTML]="render(m.content)"></div>
              } @else if (last && chat.busy()) {
                <div class="thinking">
                  <span></span><span></span><span></span>
                  @if (m.tools?.length) {
                    <em>Looking up {{ label(m.tools!.at(-1)!) }}…</em>
                  }
                </div>
              }
              @if (m.error) {
                <div class="err"><mat-icon>error_outline</mat-icon>{{ m.error }}</div>
              }
              @if (m.tools?.length && (!last || !chat.busy())) {
                <div class="sources">
                  <mat-icon>storage</mat-icon>
                  {{ sources(m.tools!) }}
                </div>
              }
            </div>
          }
        }
      </div>

      <form class="composer" (ngSubmit)="send(draft())">
        <textarea
          rows="1"
          placeholder="Ask about your money…"
          maxlength="2000"
          [ngModel]="draft()"
          (ngModelChange)="draft.set($event)"
          name="draft"
          (keydown.enter)="onEnter($any($event))"
        ></textarea>
        @if (chat.busy()) {
          <button type="button" class="send" matTooltip="Stop" (click)="chat.stop()">
            <mat-icon>stop</mat-icon>
          </button>
        } @else {
          <button type="submit" class="send" matTooltip="Send" [disabled]="!draft().trim()">
            <mat-icon>arrow_upward</mat-icon>
          </button>
        }
      </form>
      <p class="fineprint">Answers come from an AI and can be wrong. Check important figures on the relevant page.</p>
    </div>
  `,
  styles: [
    `
      .chat-page {
        display: flex; flex-direction: column;
        height: calc(100dvh - var(--topbar-h) - var(--bottom-nav-h) - var(--safe-bottom) - 48px);
        max-width: 860px;
      }
      .page-subtitle { margin: 4px 0 0; font-size: 0.9rem; color: var(--ink-soft); }
      .thread {
        flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 12px;
        padding: 4px 2px 12px;
      }
      .welcome { margin: auto 0; text-align: center; color: var(--ink-soft); }
      .welcome-icon { font-size: 40px; width: 40px; height: 40px; color: var(--accent); }
      .chips { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; margin-top: 14px; }
      .chip {
        border: 1px solid var(--glass-border); background: var(--glass-bg);
        color: var(--ink); border-radius: 999px; padding: 8px 14px;
        font: inherit; font-size: 0.88rem; cursor: pointer;
      }
      .chip:hover { background: var(--hover-bg); }
      .bubble {
        max-width: 88%; padding: 10px 14px; border-radius: 16px;
        line-height: 1.5; overflow-wrap: anywhere;
      }
      .bubble.user {
        align-self: flex-end; background: var(--accent-grad); color: #fff;
        border-bottom-right-radius: 4px; white-space: pre-wrap;
      }
      .bubble.bot {
        align-self: flex-start; background: var(--glass-bg-strong);
        border: 1px solid var(--glass-border); border-bottom-left-radius: 4px;
        color: var(--ink);
      }
      .md ::ng-deep :first-child { margin-top: 0; }
      .md ::ng-deep :last-child { margin-bottom: 0; }
      .md ::ng-deep p, .md ::ng-deep ul, .md ::ng-deep ol { margin: 0 0 8px; }
      .md ::ng-deep ul, .md ::ng-deep ol { padding-left: 20px; }
      .md ::ng-deep table { border-collapse: collapse; margin: 6px 0 10px; font-size: 0.88rem; display: block; overflow-x: auto; }
      .md ::ng-deep th, .md ::ng-deep td { border-bottom: 1px solid var(--hairline); padding: 5px 10px; text-align: left; white-space: nowrap; }
      .md ::ng-deep th { color: var(--ink-soft); font-weight: 600; }
      .md ::ng-deep code { font-size: 0.85em; }
      .thinking { display: flex; align-items: center; gap: 4px; color: var(--ink-soft); min-height: 22px; }
      .thinking span {
        width: 6px; height: 6px; border-radius: 50%; background: var(--accent);
        animation: blink 1.2s infinite ease-in-out;
      }
      .thinking span:nth-child(2) { animation-delay: 0.2s; }
      .thinking span:nth-child(3) { animation-delay: 0.4s; }
      .thinking em { margin-left: 8px; font-size: 0.85rem; }
      @keyframes blink { 0%, 80%, 100% { opacity: 0.25; } 40% { opacity: 1; } }
      .err { display: flex; align-items: center; gap: 6px; color: var(--danger); font-size: 0.88rem; margin-top: 4px; }
      .err mat-icon, .sources mat-icon { font-size: 16px; width: 16px; height: 16px; }
      .sources {
        display: flex; align-items: center; gap: 6px; margin-top: 8px;
        font-size: 0.78rem; color: var(--ink-faint);
      }
      .composer {
        display: flex; gap: 8px; align-items: flex-end;
        background: var(--glass-bg-strong); border: 1px solid var(--glass-border);
        border-radius: 16px; padding: 8px;
      }
      .composer textarea {
        flex: 1; resize: none; border: none; outline: none; background: transparent;
        color: var(--ink); font: inherit; font-size: 0.95rem; padding: 8px 6px;
        max-height: 140px; field-sizing: content;
      }
      .send {
        width: 40px; height: 40px; border-radius: 12px; border: none; cursor: pointer;
        background: var(--accent-grad); color: #fff;
        display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0;
      }
      .send:disabled { opacity: 0.45; cursor: not-allowed; }
      .fineprint { margin: 6px 4px 0; font-size: 0.72rem; color: var(--ink-faint); text-align: center; }
      @media (max-width: 700px) {
        .bubble { max-width: 94%; }
        .composer textarea { font-size: 16px; }
      }
    `,
  ],
})
export class AssistantComponent {
  protected readonly chat = inject(AssistantService);
  protected readonly draft = signal('');
  protected readonly suggestions = SUGGESTIONS;
  private readonly thread = viewChild.required<ElementRef<HTMLElement>>('thread');
  private readonly cache = new Map<string, string>();

  constructor() {
    // Keep the newest text in view while a reply streams in.
    effect(() => {
      this.chat.messages();
      const el = this.thread().nativeElement;
      queueMicrotask(() => (el.scrollTop = el.scrollHeight));
    });
  }

  send(text: string): void {
    if (!text.trim() || this.chat.busy()) return;
    this.draft.set('');
    void this.chat.ask(text);
  }

  onEnter(e: KeyboardEvent): void {
    // Enter sends; Shift+Enter keeps a newline. Ignore Enter while an IME is composing.
    if (e.shiftKey || e.isComposing) return;
    e.preventDefault();
    this.send(this.draft());
  }

  /**
   * Markdown to HTML. Angular sanitizes [innerHTML], which strips scripts and
   * event handlers, so text that came from transaction descriptions can't run.
   */
  render(md: string): string {
    let html = this.cache.get(md);
    if (html === undefined) {
      html = marked.parse(md, { async: false, gfm: true, breaks: true });
      if (this.cache.size > 200) this.cache.clear();
      this.cache.set(md, html);
    }
    return html;
  }

  label(tool: string): string {
    return (TOOL_LABELS[tool] ?? tool).toLowerCase();
  }

  sources(tools: string[]): string {
    return [...new Set(tools.map((t) => TOOL_LABELS[t] ?? t))].join(' · ');
  }
}
