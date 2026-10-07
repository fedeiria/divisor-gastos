import { describe, expect, it } from 'vitest';
import { calculateBalances, settleDebts, splitEqually, validateSplitsSum, toCents } from './expense-utils';
import { Expense, ExpenseSplit, Participant } from '../models/domain.models';

const p = (id: string, name: string): Participant => ({ id, group_id: 'g', name, created_at: '' });

describe('splitEqually', () => {
  it('divide $100 entre 3 en 33.34 / 33.33 / 33.33 (AC-05)', () => {
    const map = splitEqually(100, ['a', 'b', 'c']);
    const values = ['a', 'b', 'c'].map((id) => map.get(id));
    expect(values).toEqual([33.34, 33.33, 33.33]);
    expect(values.reduce<number>((sum, v) => sum + toCents(v!), 0)).toBe(10000);
  });
});

describe('validateSplitsSum', () => {
  it('acepta sumas exactas', () => {
    expect(validateSplitsSum(100, [{ assigned_amount: 60 }, { assigned_amount: 40 }])).toBe(true);
  });
  it('rechaza sumas incorrectas (AC-06)', () => {
    expect(validateSplitsSum(100, [{ assigned_amount: 60 }, { assigned_amount: 30 }])).toBe(false);
  });
});

describe('calculateBalances y settleDebts', () => {
  it('deja saldos en 0 tras liquidar (AC-03)', () => {
    const participants = [p('1', 'Ana'), p('2', 'Luis'), p('3', 'Mia')];
    const expenses: Expense[] = [
      { id: 'e1', group_id: 'g', description: 'Cena', amount: 100, paid_by: '1', created_at: '' },
    ];
    const splits: ExpenseSplit[] = [
      { id: 's1', expense_id: 'e1', participant_id: '1', assigned_amount: 33.34 },
      { id: 's2', expense_id: 'e1', participant_id: '2', assigned_amount: 33.33 },
      { id: 's3', expense_id: 'e1', participant_id: '3', assigned_amount: 33.33 },
    ];
    const balances = calculateBalances(participants, expenses, splits);
    const transactions = settleDebts(balances);
    expect(transactions.length).toBeGreaterThan(0);
    const out = new Map<string, number>();
    const inn = new Map<string, number>();
    for (const t of transactions) {
      out.set(t.from.id, (out.get(t.from.id) ?? 0) + toCents(t.amount));
      inn.set(t.to.id, (inn.get(t.to.id) ?? 0) + toCents(t.amount));
    }
    for (const b of balances) {
      const paid = out.get(b.participant.id) ?? 0;
      const received = inn.get(b.participant.id) ?? 0;
      expect(paid - received).toBe(-toCents(b.netBalance));
    }
  });
});
