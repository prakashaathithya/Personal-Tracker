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
    this.chart = new Chart(this.canvas().nativeElement, config);
  }

  ngOnDestroy() {
    this.chart?.destroy();
  }
}
