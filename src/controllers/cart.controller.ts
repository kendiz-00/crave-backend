import { Request, Response } from 'express';
import { cartService } from '../services';
import { createCartSchema, updateCartItemSchema } from '../validators';
import { asyncHandler } from '../middleware/asyncHandler';

export class CartController {
  /**
   * POST /cart
   * Create or update cart with items
   */
  createCart = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }
    const data = createCartSchema.parse(req.body);

    const cart = await cartService.createCart(userId, data);

    res.status(200).json({
      success: true,
      data: cart,
    });
  });

  /**
   * GET /cart
   * Get user's active cart
   */
  getCart = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const cart = await cartService.getActiveCart(userId);

    res.status(200).json({
      success: true,
      data: cart,
    });
  });

  /**
   * PATCH /cart/items/:id
   * Update cart item quantity and add-ons
   */
  updateCartItem = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }
    const cartItemId = req.params.id;
    const data = updateCartItemSchema.parse(req.body);

    const cartItem = await cartService.updateCartItem(cartItemId, userId, data);

    res.status(200).json({
      success: true,
      data: cartItem,
    });
  });

  /**
   * DELETE /cart/items/:id
   * Delete cart item
   */
  deleteCartItem = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }
    const cartItemId = req.params.id;

    await cartService.deleteCartItem(cartItemId, userId);

    res.status(204).send();
  });

  /**
   * DELETE /cart
   * Clear cart
   */
  clearCart = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const cart = await cartService.clearCart(userId);

    res.status(200).json({
      success: true,
      data: cart,
    });
  });
}

export const cartController = new CartController();
