import { DecimalPipe } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import { VoteCard } from '@app/core/models';
import { ResultRowVm } from '../../models/planning-room.view-model';
import { VoteLabelPipe } from '@app/shared/pipes/vote-label.pipe';
import { UiPanelComponent } from '@app/shared/ui/design-system';
import { outlierMemberIdsByMedianDeckDistance } from '@app/shared/utils/results-outliers.util';

@Component({
  selector: 'app-room-results-panel',
  standalone: true,
  imports: [UiPanelComponent, VoteLabelPipe, DecimalPipe],
  templateUrl: './room-results-panel.component.html',
  styleUrl: './room-results-panel.component.scss',
})
export class RoomResultsPanelComponent {
  readonly rows = input<ResultRowVm[]>([]);
  readonly deck = input<readonly VoteCard[]>([]);
  readonly numericAverage = input<number | null>(null);
  readonly votesRevealed = input(false);
  readonly hasActiveStory = input(false);

  protected readonly outlierIds = computed(() => {
    if (!this.votesRevealed() || this.rows().length === 0) {
      return new Set<string>();
    }
    const deck = this.deck();
    if (deck.length === 0) {
      return new Set<string>();
    }
    return outlierMemberIdsByMedianDeckDistance(this.rows(), deck, 2);
  });

  protected readonly hasOutliers = computed(() => this.outlierIds().size > 0);

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
