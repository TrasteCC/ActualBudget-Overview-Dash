import type { RawTx, Snapshot } from './overview';

// DEMO=1: a made-up budget for screenshots and the public demo. Nothing here is real data.
// 14 months ending today. Each month has its own fixed seed, so a past month always looks the same.

function rng(seed: number) { // mulberry32
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const GROUPS: [string, string][] = [
  ['housing', 'Housing'], ['food', 'Food & drink'], ['transport', 'Transport'], ['lifestyle', 'Lifestyle'],
  ['health', 'Health & care'], ['travel', 'Travel & gifts'], ['savings', 'Savings'], ['income', 'Income'],
];

const CATEGORIES: [string, string, string][] = [
  ['rent', 'Rent', 'housing'], ['utilities', 'Utilities', 'housing'], ['internet', 'Internet & phone', 'housing'],
  ['home', 'Home & furniture', 'housing'], ['insurance', 'Insurance', 'housing'],
  ['groceries', 'Groceries', 'food'], ['restaurants', 'Restaurants', 'food'], ['coffee', 'Coffee & snacks', 'food'],
  ['fuel', 'Fuel', 'transport'], ['transit', 'Public transport', 'transport'], ['car', 'Car maintenance', 'transport'],
  ['parking', 'Parking & tolls', 'transport'],
  ['subscriptions', 'Subscriptions', 'lifestyle'], ['shopping', 'Shopping', 'lifestyle'],
  ['entertainment', 'Entertainment', 'lifestyle'], ['sports', 'Sports', 'lifestyle'],
  ['health', 'Health', 'health'], ['pharmacy', 'Pharmacy', 'health'], ['personal', 'Personal care', 'health'],
  ['travel', 'Travel', 'travel'], ['gifts', 'Gifts', 'travel'],
  ['investments', 'Investments', 'savings'], ['fees', 'Bank fees', 'savings'],
  ['salary', 'Salary', 'income'], ['freelance', 'Freelance', 'income'], ['other-income', 'Other income', 'income'],
];

const PAYEES = [
  'Acme Corp', 'Freelance client', 'Landlord', 'City Power & Light', 'AquaCity Water', 'FiberNet', 'MobileOne',
  'SafeHome Insurance', 'AutoShield Insurance', 'FreshMart', 'GreenGrocer', 'Market Square', 'Corner Bakery',
  'Daily Grind Café', 'Café Luna', 'Bistro 21', 'Pizza Nova', 'Sushi Zen', 'Taco Loco', 'The Green Fork',
  'QuickFuel', 'Metro Transit', 'CityPark', 'AutoCare Garage', 'StreamFlix', 'TuneBox', 'CloudDrive',
  'Daily Ledger', 'FitClub', 'MegaMart', 'Style & Co', 'Gadget Store', 'BookNook', 'Cinema Royale',
  'Concert Hall', 'Pharmacy Plus', 'Dr. Rivera Clinic', 'Smile Dental', 'Barber & Co', 'HomeFix', 'Nordic Home',
  'SkyWay Airlines', 'Hotel Aurora', 'RentaRide', 'City Museum', 'Index Fund Co', 'Bank',
];

const ACCOUNTS = [
  { id: 'acc-checking', name: 'Checking', offbudget: false, closed: false },
  { id: 'acc-card', name: 'Credit card', offbudget: false, closed: false },
  { id: 'acc-savings', name: 'Savings', offbudget: true, closed: false },
];

const pid = (name: string) => `p-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
const xfer = (acc: string) => `p-transfer-${acc}`;

export function demoSnapshot(): Snapshot {
  const now = new Date();
  const rawTrans: RawTx[] = [];

  for (let back = 13; back >= 0; back--) {
    const first = new Date(now.getFullYear(), now.getMonth() - back, 1);
    const y = first.getFullYear();
    const mo = first.getMonth(); // 0-based
    const key = `${y}-${String(mo + 1).padStart(2, '0')}`;
    const daysIn = new Date(y, mo + 1, 0).getDate();
    const lastDay = back === 0 ? now.getDate() : daysIn;
    const r = rng(y * 12 + mo);
    const between = (lo: number, hi: number) => lo + r() * (hi - lo);
    const int = (lo: number, hi: number) => Math.floor(between(lo, hi + 1));
    const day = () => int(1, daysIn);
    let n = 0;
    const month: RawTx[] = [];

    const add = (d: number, account: string, eur: number, payee: string, category: string | null, notes = '', extra: Partial<RawTx> = {}) => {
      const t: RawTx = {
        id: `tx-${key}-${++n}`, date: `${key}-${String(d).padStart(2, '0')}`, amount: Math.round(eur * 100),
        account, payee: pid(payee), category, notes, ...extra,
      };
      month.push(t);
      return t;
    };
    const transfer = (d: number, from: string, to: string, eur: number, notes = '') => {
      const a = add(d, from, -eur, '', null, notes, { payee: xfer(to) });
      const b = add(d, to, eur, '', null, notes, { payee: xfer(from) });
      a.transfer_id = b.id;
      b.transfer_id = a.id;
    };
    const many = (count: number, account: () => string, lo: number, hi: number, payees: string[], category: string, notes: () => string = () => '') => {
      for (let i = 0; i < count; i++) add(day(), account(), -between(lo, hi), payees[int(0, payees.length - 1)], category, notes());
    };
    const either = () => (r() < 0.6 ? 'acc-card' : 'acc-checking');
    const card = () => 'acc-card';
    const checking = () => 'acc-checking';
    const auto = (text: string) => () => (r() < 0.35 ? `${text} #auto` : r() < 0.5 ? text : '');

    if (back === 13) {
      add(1, 'acc-checking', 2400, 'Bank', null, 'Starting balance', { starting_balance_flag: true });
      add(1, 'acc-savings', 8000, 'Bank', null, 'Starting balance', { starting_balance_flag: true });
    }

    // Income
    add(1, 'acc-checking', 4300, 'Acme Corp', 'salary', 'Monthly salary');
    if (mo === 11) add(20, 'acc-checking', 2000, 'Acme Corp', 'salary', 'Year-end bonus');
    if (r() < 0.35) add(int(10, 25), 'acc-checking', between(250, 900), 'Freelance client', 'freelance', 'Website project');
    if (r() < 0.3) add(day(), 'acc-card', between(15, 60), 'MegaMart', 'other-income', 'Refund');
    add(daysIn, 'acc-savings', between(3.5, 5.5), 'Bank', null, 'Interest');

    // Fixed costs
    add(1, 'acc-checking', -1150, 'Landlord', 'rent', 'Rent');
    add(2, 'acc-checking', -300, 'Index Fund Co', 'investments', 'Monthly contribution #savings');
    add(2, 'acc-checking', -39, 'FitClub', 'sports', 'Gym membership');
    add(3, 'acc-checking', -32.5, 'SafeHome Insurance', 'insurance', 'Home insurance');
    add(5, 'acc-checking', -between(mo <= 1 || mo >= 10 ? 95 : 55, mo <= 1 || mo >= 10 ? 145 : 90), 'City Power & Light', 'utilities', 'Electricity #auto');
    if (mo % 2 === 0) add(7, 'acc-checking', -between(30, 42), 'AquaCity Water', 'utilities', 'Water');
    add(8, 'acc-checking', -45, 'FiberNet', 'internet', 'Fibre 600 Mb');
    add(12, 'acc-checking', -18, 'MobileOne', 'internet', 'Phone plan');
    add(9, 'acc-card', -13.99, 'StreamFlix', 'subscriptions', '#auto');
    add(14, 'acc-card', -10.99, 'TuneBox', 'subscriptions', '');
    add(20, 'acc-card', -2.99, 'CloudDrive', 'subscriptions', '');
    add(22, 'acc-card', -7.99, 'Daily Ledger', 'subscriptions', 'News');
    add(1, 'acc-checking', -40, 'Metro Transit', 'transit', 'Monthly pass');
    add(daysIn, 'acc-checking', -2, 'Bank', 'fees', 'Account fee');
    if (mo === 2) add(15, 'acc-checking', -410, 'AutoShield Insurance', 'insurance', 'Car insurance (yearly)');

    // Everyday spending
    many(int(9, 13), either, 18, 95, ['FreshMart', 'GreenGrocer', 'Market Square', 'Corner Bakery'], 'groceries', auto('Groceries'));
    many(int(10, 18), either, 2.4, 8.5, ['Daily Grind Café', 'Café Luna', 'Corner Bakery'], 'coffee', auto('Coffee'));
    many(int(4, 8), card, 16, 72, ['Bistro 21', 'Pizza Nova', 'Sushi Zen', 'Taco Loco', 'The Green Fork'], 'restaurants');
    many(int(2, 4), card, 45, 75, ['QuickFuel'], 'fuel');
    many(int(4, 9), checking, 1.5, 12, ['Metro Transit'], 'transit');
    many(int(2, 4), card, 2, 12, ['CityPark'], 'parking');
    many(int(2, 5), card, 12, 140, ['Style & Co', 'Gadget Store', 'BookNook', 'MegaMart'], 'shopping');
    many(int(1, 3), card, 9, 45, ['Cinema Royale', 'Concert Hall', 'BookNook'], 'entertainment');
    many(int(0, 2), card, 4, 30, ['Pharmacy Plus'], 'pharmacy');
    many(1, card, 18, 35, ['Barber & Co'], 'personal');
    many(r() < 0.3 ? 1 : 0, checking, 45, 120, ['Dr. Rivera Clinic', 'Smile Dental'], 'health');
    many(int(0, 2), card, 15, 180, ['HomeFix', 'Nordic Home'], 'home');
    if (mo % 4 === 1) add(day(), 'acc-checking', -between(120, 380), 'AutoCare Garage', 'car', 'Service');
    many(mo === 11 ? int(3, 5) : int(0, 1), card, 20, 90, ['MegaMart', 'BookNook', 'Style & Co'], 'gifts', () => (mo === 11 ? 'Christmas presents #gift' : 'Birthday present #gift'));

    // Holidays: a summer trip in August (flights booked in June) and a spring weekend away in April.
    if (mo === 5) add(15, 'acc-card', -428, 'SkyWay Airlines', 'travel', 'Flights for the summer trip #holiday');
    if (mo === 7) {
      add(4, 'acc-card', -960, 'Hotel Aurora', 'travel', 'Hotel, 6 nights #holiday');
      add(4, 'acc-card', -214, 'RentaRide', 'travel', 'Car rental #holiday');
      add(6, 'acc-card', -36, 'City Museum', 'entertainment', 'Museum tickets #holiday');
      many(int(5, 8), card, 25, 85, ['Bistro 21', 'The Green Fork', 'Sushi Zen'], 'restaurants', () => 'Dinner out #holiday');
    }
    if (mo === 3) {
      add(11, 'acc-card', -186, 'Hotel Aurora', 'travel', 'Weekend away #holiday');
      add(12, 'acc-card', -64, 'The Green Fork', 'restaurants', 'Dinner #holiday');
    }

    // Two split transactions: each parent's children carry the categories (as the live loader expands them).
    if (back === 2) {
      const d = 18;
      add(d, 'acc-card', -52.9, 'MegaMart', 'shopping', 'Headphones', { id: `tx-${key}-split1/a` });
      add(d, 'acc-card', -33.5, 'MegaMart', 'gifts', 'Board game for Leo #gift', { id: `tx-${key}-split1/b` });
    }
    if (back === 1) {
      const d = 9;
      add(d, 'acc-checking', -96.8, 'FreshMart', 'groceries', 'Big shop', { id: `tx-${key}-split2/a` });
      add(d, 'acc-checking', -45.5, 'FreshMart', 'home', 'Cleaning supplies', { id: `tx-${key}-split2/b` });
    }

    // Transfers: the card is paid off from checking, and some months 500 goes to savings.
    const cardSpend = -month.filter(t => t.account === 'acc-card' && t.date <= `${key}-27`).reduce((a, t) => a + t.amount, 0) / 100;
    transfer(28, 'acc-checking', 'acc-card', Math.round(cardSpend * 100) / 100, 'Card payment');
    if (mo % 3 === 0) transfer(3, 'acc-checking', 'acc-savings', 500, 'To savings');

    rawTrans.push(...month.filter(t => +t.date.slice(8) <= lastDay));
  }

  const accountPayees = ACCOUNTS.map(a => ({ id: xfer(a.id), name: a.name, transfer_acct: a.id }));
  return {
    accounts: ACCOUNTS,
    categories: CATEGORIES.map(([id, name, group]) => ({ id: `c-${id}`, name, group_id: group, is_income: group === 'income' })),
    groups: GROUPS.map(([id, name]) => ({ id, name })),
    payees: [...PAYEES.map(name => ({ id: pid(name), name })), ...accountPayees],
    rawTrans: rawTrans.map(t => ({ ...t, category: t.category ? `c-${t.category}` : null })),
    updated: now.toISOString(),
  };
}
