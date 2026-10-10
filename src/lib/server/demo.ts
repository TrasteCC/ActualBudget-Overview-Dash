import type { RawTx, Snapshot } from './overview';

// DEMO=1: a made-up budget for screenshots and the public demo. Nothing here is real: the shape
// (categories, how often, how much, when) follows a typical household spending about 2,000 EUR a
// month, and every payee is invented. 14 months ending today; each month has its own fixed seed, so
// a past month always looks the same.

function rng(seed: number) { // mulberry32
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const GROUPS: [string, string[]][] = [
  ['Shopping', ['Groceries', 'Home', 'Gifts', 'Electronics', 'Kids & pets', 'Clothing', 'Books & apps', 'Sports gear', 'Other shopping']],
  ['Leisure & transport', ['Restaurants', 'Hotels', 'Fuel', 'Travel', 'Car rental', 'Transport', 'Hobbies', 'Charity', 'Other leisure', 'Lottery', 'Parking & tolls']],
  ['Housing & vehicle', ['Rent & parking', 'Community fees', 'Cleaning service', 'Car maintenance', 'Home maintenance']],
  ['Utilities', ['Online services', 'Electricity', 'Internet', 'Water', 'Waste collection', 'TV']],
  ['Health, learning & sport', ['Health', 'Pharmacy', 'Courses', 'Sports', 'Personal care']],
  ['Other', ['Family', 'Cash', 'Other expenses']],
  ['Insurance', ['Car insurance', 'Life insurance']],
  ['Banks & taxes', ['Taxes', 'Bank fees']],
  ['Income', ['Salary', 'Interest & cashback', 'Tax refund', 'Other income', 'Second-hand sales']],
];

const ACCOUNTS = [
  { id: 'acc-salary', name: 'Salary account', offbudget: false, closed: false },
  { id: 'acc-everyday', name: 'Everyday account', offbudget: false, closed: false },
  { id: 'acc-savings', name: 'Savings', offbudget: true, closed: false },
];

// Variable spending: [category, count per month ([min, max]; below 1 = probability of one), amount range, payees]
const SPEND: [string, [number, number] | number, [number, number], string[]][] = [
  ['Groceries', [10, 14], [2, 58], ['FreshMart', 'Valley Grocer', 'Daily Market', 'Corner Bakery', 'Green Basket']],
  ['Restaurants', [13, 18], [1.5, 34], ['Bistro 21', 'Pizza Nova', 'Taco Loco', 'The Green Fork', 'Café Luna', 'Sweet Crumbs Bakery', 'Sushi Zen']],
  ['Home', [6, 9], [3, 55], ['ShopNow', 'Bazaar Direct', 'HomeBox', 'PayLater']],
  ['Fuel', [2, 3], [24, 42], ['QuickFuel']],
  ['Electronics', 0.35, [5, 40], ['Gadget Store', 'PC Parts Direct']],
  ['Clothing', [1, 2], [8, 70], ['Style & Co', 'Urban Threads']],
  ['Online services', [9, 12], [2, 45], ['CloudDrive', 'WebHost Pro', 'AI Assistant Pro', 'CodeHub', 'VoiceAPI', 'ChatBot Plus', 'Domain Nest']],
  ['Health', 0.55, [30, 62], ['City Health Clinic']],
  ['Pharmacy', [0, 2], [4, 45], ['Pharmacy Plus']],
  ['Kids & pets', 0.5, [6, 20], ['Pet Corner']],
  ['Kids & pets', 0.25, [30, 60], ['Happy Paws Vet']],
  ['Car rental', 0.1, [33, 90], ['RentaRide']],
  ['Transport', 0.6, [3, 25], ['City Taxi', 'RideNow']],
  ['Travel', 0.1, [10, 60], ['RailOne']],
  ['Hotels', 0.35, [80, 160], ['StayAway Rentals']],
  ['Other expenses', 0.6, [2, 40], ['Parcel Express']],
  ['Sports', 0.4, [8, 80], ['Trail Runners Club', 'Race Tickets']],
  ['Other shopping', 0.5, [3, 45], ['Bargain Bin']],
  ['Taxes', 0.45, [5, 33], ['City Council']],
  ['Books & apps', [1, 2], [2, 16], ['BookNook', 'AppMarket']],
  ['Car maintenance', 0.3, [12, 45], ['AutoCare Garage']],
  ['Personal care', 0.8, [6, 16], ['Barber & Co']],
  ['Other leisure', 0.5, [1, 27], ['Spa & Relax', 'Cinema Royale']],
  ['Lottery', 0.4, [3, 11], ['Lucky Draw']],
  ['Parking & tolls', [1, 3], [0.3, 5], ['CityPark', 'Toll Road']],
  ['Sports gear', 0.2, [4, 13], ['Sport Outlet']],
  ['Home maintenance', 0.1, [12, 25], ['HomeFix']],
  ['Bank fees', 0.3, [0.5, 4], ['Bank']],
];

// Big one-offs paid from savings, by calendar month: [day, category, payee, amount, note]
const FROM_SAVINGS: Record<number, [number, string, string, number, string][]> = {
  1: [[14, 'Electronics', 'Gadget Store', 310, 'New laptop'], [22, 'Home', 'HomeBox', 140, 'Desk chair']],
  2: [[9, 'Home', 'Nordic Home', 220, 'Sofa'], [20, 'Gifts', 'GiftHub', 164, 'Wedding gift']],
  3: [[3, 'Community fees', 'Building community', 500, 'Roof repair levy'], [6, 'Electronics', 'PC Parts Direct', 150, 'Monitor'],
    [10, 'Home', 'HomeBox', 120, 'Bookshelf'], [15, 'Courses', 'Market School', 164, 'Weekend workshop'],
    [18, 'Electronics', 'Gadget Store', 95, 'Headphones'], [27, 'Online services', 'CloudDrive', 39, 'Yearly storage plan']],
  6: [[5, 'Hobbies', 'Music Store', 177, 'Digital piano'], [14, 'Electronics', 'Gadget Store', 180, 'Camera']],
  8: [[18, 'Electronics', 'Gadget Store', 45, 'Power bank']],
  9: [[7, 'Home', 'Nordic Home', 150, 'Bed frame'], [21, 'Electronics', 'PC Parts Direct', 80, 'Keyboard and mouse']],
};

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const cid = (name: string) => `c-${slug(name)}`;
const pid = (name: string) => `p-${slug(name)}`;
const xfer = (acc: string) => `p-transfer-${acc}`;

export function demoSnapshot(): Snapshot {
  const now = new Date();
  const rawTrans: RawTx[] = [];
  const payeeNames = new Set<string>();

  for (let back = 13; back >= 0; back--) {
    const first = new Date(now.getFullYear(), now.getMonth() - back, 1);
    const y = first.getFullYear();
    const cal = first.getMonth() + 1;
    const key = `${y}-${String(cal).padStart(2, '0')}`;
    const daysIn = new Date(y, cal, 0).getDate();
    const lastDay = back === 0 ? now.getDate() : daysIn;
    const r = rng(y * 12 + cal);
    const between = (lo: number, hi: number) => lo + r() * (hi - lo);
    const logu = (lo: number, hi: number) => lo * (hi / lo) ** r(); // most amounts small, a few large
    const int = (lo: number, hi: number) => Math.floor(between(lo, hi + 1));
    const pick = <T,>(a: T[]) => a[int(0, a.length - 1)];
    const day = () => int(1, daysIn);
    const acc = () => (r() < 0.64 ? 'acc-everyday' : 'acc-salary');
    let n = 0;
    const month: RawTx[] = [];

    const add = (d: number, account: string, eur: number, payee: string, category: string | null, notes = '', extra: Partial<RawTx> = {}) => {
      if (payee) payeeNames.add(payee);
      const t: RawTx = {
        id: `tx-${key}-${++n}`, date: `${key}-${String(Math.min(d, daysIn)).padStart(2, '0')}`, amount: Math.round(eur * 100),
        account, payee: payee ? pid(payee) : null, category: category ? cid(category) : null, notes, ...extra,
      };
      month.push(t);
      return t;
    };
    const transfer = (d: number, from: string, to: string, eur: number, notes: string) => {
      const a = add(d, from, -eur, '', null, notes, { payee: xfer(to) });
      const b = add(d, to, eur, '', null, notes, { payee: xfer(from) });
      a.transfer_id = b.id;
      b.transfer_id = a.id;
    };
    const spend = (count: [number, number] | number, category: string, [lo, hi]: [number, number], payees: string[], note = '', when: () => number = day) => {
      const times = Array.isArray(count) ? int(count[0], count[1]) : count >= 1 ? count : r() < count ? 1 : 0;
      for (let i = 0; i < times; i++) {
        const auto = r() < 0.22 ? '#auto' : '';
        add(when(), acc(), -logu(lo, hi), pick(payees), category, [note, auto].filter(Boolean).join(' '));
      }
    };

    if (back === 13) {
      add(1, 'acc-salary', 1800, '', null, 'Starting balance', { starting_balance_flag: true });
      add(1, 'acc-everyday', 350, '', null, 'Starting balance', { starting_balance_flag: true });
      add(1, 'acc-savings', 6500, '', null, 'Starting balance', { starting_balance_flag: true });
    }

    // Income: salary near the end of the month (a raise eight months ago), two extra pays, a yearly bonus.
    add(int(25, 29), 'acc-salary', (back > 8 ? 1590 : 1940) + between(-20, 20), 'Acme Corp', 'Salary', 'Monthly salary');
    if (cal === 6 || cal === 12) add(15, 'acc-salary', 680, 'Acme Corp', 'Salary', 'Extra pay');
    if (cal === 2) add(25, 'acc-salary', 5960, 'Acme Corp', 'Salary', 'Annual bonus');
    for (let i = int(1, 3); i > 0; i--) add(day(), 'acc-salary', between(0.2, 3), 'Bank', 'Interest & cashback', 'Interest');
    if (cal === 3 || cal === 9) add(2, 'acc-salary', 220, 'Bank', 'Interest & cashback', 'Cashback promotion');
    if (cal === 5) add(2, 'acc-salary', 553, 'Tax Agency', 'Tax refund', 'Income tax refund');
    if (r() < 0.15) add(day(), 'acc-everyday', between(50, 150), 'Peer transfer', 'Other income', 'Refund from a friend');
    if (cal === 7) add(28, 'acc-everyday', 11, 'Resale App', 'Second-hand sales', 'Old lamp');

    // Fixed bills
    add(1, 'acc-salary', -27, 'Parking Space Co', 'Rent & parking', 'Garage space');
    if (cal % 3 !== 0) add(1, 'acc-salary', -137, 'Sunny Flats', 'Rent & parking', 'Room rent');
    add(1, 'acc-salary', -21, 'FiberNet', 'Internet', 'Fibre');
    if (r() < 0.8) add(1, 'acc-salary', -25, 'CleanHome Services', 'Cleaning service', 'Cleaning');
    add(2, 'acc-salary', -16, 'Building community', 'Community fees', 'Monthly fee');
    add(2, 'acc-salary', -25.5, 'AutoShield Insurance', 'Car insurance', 'Monthly instalment');
    add(3, 'acc-salary', -6, 'Kind Hearts Fund', 'Charity', 'Monthly donation');
    add(5, 'acc-salary', -between(60, 80), 'Family', 'Family', 'Family support');
    add(13, 'acc-everyday', -8, 'Learning Club', 'Courses', 'Membership');
    add(17, 'acc-everyday', -5, 'ChartLab', 'Courses', 'Subscription');
    if (cal <= 8) add(17, 'acc-salary', -137, 'Market School', 'Courses', 'Course instalment');
    add(23, 'acc-everyday', -24, 'PetFood Box', 'Kids & pets', 'Dog food subscription');
    add(27, 'acc-salary', -between(21, 35), 'Bright Power', 'Electricity', 'Electricity #auto');
    if (cal % 2 === 0) {
      add(4, 'acc-salary', -12, 'AquaCity Water', 'Water', 'Water');
      add(4, 'acc-salary', -9, 'AquaCity Water', 'Waste collection', 'Waste collection');
    }
    if (cal === 4) add(9, 'acc-salary', -22, 'Vehicle Inspection', 'Car maintenance', 'Yearly inspection');
    if (cal === 5) add(5, 'acc-everyday', -49, 'StreamBox TV', 'TV', 'Yearly plan');
    if (cal === 11) add(20, 'acc-salary', -34, 'SafeLife Insurance', 'Life insurance', 'Yearly premium');
    add(daysIn, 'acc-savings', between(3, 6), 'Bank', null, 'Interest');

    // Everyday spending
    for (const [category, count, range, payees] of SPEND) spend(count, category, range, payees);
    spend(cal === 12 ? [6, 9] : [2, 4], 'Gifts', [3, 55], ['GiftHub', 'ShopNow', 'Toy Planet']);
    for (let i = int(1, 2); i > 0; i--) add(day(), 'acc-everyday', -10 * int(1, 2), 'ATM', 'Cash', 'Cash withdrawal');

    // A work week away most months (not in August): hotel, fuel, canteen, groceries, taxi.
    if (cal !== 8) {
      const start = int(3, 20);
      const wk = () => start + int(0, 4);
      spend([1, 2], 'Hotels', [38, 62], ['NightOwl Hotels', 'Harbor Inn'], '#work-week', wk);
      spend([1, 2], 'Fuel', [18, 32], ['Highway Fuel'], '#work-week', wk);
      spend([4, 8], 'Restaurants', [3, 9], ['Office Canteen'], '#work-week', wk);
      spend([1, 2], 'Groceries', [4, 12], ['Daily Market'], '#work-week', wk);
      spend(0.5, 'Transport', [6, 16], ['RideNow'], '#work-week', wk);
    }

    // Holidays: a mountain road trip in August, a city break in December (flights booked in October).
    if (cal === 8) {
      const d = () => int(3, 12);
      const tag = '#trip-dolomites';
      spend(4, 'Hotels', [55, 95], ['Alpine Lodge', 'Mountain Inn'], tag, d);
      spend(12, 'Restaurants', [6, 40], ['Trattoria Alpina', 'Rifugio Café', 'Pizzeria Monte'], tag, d);
      add(3, 'acc-everyday', -187, 'RentaRide', 'Car rental', `Car for the trip ${tag}`);
      spend(2, 'Cash', [30, 30], ['ATM'], tag, d);
      spend(3, 'Transport', [8, 35], ['Cable Car Co'], tag, d);
      spend(2, 'Gifts', [12, 40], ['Souvenir Shop'], tag, d);
      spend(2, 'Fuel', [22, 32], ['Highway Fuel'], tag, d);
      spend(2, 'Other leisure', [10, 25], ['Museum Ticket Office'], tag, d);
    }
    if (cal === 10) add(21, 'acc-everyday', -160, 'SkyWay Airlines', 'Travel', 'Flights #trip-vienna');
    if (cal === 11) spend(2, 'Travel', [20, 60], ['CityTours'], '#trip-vienna');
    if (cal === 12) {
      const d = () => int(4, 9);
      spend(2, 'Travel', [80, 100], ['Riverside Hotel'], '#trip-vienna', d);
      spend(28, 'Travel', [3, 45], ['Old Town Café', 'City Museum', 'Market Hall', 'Tram Tickets', 'Schnitzel Corner'], '#trip-vienna', d);
    }

    for (const [d, category, payee, eur, note] of FROM_SAVINGS[cal] || []) add(d, 'acc-salary', -eur, payee, category, `${note} #savings`);

    // Two split purchases: each parent's children carry the categories (as the live loader expands them).
    if (back === 2) {
      add(18, 'acc-everyday', -52.9, 'ShopNow', 'Electronics', 'Earbuds', { id: `tx-${key}-split1/a` });
      add(18, 'acc-everyday', -33.5, 'ShopNow', 'Gifts', 'Board game for a birthday', { id: `tx-${key}-split1/b` });
    }
    if (back === 1) {
      add(9, 'acc-everyday', -64.8, 'FreshMart', 'Groceries', 'Big shop', { id: `tx-${key}-split2/a` });
      add(9, 'acc-everyday', -21.5, 'FreshMart', 'Home', 'Cleaning supplies', { id: `tx-${key}-split2/b` });
    }

    // Transfers never count: a monthly top-up of the everyday account and, every other month, savings.
    transfer(28, 'acc-salary', 'acc-everyday', Math.round(between(700, 1000)), 'Monthly top-up');
    if (cal % 2 === 1) transfer(28, 'acc-salary', 'acc-savings', 300, 'To savings');

    rawTrans.push(...month.filter(t => +t.date.slice(8) <= lastDay));
  }

  return {
    accounts: ACCOUNTS,
    categories: GROUPS.flatMap(([group, cats]) => cats.map(name => ({ id: cid(name), name, group_id: slug(group), is_income: group === 'Income' }))),
    groups: GROUPS.map(([name]) => ({ id: slug(name), name })),
    payees: [...[...payeeNames].map(name => ({ id: pid(name), name })), ...ACCOUNTS.map(a => ({ id: xfer(a.id), name: a.name, transfer_acct: a.id }))],
    rawTrans,
    updated: now.toISOString(),
  };
}
