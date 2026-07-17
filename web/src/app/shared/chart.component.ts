import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  effect,
  input,
  viewChild,
} from '@angular/core';
import { Chart, ChartConfiguration, registerables } from 'chart.js';

Chart.register(...registerables);

@Component({
  selector: 'app-chart',
  template: '<canvas #canvas></canvas>',
  // color/border-color mirror the theme tokens so the chart can read them
  // back fully resolved (canvas can't parse raw light-dark() expressions).
  styles: [
    ':host { display: block; position: relative; height: 280px; color: var(--ink-soft); border-color: var(--hairline); }',
  ],
})
export class ChartComponent implements AfterViewInit, OnDestroy {
  readonly config = input.required<ChartConfiguration>();
  private readonly canvas =
    viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private chart?: Chart;
  private ready = false;

  constructor() {
    effect(() => {
      const cfg = this.config();
      if (this.ready) this.render(cfg);
    });
  }

  ngAfterViewInit() {
    this.ready = true;
    this.render(this.config());
  }

  private render(config: ChartConfiguration) {
    this.chart?.destroy();
    const host = this.canvas().nativeElement;

    // Pull live theme colors so charts stay readable in light & dark.
    const cs = getComputedStyle(host.parentElement ?? host);
    const text = cs.color;
    const grid = cs.borderColor;
    if (text) Chart.defaults.color = text;
    if (grid) Chart.defaults.borderColor = grid;
    Chart.defaults.font.family = "'Inter', sans-serif";

    this.chart = new Chart(host, config);
  }

  ngOnDestroy() {
    this.chart?.destroy();
  }
}
