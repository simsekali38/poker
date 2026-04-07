import { Pipe, PipeTransform } from '@angular/core';
@Pipe({
  name: 'voteLabel',
  standalone: true,
})
export class VoteLabelPipe implements PipeTransform {
  transform(value: string): string {
    switch (value) {
      case 'coffee':
        return 'Coffee';
      case 'abstain':
        return 'Abstain';
      case '?':
        return '?';
      default:
        return String(value);
    }
  }
}
