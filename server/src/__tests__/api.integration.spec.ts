import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { app } from '../app';

test('api.integration: Full Express HTTP lifecycle (/api/config, /api/agent/plan, HMAC tamper rejection)', async () => {
  const server = http.createServer(app);
  await new Promise<void>(resolve => server.listen(0, resolve));
  const { port } = server.address() as { port: number };
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const configRes = await fetch(`${baseUrl}/api/config`);
    assert.equal(configRes.status, 200);
    const configData = (await configRes.json()) as Record<string, any>;
    assert.equal('sandboxBuyerPassword' in configData, false);

    const badPlanRes = await fetch(`${baseUrl}/api/agent/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userGoal: 'Home Gym', biWeeklyBudget: -25 })
    });
    assert.equal(badPlanRes.status, 400);

    const planRes = await fetch(`${baseUrl}/api/agent/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userGoal: 'Home Espresso Bar', biWeeklyBudget: 150, rentDueDay: 1 })
    });
    assert.equal(planRes.status, 200);
    const plan = (await planRes.json()) as Record<string, any>;
    assert.ok(plan.cartHash);
    assert.ok(plan.phasedSplit?.phase1?.cartHash);
    assert.notEqual(plan.cartHash, plan.phasedSplit.phase1.cartHash);

    const forgedRes = await fetch(`${baseUrl}/api/agent/sign-selection`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        skuIds: ['forged-bambino']
      })
    });
    assert.equal(forgedRes.status, 400);

    const tamperRes = await fetch(`${baseUrl}/api/paypal/create-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        skuIds: plan.phasedSplit.phase1.skuIds,
        cartHash: plan.cartHash
      })
    });
    assert.equal(tamperRes.status, 400);
  } finally {
    server.close();
  }
});
