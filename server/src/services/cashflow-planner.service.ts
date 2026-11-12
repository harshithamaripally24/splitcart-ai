import { discoverProductsWithGemini } from './gemini-discovery.service';
import { computeInstallmentsInDollars, signSingleItemQuote, verifyAndSignCart } from './cart-crypto.service';
import { registerProductsInQuoteStore } from '../repositories/quote-registry.repository';
import { ValidationError } from '../errors/http-errors';
import { BundlePlanResponse, Product } from '../types/commerce.types';

export function isDateSafeFromBillDay(dateObj: Date, rentDueDay: number): boolean {
  const year = dateObj.getFullYear();
  const month = dateObj.getMonth();
  const targetUtcNoon = Date.UTC(year, month, dateObj.getDate(), 12, 0, 0);

  for (const m of [month - 1, month, month + 1]) {
    const daysInMonth = new Date(Date.UTC(year, m + 1, 0)).getUTCDate();
    const clampedBillDay = Math.min(rentDueDay, daysInMonth);
    const billUtcNoon = Date.UTC(year, m, clampedBillDay, 12, 0, 0);
    const diffDays = Math.round(Math.abs(targetUtcNoon - billUtcNoon) / 86400000);
    if (diffDays <= 2) return false;
  }
  return true;
}

function buildFourInstallmentSchedule(
  installments: [number, number, number, number],
  rentDueDay: number
) {
  const labels = ['Payment 1 (Today)', 'Payment 2 (+14d)', 'Payment 3 (+28d)', 'Payment 4 (+42d)'];
  const dayOffsets = [0, 14, 28, 42];
  const now = new Date();

  return dayOffsets.map((offset, idx) => {
    const d = new Date(now);
    d.setDate(now.getDate() + offset);
    return {
      installment: idx + 1,
      label: labels[idx],
      date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      isoDate: d.toISOString(),
      amount: installments[idx],
      rentBufferSafe: isDateSafeFromBillDay(d, rentDueDay)
    };
  });
}

export async function buildCashFlowBundlePlan(
  userGoal: string,
  biWeeklyBudget: number,
  tradeOffPrompt?: string,
  rentDueDay: number = 1
): Promise<BundlePlanResponse> {
  const numericBudget = Number(biWeeklyBudget);
  if (isNaN(numericBudget) || numericBudget < 15 || numericBudget > 10000) {
    throw new ValidationError('INVALID_BUDGET: biWeeklyBudget must be between $15 and $10,000.');
  }

  const cleanBudget = Math.round(numericBudget);
  const cleanRentDay = Math.max(1, Math.min(31, Number(rentDueDay) || 1));
  const targetTotal = cleanBudget * 4;

  const discovered = await discoverProductsWithGemini(
    userGoal || 'Home Espresso Bar',
    cleanBudget,
    targetTotal,
    tradeOffPrompt || ''
  );

  const prioritizedRaw = [...discovered.rawProducts].sort((a, b) => {
    const aScore = a.phase === 'PHASE_1_TODAY' || a.tier === 'essential' ? 1 : 0;
    const bScore = b.phase === 'PHASE_1_TODAY' || b.tier === 'essential' ? 1 : 0;
    return bScore - aScore;
  });

  const normalizedProducts: Product[] = prioritizedRaw.map((item: Product, idx: number) => {
    const cleanPrice = Number(Math.max(5, Number(item.price)).toFixed(2));
    const priceCents = Math.round(cleanPrice * 100);
    const rawId = String(item.id || ('sku-' + (idx + 1))).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 36);
    const cleanId = rawId.endsWith(String(priceCents)) ? rawId : (rawId + '-' + priceCents);
    return {
      ...item,
      id: cleanId,
      price: cleanPrice,
      tier: idx < 2 ? 'essential' : 'recommended',
      phase: idx < 2 ? 'PHASE_1_TODAY' : 'PHASE_2_STAGGERED',
      itemSig: signSingleItemQuote(cleanId, cleanPrice)
    };
  });

  const registeredItems = registerProductsInQuoteStore(normalizedProducts);
  const signedItems: Product[] = registeredItems.map((item: Product) => ({
    ...item,
    itemSig: signSingleItemQuote(item.id, item.price)
  }));

  const allSkuIds = signedItems.map((i: Product) => i.id);
  const fullVerified = verifyAndSignCart(allSkuIds);
  const totalPrice = fullVerified.total;
  const fullInstallments = computeInstallmentsInDollars(fullVerified.totalCents);
  const biWeeklyAmount = fullInstallments[0];

  const payIn4Eligible = fullVerified.totalCents >= 3000 && fullVerified.totalCents <= 150000;

  const p1Raw = signedItems.slice(0, 2);
  const p2Raw = signedItems.slice(2);

  const p1Verified = verifyAndSignCart(p1Raw.map((i: Product) => i.id));
  const p1Installments = computeInstallmentsInDollars(p1Verified.totalCents);

  const p2Verified =
    p2Raw.length > 0
      ? verifyAndSignCart(p2Raw.map((i: Product) => i.id))
      : { items: [] as Product[], total: 0, totalCents: 0, cartHash: '' };
  const p2Installments =
    p2Raw.length > 0
      ? computeInstallmentsInDollars(p2Verified.totalCents)
      : ([0, 0, 0, 0] as [number, number, number, number]);

  const peakBiWeeklyDrop = Number(Math.max(0, biWeeklyAmount - p1Installments[0]).toFixed(2));
  const exceedsComfortCap = biWeeklyAmount > cleanBudget;

  return {
    bundleName: discovered.bundleName,
    rationale: discovered.rationale,
    items: signedItems,
    totalPrice,
    cartHash: fullVerified.cartHash,
    payIn4: {
      eligible: payIn4Eligible,
      biWeeklyAmount,
      installments: fullInstallments,
      schedule: buildFourInstallmentSchedule(fullInstallments, cleanRentDay),
      statusMessage: payIn4Eligible
        ? 'Eligible for 4 bi-weekly PayPal Pay in 4 payments of $' + biWeeklyAmount.toFixed(2) + ' (0% APR)'
        : 'Full cart ($' + totalPrice.toFixed(2) + ') exceeds the $1,500 single-order Pay in 4 cap.'
    },
    payMonthly: {
      eligible: totalPrice >= 199,
      sixMonthAmount: Number((totalPrice / 6).toFixed(2)),
      twelveMonthAmount: Number((totalPrice / 12).toFixed(2))
    },
    phasedSplit: {
      recommended: !payIn4Eligible || exceedsComfortCap,
      reason: !payIn4Eligible
        ? 'Full bundle ($' + totalPrice.toFixed(2) + ') exceeds the $1,500 single-order PayPal Pay in 4 limit. Buying Phase 1 Essentials today ($' + p1Verified.total.toFixed(2) + ') and Phase 2 Extras in 28 days ($' + p2Verified.total.toFixed(2) + ') unlocks 0% APR Pay in 4 on both orders.'
        : exceedsComfortCap
        ? 'Full bundle ($' + biWeeklyAmount.toFixed(2) + '/2wks) is above your $' + cleanBudget + '/2wks comfort cap. Buying Phase 1 Essentials first lowers your immediate payment to $' + p1Installments[0].toFixed(2) + '/2wks.'
        : 'Buying Phase 1 Essentials today lowers your immediate bi-weekly payment from $' + biWeeklyAmount.toFixed(2) + ' to $' + p1Installments[0].toFixed(2) + '/2wks.',
      peakBiWeeklyDrop,
      phase1: {
        phaseId: 'PHASE_1_TODAY',
        label: 'Phase 1: Day-1 Essentials (Buy Today)',
        timingBadge: 'Buy Today',
        startOffsetDays: 0,
        skuIds: p1Verified.items.map((i: Product) => i.id),
        items: p1Verified.items,
        totalPrice: p1Verified.total,
        biWeeklyAmount: p1Installments[0],
        installments: p1Installments,
        cartHash: p1Verified.cartHash,
        payIn4Eligible: p1Verified.totalCents >= 3000 && p1Verified.totalCents <= 150000
      },
      phase2: {
        phaseId: 'PHASE_2_STAGGERED',
        label: 'Phase 2: Extras (Wait +28 Days)',
        timingBadge: 'Wait +28 Days',
        startOffsetDays: 28,
        skuIds: p2Verified.items.map((i: Product) => i.id),
        items: p2Verified.items,
        totalPrice: p2Verified.total,
        biWeeklyAmount: p2Installments[0],
        installments: p2Installments,
        cartHash: p2Verified.cartHash,
        payIn4Eligible: p2Verified.totalCents >= 3000 && p2Verified.totalCents <= 150000
      }
    },
    negotiationChips: discovered.negotiationChips,
    sourceMode: discovered.sourceMode
  };
}