import { CartStatus } from '@prisma/client';
import { ApiError } from '../types/errors';
import { CartItemInput, CreateCartInput, UpdateCartItemInput } from '../validators';
import prisma from '@/database';

type MenuAddOn = { id: string; name: string; price: number | string | { toString(): string } };
type RequestedAddOn = { addOnId: string; name: string; price: number };

export function resolveAuthoritativeAddOns(
  availableAddOns: MenuAddOn[],
  requestedAddOns: RequestedAddOn[] = [],
): { addOnId: string; name: string; price: number }[] {
  const seen = new Set<string>();
  return requestedAddOns.map((requested) => {
    const addOn = availableAddOns.find((available) => available.id === requested.addOnId);
    if (!addOn) {
      throw new ApiError(400, `Invalid add-on: ${requested.name}`);
    }
    if (seen.has(addOn.id)) {
      throw new ApiError(400, 'Duplicate add-ons detected');
    }
    seen.add(addOn.id);
    return {
      addOnId: addOn.id,
      name: addOn.name,
      price: Number(addOn.price),
    };
  });
}

export class CartService {
  /**
   * Get or create active cart for user
   */
  async getActiveCart(userId: string) {
    let cart = await prisma.cart.findFirst({
      where: {
        userId,
        status: CartStatus.ACTIVE,
      },
      include: {
        items: {
          include: {
            menuItem: {
              include: {
                category: true,
                addOns: true,
              },
            },
            addOns: true,
          },
        },
      },
    });

    if (!cart) {
      cart = await prisma.cart.create({
        data: {
          userId,
          status: CartStatus.ACTIVE,
        },
        include: {
          items: {
            include: {
              menuItem: {
                include: {
                  category: true,
                  addOns: true,
                },
              },
              addOns: true,
            },
          },
        },
      });
    }

    return cart;
  }

  /**
   * Create or update cart with items
   * Optimized to use transaction and batch operations
   */
  async createCart(userId: string, data: CreateCartInput) {
    const cart = await this.getActiveCart(userId);
    await prisma.$transaction(async (tx) => {
      // Clear existing items
      await tx.cartItem.deleteMany({
        where: { cartId: cart.id },
      });

      // Add new items in batch
      for (const item of data.items) {
        await this.addCartItemInternal(tx, cart.id, item);
      }
    });
    return this.getActiveCart(userId);
  }

  /**
   * Internal method to add cart item with transaction client
   */
  private async addCartItemInternal(tx: any, cartId: string, item: CartItemInput) { // eslint-disable-line @typescript-eslint/no-explicit-any
    // Validate menu item exists and is available
    const menuItem = await tx.menuItem.findUnique({
      where: { id: item.menuItemId },
      include: { addOns: true },
    });

    if (!menuItem) {
      throw new ApiError(404, 'Menu item not found');
    }

    if (!menuItem.isAvailable || menuItem.isDeleted) {
      throw new ApiError(400, 'Menu item is not available');
    }

    // Validate add-ons and calculate prices from database
    const addOns = resolveAuthoritativeAddOns(menuItem.addOns, item.addOns);
    const addOnsPrice = addOns.reduce((sum, addOn) => sum + addOn.price, 0);

    const unitPrice = Number(menuItem.price);
    const totalPrice = (unitPrice + addOnsPrice) * item.quantity;

    await tx.cartItem.create({
      data: {
        cartId,
        menuItemId: item.menuItemId,
        quantity: item.quantity,
        unitPrice,
        totalPrice,
        addOns: addOns.length > 0
          ? {
              create: addOns.map((addOn) => ({
                addOnId: addOn.addOnId,
                name: addOn.name,
                price: addOn.price,
              })),
            }
          : undefined,
      },
    });
  }

  /**
   * Add item to cart
   */
  async addCartItem(cartId: string, item: CartItemInput) {
    // Validate menu item exists and is available
    const menuItem = await prisma.menuItem.findUnique({
      where: { id: item.menuItemId },
      include: { addOns: true },
    });

    if (!menuItem) {
      throw new ApiError(404, 'Menu item not found');
    }

    if (!menuItem.isAvailable || menuItem.isDeleted) {
      throw new ApiError(400, 'Menu item is not available');
    }

    // Validate add-ons and calculate prices from database
    const addOns = resolveAuthoritativeAddOns(menuItem.addOns, item.addOns);
    const addOnsPrice = addOns.reduce((sum, addOn) => sum + addOn.price, 0);

    // Calculate prices from database (never trust frontend)
    const unitPrice = Number(menuItem.price);
    const totalPrice = (unitPrice + addOnsPrice) * item.quantity;

    // Create cart item
    const cartItem = await prisma.cartItem.create({
      data: {
        cartId,
        menuItemId: item.menuItemId,
        quantity: item.quantity,
        unitPrice,
        totalPrice,
        addOns: addOns.length > 0
          ? {
              create: addOns.map((addOn) => ({
                addOnId: addOn.addOnId,
                name: addOn.name,
                price: addOn.price,
              })),
            }
          : undefined,
      },
      include: {
        menuItem: {
          include: {
            category: true,
            addOns: true,
          },
        },
        addOns: true,
      },
    });

    return cartItem;
  }

  /**
   * Update cart item
   */
  async updateCartItem(cartItemId: string, userId: string, data: UpdateCartItemInput) {
    // Verify cart belongs to user
    const cartItem = await prisma.cartItem.findUnique({
      where: { id: cartItemId },
      include: {
        cart: true,
        menuItem: {
          include: { addOns: true },
        },
      },
    });

    if (!cartItem) {
      throw new ApiError(404, 'Cart item not found');
    }

    if (cartItem.cart.userId !== userId) {
      throw new ApiError(403, 'Access denied');
    }

    // Validate add-ons and calculate prices from database
    const addOns = data.addOns === undefined
      ? undefined
      : resolveAuthoritativeAddOns(cartItem.menuItem.addOns, data.addOns);
    const addOnsPrice = (addOns || []).reduce((sum, addOn) => sum + addOn.price, 0);

    // Recalculate prices from database (never trust frontend)
    const unitPrice = Number(cartItem.menuItem.price);
    const totalPrice = (unitPrice + addOnsPrice) * data.quantity;

    // Update cart item with transaction for atomicity
    const updated = await prisma.$transaction(async (tx) => {
      return tx.cartItem.update({
        where: { id: cartItemId },
        data: {
          quantity: data.quantity,
          totalPrice,
          addOns: addOns
            ? {
                deleteMany: {},
                create: addOns.map((addOn) => ({
                  addOnId: addOn.addOnId,
                  name: addOn.name,
                  price: addOn.price,
                })),
              }
            : undefined,
        },
        include: {
          menuItem: {
            include: {
              category: true,
              addOns: true,
            },
          },
          addOns: true,
        },
      });
    });

    return updated;
  }

  /**
   * Delete cart item
   */
  async deleteCartItem(cartItemId: string, userId: string) {
    const cartItem = await prisma.cartItem.findUnique({
      where: { id: cartItemId },
      include: { cart: true },
    });

    if (!cartItem) {
      throw new ApiError(404, 'Cart item not found');
    }

    if (cartItem.cart.userId !== userId) {
      throw new ApiError(403, 'Access denied');
    }

    await prisma.cartItem.delete({
      where: { id: cartItemId },
    });
  }

  /**
   * Clear cart
   */
  async clearCart(userId: string) {
    const cart = await this.getActiveCart(userId);

    await prisma.cartItem.deleteMany({
      where: { cartId: cart.id },
    });

    return this.getActiveCart(userId);
  }

  /**
   * Mark cart as checked out
   */
  async markCartCheckedOut(cartId: string) {
    return prisma.cart.update({
      where: { id: cartId },
      data: { status: CartStatus.CHECKED_OUT },
    });
  }

  /**
   * Calculate cart total
   */
  async calculateCartTotal(cartId: string) {
    const cart = await prisma.cart.findUnique({
      where: { id: cartId },
      include: {
        items: true,
      },
    });

    if (!cart) {
      throw new ApiError(404, 'Cart not found');
    }

    const subtotal = cart.items.reduce((sum, item) => sum + Number(item.totalPrice), 0);
    const itemCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);

    return {
      subtotal,
      itemCount,
    };
  }
}

export const cartService = new CartService();
