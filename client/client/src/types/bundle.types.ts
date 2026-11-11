export interface Product {
  id: string;
  name: string;
  brand?: string;
  category: string;
  price: number;
  tier: string;
  phase: 'PHASE_1_TODAY' | 'PHASE_2_STAGGERED';
  description: string;
}

export interface PhasedCartGroup {
  phaseId: 'PHASE_1_TODAY' | 'PHASE_2_STAGGERED';
  label: string;
  timingBadge: string;
  startOffsetDays: number;
  items: Product[];
  skuIds: string[];
  totalPrice: number;
  cartHash: string;
  payIn4Eligible: boolean;
  biWeeklyAmount: number;
  installments: [number, number, number, number];
}

export interface PlanData {
  bundleName: string;
  rationale: string;
  items: Product[];
  totalPrice: number;
  cartHash: string;
  payIn4: {
    eligible: boolean;
    biWeeklyAmount: number;
    installments: [number, number, number, number];
    schedule: Array<{
      installment: number;
      date: string;
      isoDate: string;
      amount: number;
      label: string;
      rentBufferSafe: boolean;
    }>;
    statusMessage: string;
  };
  payMonthly: {
    eligible: boolean;
    sixMonthAmount: number;
    twelveMonthAmount: number;
  };
  phasedSplit: {
    recommended: boolean;
    reason: string;
    peakBiWeeklyDrop: number;
    phase1: PhasedCartGroup;
    phase2: PhasedCartGroup;
  };
  negotiationChips: Array<{ label: string; prompt: string }>;
  sourceMode: string;
}
