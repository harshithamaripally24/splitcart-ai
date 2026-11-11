import { Router } from 'express';
import { getHealthStatus, getPublicClientConfig, createBundlePlanHandler } from '../controllers/bundle-plan.controller';
import { createOrderHandler, captureOrderHandler } from '../controllers/paypal-order.controller';
import { apiRateLimiter } from '../middleware/rate-limiter.middleware';

export const v1Router = Router();

v1Router.get('/health', getHealthStatus);
v1Router.get('/config', getPublicClientConfig);
v1Router.get('/judge-info', getPublicClientConfig);
v1Router.post('/agent/plan', apiRateLimiter(25, 60000), createBundlePlanHandler);
v1Router.post('/paypal/create-order', apiRateLimiter(30, 60000), createOrderHandler);
v1Router.post('/paypal/capture-order', apiRateLimiter(30, 60000), captureOrderHandler);
