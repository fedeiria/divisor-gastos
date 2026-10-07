import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { GroupStateService } from '../../core/group-state.service';

@Component({
  selector: 'app-create-group',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './create-group.html',
  styleUrl: './create-group.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreateGroup {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly state = inject(GroupStateService);

  readonly error = signal<string | null>(null);
  readonly submitting = signal(false);

  readonly form = this.fb.group({
    title: ['', [Validators.required, Validators.minLength(2)]],
    participants: this.fb.array([this.fb.control('', Validators.required), this.fb.control('', Validators.required)]),
  });

  get participants(): FormArray {
    return this.form.get('participants') as FormArray;
  }

  addParticipant(): void {
    this.participants.push(this.fb.control('', Validators.required));
  }

  removeParticipant(index: number): void {
    if (this.participants.length > 2) this.participants.removeAt(index);
  }

  async submit(): Promise<void> {
    const rawNames = (this.participants.value as string[]).map((n) => n.trim()).filter(Boolean);
    const unique = new Set(rawNames.map((n) => n.toLowerCase()));
    if (this.form.invalid || rawNames.length < 2 || unique.size !== rawNames.length) {
      this.error.set('Ingresá un título y al menos 2 participantes con nombres únicos.');
      return;
    }
    this.submitting.set(true);
    this.error.set(null);
    try {
      const id = await this.state.createGroup(this.form.value.title!.trim(), rawNames);
      await this.router.navigate(['/group', id]);
    } catch (err: any) {
      this.error.set(err?.message ?? 'No se pudo crear el grupo.');
    } finally {
      this.submitting.set(false);
    }
  }
}
