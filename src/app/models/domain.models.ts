export interface Group {
  id: string;
  title: string;
  currency: string;
  is_closed: boolean;
  created_at: string;
}

export interface Participant {
  id: string;
  group_id: string;
  name: string;
  created_at: string;
}

export interface Expense {
  id: string;
  group_id: string;
  description: string;
  amount: number;
  paid_by: string;
  created_at: string;
}

export interface ExpenseSplit {
  id: string;
  expense_id: string;
  participant_id: string;
  assigned_amount: number;
}

export interface ParticipantBalance {
  participant: Participant;
  totalPaid: number;
  totalConsumed: number;
  netBalance: number;
}

export interface Transaction {
  from: Participant;
  to: Participant;
  amount: number;
}
