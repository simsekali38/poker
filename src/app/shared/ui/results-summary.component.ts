import { Component, input } from '@angular/core';
import { Vote } from '@app/core/models';

@Component({
  selector: 'app-results-summary',
  standalone: true,
  templateUrl: './results-summary.component.html',
  styleUrl: './results-summary.component.scss',
})
export class ResultsSummaryComponent {
  readonly votes = input<Vote[]>([]);
  readonly numericAverage = input<number | null>(null);

  protected trackVote(_i: number, v: Vote): string {
    return v.id;
  }
}
