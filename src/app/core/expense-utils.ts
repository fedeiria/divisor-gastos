import { Expense, ExpenseSplit, Participant, ParticipantBalance, Transaction } from '../models/domain.models';

export function toCents(amount: number): number {
  return Math.round(amount * 100);
}

export function fromCents(cents: number): number {
  return cents / 100;
}

export function splitEquallyCents(totalCents: number, count: number): number[] {
  const base = Math.floor(totalCents / count);
  const remainder = totalCents - base * count;
  return Array.from({ length: count }, (_, i) => base + (i < remainder ? 1 : 0));
}

export function splitEqually(amount: number, participantIds: string[]): Map<string, number> {
  const result = new Map<string, number>();
  const parts = splitEquallyCents(toCents(amount), participantIds.length);
  participantIds.forEach((id, i) => result.set(id, fromCents(parts[i])));
  return result;
}

export function calculateBalances(
  participants: Participant[],
  expenses: Expense[],
  splits: ExpenseSplit[],
): ParticipantBalance[] {
  return participants.map((participant) => {
    const totalPaid = expenses
      .filter((e) => e.paid_by === participant.id)
      .reduce((sum, e) => sum + toCents(e.amount), 0);
    const totalConsumed = splits
      .filter((s) => s.participant_id === participant.id)
      .reduce((sum, s) => sum + toCents(s.assigned_amount), 0);
    const netBalance = totalPaid - totalConsumed;
    return {
      participant,
      totalPaid: fromCents(totalPaid),
      totalConsumed: fromCents(totalConsumed),
      netBalance: fromCents(netBalance),
    };
  });
}

export function settleDebts(balances: ParticipantBalance[]): Transaction[] {
  const debtors = balances
    .filter((b) => b.netBalance < 0)
    .map((b) => ({ participant: b.participant, cents: -toCents(b.netBalance) }))
    .sort((a, b) => b.cents - a.cents);
  const creditors = balances
    .filter((b) => b.netBalance > 0)
    .map((b) => ({ participant: b.participant, cents: toCents(b.netBalance) }))
    .sort((a, b) => b.cents - a.cents);

  const transactions: Transaction[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const amount = Math.min(debtors[i].cents, creditors[j].cents);
    transactions.push({ from: debtors[i].participant, to: creditors[j].participant, amount: fromCents(amount) });
    debtors[i].cents -= amount;
    creditors[j].cents -= amount;
    if (debtors[i].cents === 0) i++;
    if (creditors[j].cents === 0) j++;
  }
  return transactions;
}

export function validateSplitsSum(totalAmount: number, splits: { assigned_amount: number }[]): boolean {
  const sum = splits.reduce((acc, s) => acc + toCents(s.assigned_amount), 0);
  return Math.abs(sum - toCents(totalAmount)) <= 1;
}

export function formatCurrency(amount: number, currency = 'ARS'): string {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency }).format(amount);
}
