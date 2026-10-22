import { cartItemAddOnSchema } from '../validators/cart.validator';
import { orderItemAddOnSchema } from '../validators/order.validator';
import { resolveAuthoritativeAddOns } from './cart.service';

describe('cart add-on validation', () => {
  const currentAddOn = {
    id: 'a2c2f33c-7a1d-4e01-a536-73c527bcf1ca',
    name: 'Extra cheese',
    price: 7.5,
  };

  it('uses the current database name and price instead of stale submitted values', () => {
    expect(resolveAuthoritativeAddOns([currentAddOn], [{
      addOnId: currentAddOn.id,
      name: 'Old cheese name',
      price: 1,
    }])).toEqual([{
      addOnId: currentAddOn.id,
      name: 'Extra cheese',
      price: 7.5,
    }]);
  });

  it('rejects add-ons without an add-on ID', () => {
    expect(cartItemAddOnSchema.safeParse({
      name: 'Extra cheese',
      price: 7.5,
    }).success).toBe(false);
    expect(orderItemAddOnSchema.safeParse({
      name: 'Extra cheese',
      price: 7.5,
    }).success).toBe(false);
    expect(orderItemAddOnSchema.safeParse({
      addOnId: currentAddOn.id,
      name: currentAddOn.name,
      price: currentAddOn.price,
    }).success).toBe(true);
  });

  it('rejects duplicate add-on IDs', () => {
    expect(() => resolveAuthoritativeAddOns([currentAddOn], [
      { addOnId: currentAddOn.id, name: currentAddOn.name, price: currentAddOn.price },
      { addOnId: currentAddOn.id, name: currentAddOn.name, price: currentAddOn.price },
    ])).toThrow('Duplicate add-ons detected');
  });
});
