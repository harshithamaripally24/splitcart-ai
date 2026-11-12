import { Request, Response, NextFunction } from 'express';
import { createPayPalOrder, capturePayPalOrder } from '../services/paypal-checkout.service';

export async function createOrderHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { skuIds, cartHash } = req.body || {};
    const order = await createPayPalOrder(skuIds, cartHash);
    res.json(order);
  } catch (err) {
    next(err);
  }
}

export async function captureOrderHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { orderID } = req.body || {};
    const capture = await capturePayPalOrder(orderID);
    res.json(capture);
  } catch (err) {
    next(err);
  }
}
