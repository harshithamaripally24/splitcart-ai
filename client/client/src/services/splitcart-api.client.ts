import { PlanData } from '../types/bundle.types';

export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export async function fetchPublicConfig(): Promise<{ paypalClientId: string }> {
  const res = await fetch(`${API_BASE_URL}/api/config`);
  if (!res.ok) throw new Error('Failed to load application configuration.');
  return res.json();
}

export async function fetchBundlePlan(params: {
  userGoal: string;
  biWeeklyBudget: number;
  tradeOffPrompt?: string;
  rentDueDay: number;
}): Promise<PlanData> {
  const res = await fetch(`${API_BASE_URL}/api/agent/plan`, {
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
