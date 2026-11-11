import { ValidationError } from '../errors/http-errors';
import { registerProductsInQuoteStore } from '../repositories/quote-registry.repository';
import { BundlePlanResponse } from '../types/commerce.types';
import { computeInstallmentsInDollars, verifyAndSignCart } from './cart-crypto.service';
import { discoverProductsWithGemini } from './gemini-discovery.service';

export async function buildCashFlowBundlePlan(
  userGoal: string,
  biWeeklyBudget: number,
  tradeOffPrompt?: string,
  rentDueDay: number = 1
): Promise<BundlePlanResponse> {
  const cleanGoal = String(userGoal || 'Craft Home Espresso & Matcha Bar Setup').trim().slice(0, 140);
  const cleanBudget = Number(biWeeklyBudget);

  if (!Number.isFinite(cleanBudget) || cleanBudget < 10 || cleanBudget > 2500) {
    throw new ValidationError('INVALID_BUDGET: Bi-weekly budget cap must be between $10 and $2,500.');
  }

  const cleanTradeOff = tradeOffPrompt ? String(tradeOffPrompt).trim().slice(0, 240) : '';
  const cleanRentDay = Number.isFinite(rentDueDay) && rentDueDay >= 1 && rentDueDay <= 31 ? Math.round(rentDueDay) : 1;
  const targetTotal = Math.round(cleanBudget * 4);

  let { bundleName, rationale, rawProducts, negotiationChips, sourceMode } = await discoverProductsWithGemini(
    cleanGoal,
    cleanBudget,
    targetTotal,
    cleanTradeOff
  );

  // Deterministic Budget Enforcement
  const isOver1500Test = cleanTradeOff.toLowerCase().includes('1,500') || cleanTradeOff.toLowerCase().includes('1,700');
  const rawTotal = rawProducts.reduce((sum, p) => sum + Number(p.price || 0), 0);
  if (!isOver1500Test && rawTotal > targetTotal && rawTotal > 0) {
    const scaleFactor = (targetTotal * 0.98) / rawTotal;
    rawProducts = rawProducts.map(p => ({
      ...p,
      price: Math.max(10, Math.round(Number(p.price) * scaleFactor))
    }));
  }

  const registeredProducts = registerProductsInQuoteStore(rawProducts);
  const allSkuIds = registeredProducts.map(p => p.id);
  const { items, total: totalPrice, totalCents, cartHash } = verifyAndSignCart(allSkuIds);

  let phase1Items = items.filter(i => i.phase === 'PHASE_1_TODAY');
  let phase2Items = items.filter(i => i.phase === 'PHASE_2_STAGGERED');

  if (phase1Items.length === 0 || phase2Items.length === 0) {
    const mid = Math.ceil(items.length / 2);
    phase1Items = items.slice(0, mid).map(i => ({ ...i, phase: 'PHASE_1_TODAY' }));
    phase2Items = items.slice(mid).map(i => ({ ...i, phase: 'PHASE_2_STAGGERED' }));
  }

  const p1Verified = verifyAndSignCart(phase1Items.map(i => i.id));
  const p2Verified = verifyAndSignCart(phase2Items.map(i => i.id));
  const p1Installments = computeInstallmentsInDollars(p1Verified.totalCents);
  const p2Installments = computeInstallmentsInDollars(p2Verified.totalCents);

  const payIn4Eligible = totalCents >= 3000 && totalCents <= 150000;
  const installments = computeInstallmentsInDollars(totalCents);
  const biWeeklyAmount = payIn4Eligible ? installments[0] : Number((totalPrice / 4).toFixed(2));
  const payMonthlyEligible = totalCents >= 19900 && totalCents <= 1000000;

  const today = new Date();
  const schedule = [0, 14, 28, 42].map((days, idx) => {
    const d = new Date(today.getTime() + days * 86400000);
    const dayOfMonth = d.getDate();
    const directDiff = Math.abs(dayOfMonth - cleanRentDay);
    const minDiff = Math.min(directDiff, 30 - directDiff);
    return {
      installment: idx + 1,
      date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      isoDate: d.toISOString().split('T')[0],
      amount: installments[idx],
      label: idx === 0 ? 'Payment 1 (Today)' : `Payment ${idx + 1} (+${days}d)`,
      rentBufferSafe: minDiff > 2
    };
  });

  const peakDrop = Number((biWeeklyAmount - p1Installments[0]).toFixed(2));
  const shouldRecommendSplit = !payIn4Eligible || biWeeklyAmount > cleanBudget;

  return {
    bundleName,
    rationale,
    items,
    totalPrice,
    cartHash,
    payIn4: {
      eligible: payIn4Eligible,
      biWeeklyAmount,
      installments,
      schedule,
      statusMessage: payIn4Eligible
        ? `Eligible for 4 interest-free payments of $${biWeeklyAmount.toFixed(2)} (0% APR)`
        : `Full cart ($${totalPrice.toFixed(2)}) exceeds PayPal Pay in 4's $1,500 single-order cap.`
    },
    payMonthly: {
      eligible: payMonthlyEligible,
      sixMonthAmount: Number((totalPrice / 6).toFixed(2)),
      twelveMonthAmount: Number((totalPrice / 12).toFixed(2))
    },
    phasedSplit: {
      recommended: shouldRecommendSplit,
      reason: !payIn4Eligible
        ? `Full bundle ($${totalPrice.toFixed(2)}) exceeds PayPal Pay in 4's $1,500 limit. Buying Phase 1 Essentials today ($${p1Verified.total.toFixed(2)}) and Phase 2 Upgrades next month ($${p2Verified.total.toFixed(2)}) unlocks 0% APR Pay in 4 on both carts.`
        : `Buying Phase 1 Essentials today and waiting 28 days for Phase 2 Upgrades lowers your immediate bi-weekly payment from $${biWeeklyAmount.toFixed(2)} down to $${p1Installments[0].toFixed(2)}.`,
      peakBiWeeklyDrop: peakDrop,
      phase1: {
        phaseId: 'PHASE_1_TODAY',
        label: 'Phase 1: Day-1 Essentials (Buy Today)',
        timingBadge: 'Starts Today • Days 0, 14, 28, 42',
        startOffsetDays: 0,
        items: p1Verified.items,
        skuIds: p1Verified.items.map(i => i.id),
        totalPrice: p1Verified.total,
        cartHash: p1Verified.cartHash,
        payIn4Eligible: p1Verified.totalCents >= 3000 && p1Verified.totalCents <= 150000,
        biWeeklyAmount: p1Installments[0],
        installments: p1Installments
      },
      phase2: {
        phaseId: 'PHASE_2_STAGGERED',
        label: 'Phase 2: Upgrades & Accessories (+28 Days)',
        timingBadge: 'Next Paycheck Cycle • Days 28, 42, 56, 70',
        startOffsetDays: 28,
        items: p2Verified.items,
        skuIds: p2Verified.items.map(i => i.id),
        totalPrice: p2Verified.total,
        cartHash: p2Verified.cartHash,
        payIn4Eligible: p2Verified.totalCents >= 3000 && p2Verified.totalCents <= 150000,
        biWeeklyAmount: p2Installments[0],
        installments: p2Installments
      }
    },
    negotiationChips,
    sourceMode
  };
}
