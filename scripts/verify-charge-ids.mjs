import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const ids = [
  'ch_3SrBpjB0e5oBVi8T0T3TH1mf','ch_3Sr9GHB0e5oBVi8T1fU8kpiy','ch_3Sqxq7B0e5oBVi8T1PjOFcHT',
  'ch_3Sqqw7B0e5oBVi8T0oU7tDQw','ch_3SqquZB0e5oBVi8T1cJr8DCe','ch_3SqquRB0e5oBVi8T1Z3eJH5p',
  'ch_3SqqqoB0e5oBVi8T15rj1MDE','ch_3SqqiKB0e5oBVi8T1pLb0Ngb','ch_3SqVmnB0e5oBVi8T1wpAkL2P',
  'ch_3SqU7pB0e5oBVi8T15Q8h5qR','ch_3SqU5OB0e5oBVi8T0ryVEieu','ch_3SqU19B0e5oBVi8T057dk1C5',
  'ch_3SqSwdB0e5oBVi8T0mNEkXZG','ch_3SqRe6B0e5oBVi8T07eYHmlC','ch_3SqRITB0e5oBVi8T1GVdQALs',
];
for (const id of ids) {
  try {
    const c = await stripe.charges.retrieve(id);
    console.log(`${id}  status=${c.status}  paid=${c.paid}  amount=${c.amount}  email=${c.billing_details?.email ?? c.receipt_email ?? ''}`);
  } catch (e) {
    console.log(`${id}  ERROR: ${e.message}`);
  }
}
