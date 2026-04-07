import { DecimalPipe } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import { ResultRowVm } from '../../models/planning-room.view-model';
import { VoteLabelPipe } from '@app/shared/pipes/vote-label.pipe';
import { outlierMemberIds } from '@app/shared/utils/results-outliers.util';

@Component({
  selector: 'app-room-results-panel',
  standalone: true,
  imports: [VoteLabelPipe, DecimalPipe],
  templateUrl: './room-results-panel.component.html',
})
export class RoomResultsPanelComponent {
  readonly rows = input<ResultRowVm[]>([]);
  readonly numericAverage = input<number | null>(null);
  readonly votesRevealed = input(false);
  readonly hasActiveStory = input(false);

  protected readonly outlierIds = computed(() => {
    if (!this.votesRevealed() || this.rows().length === 0) {
      return new Set<string>();
    }
    return outlierMemberIds(this.rows());
  });

  protected trackRow(_i: number, r: ResultRowVm): string {
    return r.memberId;
  }

  protected isOutlier(memberId: string): boolean {
    return this.outlierIds().has(memberId);
  }

  protected rowDelayMs(index: number): number {
    return 80 + index * 55;
  }
}
