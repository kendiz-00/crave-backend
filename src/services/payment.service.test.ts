import { assertPaymentAmountMatchesOrder } from './payment.service';

describe('payment amount verification', () => {
  it('accepts the backend-created grand total', () => {
    expect(() => assertPaymentAmountMatchesOrder(105, 105)).not.toThrow();
  });

  it('rejects a client subtotal when the stored order total includes tax', () => {
    expect(() => assertPaymentAmountMatchesOrder(100, 105)).toThrow(
      'Payment amount does not match the verified order total',
    );
  });

  it('rejects non-finite and non-positive submitted amounts', () => {
    expect(() => assertPaymentAmountMatchesOrder(Number.NaN, 105)).toThrow(
      'Payment amount must be a positive number',
    );
    expect(() => assertPaymentAmountMatchesOrder(0, 105)).toThrow(
      'Payment amount must be a positive number',
    );
  });
});
