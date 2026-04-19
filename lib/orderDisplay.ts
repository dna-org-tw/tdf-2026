export type OrderTone = 'free' | 'complimentary' | 'paid';

export interface FormattedOrderAmount {
  label: string;
  tone: OrderTone;
}

export function formatOrderAmount(
  amountCents: number,
  currency: string,
  opts: { lang?: 'en' | 'zh'; complimentary?: boolean } = {},
): FormattedOrderAmount {
  const { lang = 'en', complimentary = false } = opts;
  if (amountCents === 0) {
    if (complimentary) {
      return { label: lang === 'zh' ? '贈票' : 'Complimentary', tone: 'complimentary' };
    }
    return { label: lang === 'zh' ? '免費' : 'Free', tone: 'free' };
  }
  const decimal = (amountCents / 100).toFixed(2);
  const upper = currency.toUpperCase();
  return {
    label: `${upper === 'USD' ? '$' : ''}${decimal} ${upper}`,
    tone: 'paid',
  };
}
