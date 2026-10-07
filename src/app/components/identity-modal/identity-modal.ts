import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Participant } from '../../models/domain.models';

@Component({
  selector: 'app-identity-modal',
  standalone: true,
  templateUrl: './identity-modal.html',
  styleUrl: './identity-modal.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IdentityModal {
  readonly participants = input<Participant[]>([]);
  readonly chosen = output<string>();
}
