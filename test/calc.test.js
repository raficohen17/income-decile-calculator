'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const c = require('../app.js');

const near = (a, b, eps = 0.01) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);
const adult = (o) => Object.assign({ gender: 'f', mode: 'gross', salary: 0, pension: 6, extraPts: 0 }, o);
const household = (o) => Object.assign({
  couple: true, kids: { g0: 0, g12: 0, g3: 0, g45: 0, g617: 0 }, extra: 0,
  adults: [adult({}), adult({ gender: 'm' })], autoChild: true, childManual: 0,
  allowances: 0, pensionIncome: 0, capital: 0, other: 0, adjPct: 0, deductPension: false,
}, o);

test('standard persons scale, including 9+', () => {
  assert.equal(c.stdPersons(0), 0);
  assert.equal(c.stdPersons(1), 1.25);
  assert.equal(c.stdPersons(4), 3.2);
  near(c.stdPersons(10), 6.0);
});

test('tax brackets are cumulative', () => {
  assert.equal(c.taxBeforeCredits(0), 0);
  near(c.taxBeforeCredits(7010), 701);
  near(c.taxBeforeCredits(10060), 1128);
  near(c.taxBeforeCredits(70130), 701 + 427 + 1788 + 1891 + 7556.5 + 6316.8 + 5000);
});

test('NI and health: reduced rate to 7,703, full rate to ceiling 51,910', () => {
  const lo = c.niHealth(7703);
  near(lo.ni + lo.health, 7703 * 0.0427);
  const cap = c.niHealth(51910), over = c.niHealth(90000);
  near(cap.ni, over.ni);
  near(cap.health, over.health);
});

test('child allowance: 173, 219 x3, then 173', () => {
  assert.equal(c.childAllowance(0), 0);
  assert.equal(c.childAllowance(1), 173);
  assert.equal(c.childAllowance(4), 173 + 219 * 3);
  assert.equal(c.childAllowance(6), 173 + 219 * 3 + 173 * 2);
});

test('net mode passes the salary through untouched', () => {
  const p = c.calcPerson(adult({ mode: 'net', salary: 9000 }), false, {}, 0);
  assert.equal(p.net, 9000);
  assert.equal(p.pension, 0);
});

test('tax never goes negative', () => {
  const p = c.calcPerson(adult({ salary: 5000, extraPts: 10 }), false, {}, 0);
  assert.equal(p.tax, 0);
});

test('single parent gets mother points plus one', () => {
  const kids = { g0: 0, g12: 0, g3: 0, g45: 0, g617: 1 };
  const p = c.calcPerson(adult({ gender: 'm', salary: 20000 }), true, kids, 1);
  assert.equal(p.points, 2.25 + 2 + 1);
});

test('worked example: couple 14,000 + 11,000 gross, two kids -> decile 5', () => {
  const r = c.calcHousehold(household({ kids: { g0: 0, g12: 0, g3: 0, g45: 1, g617: 1 },
    adults: [adult({ salary: 14000 }), adult({ gender: 'm', salary: 11000 })] }));
  assert.equal(r.persons, 4);
  assert.equal(r.std, 3.2);
  assert.equal(r.people[0].points, 7.25);
  assert.equal(r.people[1].points, 5.75);
  near(r.people[0].net, 12904.73);
  near(r.people[1].net, 10269.84);
  assert.equal(r.child, 392);
  near(r.pc, 23566.57 / 3.2);
  assert.equal(r.decile, 5);
});

test('deductPension lowers total by employee contributions', () => {
  const base = household({ adults: [adult({ salary: 10000 }), adult({ gender: 'm', salary: 10000 })] });
  const a = c.calcHousehold(base), b = c.calcHousehold(Object.assign({}, base, { deductPension: true }));
  near(a.total - b.total, 1200);
});

test('decile boundaries: equal to upper bound stays in that decile; zero income is decile 1', () => {
  const single = (net) => household({ couple: false, adults: [adult({ mode: 'net', salary: net })] });
  assert.equal(c.calcHousehold(single(0)).decile, 1);
  assert.equal(c.calcHousehold(single(3158 * 1.25)).decile, 1);
  assert.equal(c.calcHousehold(single(3158 * 1.25 + 1)).decile, 2);
  assert.equal(c.calcHousehold(single(1e6)).decile, 10);
});

test('threshold adjustment scales all boundaries', () => {
  const r = c.calcHousehold(household({ adjPct: 10 }));
  near(r.thr[0], 3158 * 1.1);
});
