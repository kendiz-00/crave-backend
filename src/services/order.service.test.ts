import { calculateCartSubtotalFromCatalog, calculateOrderAmounts } from './order.service';

describe('server order totals', () => {
  it('uses current menu and add-on prices for quantity-based subtotal and tax', () => {
    const subtotal = calculateCartSubtotalFromCatalog([
      {
        menuItemId: 'meal-a',
        quantity: 2,
        addOns: [{ addOnId: 'extra-cheese' }],
      },
      {
        menuItemId: 'meal-b',
        quantity: 1,
        addOns: [],
      },
    ], [
      { id: 'meal-a', price: 10 },
      { id: 'meal-b', price: 25 },
    ], [
      { id: 'extra-cheese', price: 3 },
    ]);

    const totals = calculateOrderAmounts(subtotal, 0, 0);
    expect(subtotal).toBe(51);
    expect(totals).toEqual({ tax: 2.55, grandTotal: 53.55 });
  });

  it('applies discounts and delivery against backend-computed totals', () => {
    expect(calculateOrderAmounts(51, 5, 4)).toEqual({
      tax: 2.55,
      grandTotal: 52.55,
    });
  });

  it('rejects a cart item with an add-on absent from the current catalog', () => {
    expect(() => calculateCartSubtotalFromCatalog([
      { menuItemId: 'meal-a', quantity: 1, addOns: [{ addOnId: 'missing' }] },
    ], [{ id: 'meal-a', price: 10 }], [])).toThrow(
      'One or more add-ons are invalid or no longer available',
    );
  });
});
