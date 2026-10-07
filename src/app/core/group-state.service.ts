import { Injectable, computed, signal, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { Expense, ExpenseSplit, Group, Participant, ParticipantBalance, Transaction } from '../models/domain.models';
import { calculateBalances, settleDebts } from './expense-utils';

@Injectable({ providedIn: 'root' })
export class GroupStateService {
  private readonly supabase = inject(SupabaseService);

  readonly group = signal<Group | null>(null);
  readonly participants = signal<Participant[]>([]);
  readonly expenses = signal<Expense[]>([]);
  readonly splits = signal<ExpenseSplit[]>([]);
  readonly currentParticipantId = signal<string | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly isClosed = computed(() => this.group()?.is_closed ?? false);
  readonly totalSpent = computed(() =>
    this.expenses().reduce((sum, e) => sum + e.amount, 0),
  );
  readonly averagePerPerson = computed(() => {
    const count = this.participants().length;
    return count > 0 ? this.totalSpent() / count : 0;
  });
  readonly balances = computed<ParticipantBalance[]>(() =>
    calculateBalances(this.participants(), this.expenses(), this.splits()),
  );
  readonly transactions = computed<Transaction[]>(() => settleDebts(this.balances()));
  readonly splitsByExpense = computed(() => {
    const map = new Map<string, ExpenseSplit[]>();
    for (const s of this.splits()) {
      const arr = map.get(s.expense_id) ?? [];
      arr.push(s);
      map.set(s.expense_id, arr);
    }
    return map;
  });

  private groupId: string | null = null;

  async loadGroup(id: string): Promise<void> {
    this.groupId = id;
    this.loading.set(true);
    this.error.set(null);
    try {
      const [g, p, e, s] = await Promise.all([
        this.supabase.client.from('groups').select('*').eq('id', id).single(),
        this.supabase.client.from('participants').select('*').eq('group_id', id).order('created_at'),
        this.supabase.client.from('expenses').select('*').eq('group_id', id).order('created_at'),
        this.supabase.client.from('expense_splits').select('*'),
      ]);
      if (g.error) throw g.error;
      if (p.error) throw p.error;
      if (e.error) throw e.error;
      if (s.error) throw s.error;
      this.group.set(g.data);
      this.participants.set(p.data ?? []);
      this.expenses.set(e.data ?? []);
      const expenseIds = new Set((e.data ?? []).map((x: Expense) => x.id));
      this.splits.set((s.data ?? []).filter((x: ExpenseSplit) => expenseIds.has(x.expense_id)));
      const saved = localStorage.getItem(`dgp_participant_${id}`);
      if (saved && this.participants().some((pt) => pt.id === saved)) {
        this.currentParticipantId.set(saved);
      }
      this.subscribeRealtime(id);
    } catch (err: any) {
      this.error.set(err?.message ?? 'Error al cargar el grupo');
    } finally {
      this.loading.set(false);
    }
  }

  setCurrentParticipant(id: string): void {
    this.currentParticipantId.set(id);
    if (this.groupId) localStorage.setItem(`dgp_participant_${this.groupId}`, id);
  }

  async createGroup(title: string, names: string[]): Promise<string> {
    const { data: group, error: gErr } = await this.supabase.client
      .from('groups')
      .insert({ title })
      .select()
      .single();
    if (gErr) throw gErr;
    const rows = names.map((name) => ({ group_id: group.id, name: name.trim() }));
    const { error: pErr } = await this.supabase.client.from('participants').insert(rows);
    if (pErr) throw pErr;
    return group.id;
  }

  async addExpense(input: {
    description: string;
    amount: number;
    paid_by: string;
    splits: { participant_id: string; assigned_amount: number }[];
  }): Promise<void> {
    const { data: expense, error } = await this.supabase.client
      .from('expenses')
      .insert({ group_id: this.groupId, description: input.description, amount: input.amount, paid_by: input.paid_by })
      .select()
      .single();
    if (error) throw error;
    const rows = input.splits.map((s) => ({ expense_id: expense.id, participant_id: s.participant_id, assigned_amount: s.assigned_amount }));
    const { error: sErr } = await this.supabase.client.from('expense_splits').insert(rows);
    if (sErr) throw sErr;
    await this.loadGroup(this.groupId!);
  }

  async updateExpense(id: string, input: {
    description: string;
    amount: number;
    paid_by: string;
    splits: { participant_id: string; assigned_amount: number }[];
  }): Promise<void> {
    const { error } = await this.supabase.client
      .from('expenses')
      .update({ description: input.description, amount: input.amount, paid_by: input.paid_by })
      .eq('id', id);
    if (error) throw error;
    await this.supabase.client.from('expense_splits').delete().eq('expense_id', id);
    const rows = input.splits.map((s) => ({ expense_id: id, participant_id: s.participant_id, assigned_amount: s.assigned_amount }));
    const { error: sErr } = await this.supabase.client.from('expense_splits').insert(rows);
    if (sErr) throw sErr;
    await this.loadGroup(this.groupId!);
  }

  async deleteExpense(id: string): Promise<void> {
    const { error } = await this.supabase.client.from('expenses').delete().eq('id', id);
    if (error) throw error;
    await this.loadGroup(this.groupId!);
  }

  async closeGroup(): Promise<void> {
    if (!this.groupId) return;
    const { error } = await this.supabase.client.from('groups').update({ is_closed: true }).eq('id', this.groupId).eq('is_closed', false);
    if (error) throw error;
    await this.loadGroup(this.groupId);
  }

  private subscribeRealtime(id: string): void {
    this.supabase.client.removeAllChannels();
    this.supabase.client
      .channel(`group-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses', filter: `group_id=eq.${id}` }, () => this.loadGroup(id))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expense_splits' }, () => this.loadGroup(id))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'groups', filter: `id=eq.${id}` }, () => this.loadGroup(id))
      .subscribe();
  }
}
