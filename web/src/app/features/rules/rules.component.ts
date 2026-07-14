import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar } from '@angular/material/snack-bar';
import { forkJoin } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { CategorizationRule, Category, MatchType } from '../../core/models';

@Component({
  selector: 'app-rules',
  imports: [
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatSlideToggleModule,
  ],
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h1>Auto-categorization</h1>
          <p class="page-subtitle">Rules that categorize transactions by their description</p>
        </div>
        <span class="spacer"></span>
        <button class="action-btn" (click)="apply()" [disabled]="applying()">
          <mat-icon>bolt</mat-icon> Apply to uncategorized
        </button>
      </div>

      <mat-card class="add-card">
        <mat-card-content>
          <div class="card-title">Add a rule</div>
          <div class="add-row">
            <select class="plain-input match" [(ngModel)]="newMatch">
              <option value="contains">Description contains</option>
              <option value="equals">Description equals</option>
              <option value="regex">Matches regex</option>
            </select>
            <input class="plain-input pattern" placeholder="e.g. uber" [(ngModel)]="newPattern" />
            <mat-icon class="arrow">arrow_forward</mat-icon>
            <select class="plain-input cat" [(ngModel)]="newCategory">
              <option [ngValue]="null" disabled>Category…</option>
              @for (c of categories(); track c.id) {
                <option [ngValue]="c.id">{{ c.name }}</option>
              }
            </select>
            <button class="action-btn" (click)="add()" [disabled]="!newPattern || !newCategory">
              <mat-icon>add</mat-icon> Add
            </button>
          </div>
        </mat-card-content>
      </mat-card>

      <mat-card>
        <mat-card-content>
          <div class="card-title">Rules <span class="count">{{ rules().length }}</span></div>
          @if (!rules().length) {
            <p class="empty">No rules yet. Add one above — new imports and the button will use them.</p>
          }
          @for (r of rules(); track r.id) {
            <div class="rule-row" [class.off]="!r.is_active">
              <span class="match-chip">{{ label(r.match) }}</span>
              <span class="pattern">{{ r.pattern }}</span>
              <mat-icon class="arrow">arrow_forward</mat-icon>
              <span class="cat-chip">{{ r.category?.name ?? '—' }}</span>
              <span class="spacer"></span>
              <mat-slide-toggle [checked]="r.is_active" (change)="toggle(r, $event.checked)" />
              <button matIconButton (click)="remove(r)"><mat-icon>delete</mat-icon></button>
            </div>
          }
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [
    `
      .page-subtitle { margin: 4px 0 0; font-size: 0.9rem; color: var(--mat-sys-on-surface-variant); }
      .card-title { font-weight: 700; font-size: 1.05rem; margin-bottom: 14px; }
      .card-title .count {
        font-size: 0.8rem; color: var(--mat-sys-on-surface-variant); font-weight: 600; margin-left: 6px;
      }
      .add-card { margin-bottom: 16px; }
      .add-row { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
      .plain-input {
        height: 44px; padding: 0 12px; border-radius: 10px;
        border: 1px solid light-dark(#dbe7e1, #2c3a33);
        background: light-dark(#ffffff, #202a25); color: inherit;
        font-family: inherit; font-size: 0.92rem; box-sizing: border-box; outline: none;
      }
      .plain-input:focus { border-color: var(--mat-sys-primary); }
      .plain-input.match { flex: 0 0 190px; }
      .plain-input.pattern { flex: 1 1 160px; }
      .plain-input.cat { flex: 0 0 180px; }
      .arrow { color: var(--mat-sys-on-surface-variant); font-size: 20px; }
      .action-btn {
        background: linear-gradient(135deg, #34d399 0%, #10b981 55%, #0d9488 100%);
        color: #fff; border: none; border-radius: 10px; padding: 0 18px; height: 44px;
        font-weight: 600; font-size: 0.9rem; display: inline-flex; align-items: center;
        justify-content: center; gap: 6px; cursor: pointer; white-space: nowrap;
      }
      .action-btn mat-icon { font-size: 18px; width: 18px; height: 18px; }
      .action-btn:disabled { opacity: 0.5; cursor: not-allowed; }

      .rule-row {
        display: flex; align-items: center; gap: 10px; padding: 10px 4px;
        border-bottom: 1px solid light-dark(#eef4f1, #202a25);
      }
      .rule-row.off { opacity: 0.5; }
      .match-chip {
        font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em;
        color: var(--mat-sys-on-surface-variant);
        background: light-dark(#f1f5f9, #1e2925); padding: 4px 10px; border-radius: 8px;
      }
      .pattern { font-weight: 600; }
      .cat-chip {
        padding: 4px 12px; border-radius: 999px; font-size: 0.8rem; font-weight: 600;
        background: var(--mat-sys-primary-container); color: var(--mat-sys-on-primary-container);
      }
      .empty { color: var(--mat-sys-on-surface-variant); font-size: 0.9rem; }
    `,
  ],
})
export class RulesComponent {
  private readonly api = inject(ApiService);
  private readonly snack = inject(MatSnackBar);

  readonly rules = signal<CategorizationRule[]>([]);
  readonly categories = signal<Category[]>([]);
  readonly applying = signal(false);

  newMatch: MatchType = 'contains';
  newPattern = '';
  newCategory: string | null = null;

  constructor() {
    forkJoin({
      rules: this.api.listRules(),
      categories: this.api.listCategories(),
    }).subscribe((r) => {
      this.rules.set(r.rules);
      this.categories.set(r.categories);
    });
  }

  private reload() {
    this.api.listRules().subscribe((r) => this.rules.set(r));
  }

  label(m: MatchType): string {
    return m === 'contains' ? 'contains' : m === 'equals' ? 'equals' : 'regex';
  }

  add() {
    if (!this.newPattern || !this.newCategory) return;
    this.api
      .createRule({
        match: this.newMatch,
        pattern: this.newPattern,
        category_id: this.newCategory,
      })
      .subscribe({
        next: () => {
          this.newPattern = '';
          this.newCategory = null;
          this.reload();
        },
        error: () => this.snack.open('Could not add rule', 'OK', { duration: 3000 }),
      });
  }

  toggle(r: CategorizationRule, is_active: boolean) {
    this.api.updateRule(r.id, { is_active }).subscribe(() => this.reload());
  }

  remove(r: CategorizationRule) {
    this.api.deleteRule(r.id).subscribe(() => this.reload());
  }

  apply() {
    this.applying.set(true);
    this.api.applyRules().subscribe({
      next: (res) => {
        this.applying.set(false);
        this.snack.open(
          res.updated ? `Categorized ${res.updated} transactions` : 'Nothing to categorize',
          'OK',
          { duration: 3000 },
        );
      },
      error: () => {
        this.applying.set(false);
        this.snack.open('Apply failed', 'OK', { duration: 3000 });
      },
    });
  }
}
