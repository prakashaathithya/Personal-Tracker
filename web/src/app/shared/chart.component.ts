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
  styles: [':host { display: block; position: relative; height: 280px; }'],
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
    const cs = getComputedStyle(host);
    const text = cs.getPropertyValue('--mat-sys-on-surface').trim();
    const grid = cs.getPropertyValue('--mat-sys-outline-variant').trim();
    if (text) Chart.defaults.color = text;
    if (grid) Chart.defaults.borderColor = grid;
    Chart.defaults.font.family = "'Sora', Roboto, sans-serif";

    this.chart = new Chart(host, config);
  }

  ngOnDestroy() {
    this.chart?.destroy();
  }
}
