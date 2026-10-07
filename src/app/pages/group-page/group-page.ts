import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { QRCodeComponent } from 'angularx-qrcode';
import { GroupStateService } from '../../core/group-state.service';
import { Expense, ExpenseSplit } from '../../models/domain.models';
import { formatCurrency } from '../../core/expense-utils';
import { IdentityModal } from '../../components/identity-modal/identity-modal';
import { ExpenseModal, ExpenseInput } from '../../components/expense-modal/expense-modal';

@Component({
  selector: 'app-group-page',
  standalone: true,
  imports: [CommonModule, QRCodeComponent, IdentityModal, ExpenseModal],
  templateUrl: './group-page.html',
  styleUrl: './group-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GroupPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  readonly state = inject(GroupStateService);

  readonly showExpenseModal = signal(false);
  readonly editingExpense = signal<Expense | null>(null);
  readonly editingSplits = signal<ExpenseSplit[]>([]);
  readonly copied = signal(false);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) this.state.loadGroup(id);
  }

  format(amount: number): string {
    return formatCurrency(amount, this.state.group()?.currency);
  }

  payerName(id: string): string {
    return this.state.participants().find((p) => p.id === id)?.name ?? '—';
  }

  startAdd(): void {
    this.editingExpense.set(null);
    this.editingSplits.set([]);
    this.showExpenseModal.set(true);
  }

  startEdit(expense: Expense): void {
    this.editingExpense.set(expense);
    this.editingSplits.set(this.state.splitsByExpense().get(expense.id) ?? []);
    this.showExpenseModal.set(true);
  }

  async onSaved(input: ExpenseInput): Promise<void> {
    const editing = this.editingExpense();
    try {
      if (editing) await this.state.updateExpense(editing.id, input);
      else await this.state.addExpense(input);
      this.showExpenseModal.set(false);
    } catch (err: any) {
      alert(err?.message ?? 'No se pudo guardar');
    }
  }

  async remove(expense: Expense): Promise<void> {
    if (!confirm(`¿Eliminar "${expense.description}"?`)) return;
    try {
      await this.state.deleteExpense(expense.id);
    } catch (err: any) {
      alert(err?.message ?? 'No se pudo eliminar');
    }
  }

  async closeAccount(): Promise<void> {
    if (!confirm('¿Cerrar la cuenta? No se podrán agregar más gastos.')) return;
    try {
      await this.state.closeGroup();
    } catch (err: any) {
      alert(err?.message ?? 'No se pudo cerrar');
    }
  }

  copySummary(): void {
    const lines: string[] = [];
    const g = this.state.group();
    lines.push(`Resumen: ${g?.title ?? ''}`);
    lines.push(`Total gastado: ${this.format(this.state.totalSpent())}`);
    lines.push(`Promedio por persona: ${this.format(this.state.averagePerPerson())}`);
    lines.push('');
    lines.push('Balances:');
    for (const b of this.state.balances()) {
      lines.push(`- ${b.participant.name}: ${this.format(b.netBalance)}`);
    }
    lines.push('');
    lines.push('Transferencias:');
    if (this.state.transactions().length === 0) {
      lines.push('- Todas las cuentas están saldadas.');
    } else {
      for (const t of this.state.transactions()) {
        lines.push(`- ${t.from.name} le debe a ${t.to.name}: ${this.format(t.amount)}`);
      }
    }
    const text = lines.join('\n');
    navigator.clipboard.writeText(text).then(() => {
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    });
  }

  get groupUrl(): string {
    return typeof window !== 'undefined' ? window.location.href : '';
  }
}
