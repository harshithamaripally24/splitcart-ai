import type { PlanData } from '../types/bundle.types';

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export async function fetchClientConfig(): Promise<{ paypalClientId: string }> {
  const res = await fetch(`${API_URL}/api/config`);
  if (!res.ok) throw new Error('Failed to load configuration');
  return res.json();
}

export async function requestBundlePlan(params: {
  userGoal: string;
  biWeeklyBudget: number;
  tradeOffPrompt?: string;
  rentDueDay: number;
}): Promise<PlanData> {
  const res = await fetch(`${API_URL}/api/agent/plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  });
  const data = await res.json();
  if (!res.ok || data.error || !Array.isArray(data.items)) {
    throw new Error(data.error || 'Failed to generate bundle plan.');
  }
  return data;
}

