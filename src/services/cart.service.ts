import { PrismaClient, CartStatus } from '@prisma/client';
import { ApiError } from '../types/errors';
import { CartItemInput, CreateCartInput, UpdateCartItemInput } from '../validators';

const prisma = new PrismaClient();

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
   */
  async createCart(userId: string, data: CreateCartInput) {
    // Get or create active cart
    const cart = await this.getActiveCart(userId);

    // Clear existing items
    await prisma.cartItem.deleteMany({
      where: { cartId: cart.id },
    });

    // Add new items
    for (const item of data.items) {
      await this.addCartItem(cart.id, item);
    }

    // Return updated cart
    return this.getActiveCart(userId);
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

    // Validate add-ons
    if (item.addOns && item.addOns.length > 0) {
      const validAddOnIds = menuItem.addOns.map((a) => a.id);
      for (const addOn of item.addOns) {
        if (!validAddOnIds.includes(addOn.addOnId)) {
          throw new ApiError(400, `Invalid add-on: ${addOn.name}`);
        }
      }
    }

    // Calculate prices from database (never trust frontend)
    const unitPrice = Number(menuItem.price);
    const addOnsPrice = item.addOns?.reduce((sum, a) => sum + Number(a.price), 0) || 0;
    const totalPrice = (unitPrice + addOnsPrice) * item.quantity;

    // Create cart item
    const cartItem = await prisma.cartItem.create({
      data: {
        cartId,
        menuItemId: item.menuItemId,
        quantity: item.quantity,
        unitPrice,
        totalPrice,
        addOns: item.addOns
          ? {
              create: item.addOns.map((a) => ({
                addOnId: a.addOnId,
                name: a.name,
                price: a.price,
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

    // Validate add-ons if provided
    if (data.addOns) {
      const validAddOnIds = cartItem.menuItem.addOns.map((a) => a.id);
      for (const addOn of data.addOns) {
        if (!validAddOnIds.includes(addOn.addOnId)) {
          throw new ApiError(400, `Invalid add-on: ${addOn.name}`);
        }
      }
    }

    // Recalculate prices
    const unitPrice = Number(cartItem.menuItem.price);
    const addOnsPrice = data.addOns?.reduce((sum, a) => sum + Number(a.price), 0) || 0;
    const totalPrice = (unitPrice + addOnsPrice) * data.quantity;

    // Update cart item
    const updated = await prisma.cartItem.update({
      where: { id: cartItemId },
      data: {
        quantity: data.quantity,
        totalPrice,
        addOns: data.addOns
          ? {
              deleteMany: {},
              create: data.addOns.map((a) => ({
                addOnId: a.addOnId,
                name: a.name,
                price: a.price,
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
