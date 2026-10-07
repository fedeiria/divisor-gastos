import { ChangeDetectionStrategy, Component, inject, input, OnInit, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Expense, ExpenseSplit, Participant } from '../../models/domain.models';
import { splitEqually, validateSplitsSum, toCents, formatCurrency } from '../../core/expense-utils';

export interface ExpenseInput {
  description: string;
  amount: number;
  paid_by: string;
  splits: { participant_id: string; assigned_amount: number }[];
}

@Component({
  selector: 'app-expense-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './expense-modal.html',
  styleUrl: './expense-modal.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExpenseModal implements OnInit {
  private readonly fb = inject(FormBuilder);

  readonly participants = input<Participant[]>([]);
  readonly expense = input<Expense | null>(null);
  readonly splits = input<ExpenseSplit[]>([]);
  readonly saved = output<ExpenseInput>();
  readonly cancelled = output<void>();

  readonly mode = signal<'equal' | 'fixed'>('equal');
  readonly selected = signal<Set<string>>(new Set());
  readonly fixedAmounts = signal<Record<string, number>>({});
  readonly error = signal<string | null>(null);

  readonly form = this.fb.group({
    description: ['', Validators.required],
    amount: [0, [Validators.required, Validators.min(0.01)]],
    paid_by: ['', Validators.required],
  });

  ngOnInit(): void {
    const e = this.expense();
    const s = this.splits();
    if (e) {
      this.form.patchValue({ description: e.description, amount: e.amount, paid_by: e.paid_by });
      this.selected.set(new Set(s.map((x) => x.participant_id)));
      const rec: Record<string, number> = {};
      for (const x of s) rec[x.participant_id] = x.assigned_amount;
      this.fixedAmounts.set(rec);
    } else {
      this.selected.set(new Set(this.participants().map((p) => p.id)));
    }
  }

  toggle(id: string): void {
    const next = new Set(this.selected());
    if (next.has(id)) next.delete(id);
    else next.add(id);
    this.selected.set(next);
  }

  setFixed(id: string, value: number): void {
    this.fixedAmounts.set({ ...this.fixedAmounts(), [id]: value });
  }

  save(): void {
    const desc = this.form.value.description?.trim();
    const amount = Number(this.form.value.amount);
    const paidBy = this.form.value.paid_by;
    if (!desc || !amount || amount <= 0 || !paidBy) {
      this.error.set('Completá concepto, monto y quién pagó.');
      return;
    }
    if (this.selected().size === 0) {
      this.error.set('Seleccioná al menos un participante para dividir.');
      return;
    }

    let splits: { participant_id: string; assigned_amount: number }[];
    if (this.mode() === 'equal') {
      const map = splitEqually(amount, [...this.selected()]);
      splits = [...map.entries()].map(([participant_id, assigned_amount]) => ({ participant_id, assigned_amount }));
    } else {
      splits = [...this.selected()].map((id) => ({ participant_id: id, assigned_amount: Number(this.fixedAmounts()[id] ?? 0) }));
      if (!validateSplitsSum(amount, splits)) {
        this.error.set(`Los montos fijos deben sumar ${formatCurrency(amount)}.`);
        return;
      }
    }
    this.saved.emit({ description: desc, amount, paid_by: paidBy, splits });
  }
}
