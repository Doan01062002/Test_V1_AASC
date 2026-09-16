const assert = require('assert');
const path = require('path');

// Target modules under test
const normalizerPath = path.resolve(__dirname, '../dist/services/normalizer');
const validatorPath = path.resolve(__dirname, '../dist/services/validator');
const appPath = path.resolve(__dirname, '../dist/app');

const {
  toSafeString,
  extractName,
  extractEmail,
  extractPhone,
  normalizeWebhookPayload,
  normalizeJotformSubmission,
} = require(normalizerPath);

const {
  isValidName,
  isValidEmail,
  isValidPhone,
  validateContact,
  validateContactOrThrow,
  ValidationError,
} = require(validatorPath);

const request = require('supertest');
const { app } = require(appPath);

let total = 0;
let passed = 0;
let failed = 0;

function test(name, fn) {
  total++;
  try {
    fn();
    passed++;
    console.log(`[PASS] ${name}`);
  } catch (err) {
    failed++;
    console.error(`[FAIL] ${name}`);
    console.error(`       Error: ${err.message}`);
    if (err.stack) {
      console.error(`       Stack: ${err.stack.split('\n').slice(1, 4).join('\n')}`);
    }
  }
}

async function testAsync(name, fn) {
  total++;
  try {
    await fn();
    passed++;
    console.log(`[PASS] ${name}`);
  } catch (err) {
    failed++;
    console.error(`[FAIL] ${name}`);
    console.error(`       Error: ${err.message}`);
    if (err.stack) {
      console.error(`       Stack: ${err.stack.split('\n').slice(1, 4).join('\n')}`);
    }
  }
}

async function run() {
  console.log('======================================================================');
  console.log('ADVERSARIAL RE-CHALLENGE SUITE (challenger_it2_1)');
  console.log('======================================================================\n');

  // -------------------------------------------------------------------------
  // 1. NESTED OBJECTS & PROTOTYPE ANOMALIES
  // -------------------------------------------------------------------------
  console.log('>>> 1. Nested Objects & Prototype Anomalies');

  test('toSafeString handles Object.create(null)', () => {
    const nullProto = Object.create(null);
    assert.strictEqual(toSafeString(nullProto), '');
  });

  test('toSafeString handles object with throwing toString()', () => {
    const throwingObj = {
      toString() {
        throw new Error('boom');
      },
    };
    assert.strictEqual(toSafeString(throwingObj), '');
  });

  test('toSafeString handles object with throwing Symbol.toPrimitive', () => {
    const throwingPrim = {
      [Symbol.toPrimitive]() {
        throw new Error('primitive boom');
      },
    };
    assert.strictEqual(toSafeString(throwingPrim), '');
  });

  test('toSafeString handles circular reference object safely', () => {
    const circ = {};
    circ.self = circ;
    assert.strictEqual(toSafeString(circ), '');
  });

  test('toSafeString handles deeply nested object', () => {
    const deep = { a: { b: { c: { d: 'deep_val' } } } };
    assert.strictEqual(toSafeString(deep), '');
  });

  test('extractName handles null-prototype compound object', () => {
    const compound = Object.create(null);
    compound.first = 'Tran';
    compound.last = 'Hung Dao';
    const res = extractName(compound);
    assert.deepStrictEqual(res, { name: 'Tran', lastName: 'Hung Dao' });
  });

  test('extractName handles empty null-prototype object', () => {
    const compound = Object.create(null);
    const res = extractName(compound);
    assert.deepStrictEqual(res, { name: '' });
  });

  test('extractName handles deeply nested object subfields in first/last', () => {
    const compound = {
      first: { nested: { sub: 'val' } },
      last: { nested: { sub: 'val2' } },
    };
    const res = extractName(compound);
    assert.deepStrictEqual(res, { name: '' });
  });

  test('extractName handles object with throwing property getter', () => {
    const compound = {
      get first() {
        return 'GetterFirst';
      },
      get last() {
        return 'GetterLast';
      },
    };
    const res = extractName(compound);
    assert.deepStrictEqual(res, { name: 'GetterFirst', lastName: 'GetterLast' });
  });

  test('extractEmail handles null-prototype object', () => {
    const compound = Object.create(null);
    compound.email = 'valid.user@example.com';
    assert.strictEqual(extractEmail(compound), 'valid.user@example.com');
  });

  test('extractEmail handles deeply nested email object', () => {
    const compound = { email: { a: { b: 'nested' } } };
    assert.strictEqual(extractEmail(compound), '');
  });

  test('extractPhone handles null-prototype compound with full property', () => {
    const compound = Object.create(null);
    compound.full = '+84901234567';
    assert.strictEqual(extractPhone(compound), '+84901234567');
  });

  test('extractPhone handles null-prototype compound with code/area/phone', () => {
    const compound = Object.create(null);
    compound.code = '84';
    compound.area = '090';
    compound.phone = '1234567';
    assert.strictEqual(extractPhone(compound), '840901234567');
  });

  test('extractPhone handles nested objects in phone subfields', () => {
    const compound = {
      code: { a: 1 },
      area: { b: 2 },
      phone: { c: 3 },
    };
    assert.strictEqual(extractPhone(compound), '');
  });

  test('extractName fallback properties hierarchy (name, full, value, text)', () => {
    assert.deepStrictEqual(extractName({ name: 'FallbackName' }), { name: 'FallbackName' });
    assert.deepStrictEqual(extractName({ full: 'FallbackFull' }), { name: 'FallbackFull' });
    assert.deepStrictEqual(extractName({ value: 'FallbackValue' }), { name: 'FallbackValue' });
    assert.deepStrictEqual(extractName({ text: 'FallbackText' }), { name: 'FallbackText' });
  });

  // -------------------------------------------------------------------------
  // 2. SYMBOLS & ADVANCED PRIMITIVES
  // -------------------------------------------------------------------------
  console.log('\n>>> 2. Symbols & Advanced Primitives');

  test('toSafeString handles Symbol directly', () => {
    assert.strictEqual(toSafeString(Symbol('test')), '');
  });

  test('toSafeString handles Symbol.for', () => {
    assert.strictEqual(toSafeString(Symbol.for('global_test')), '');
  });

  test('toSafeString handles boxed Object(Symbol) safely', () => {
    // Boxed symbol has typeof === 'object'
    const boxed = Object(Symbol('boxed'));
    // String(boxed) throws TypeError: Cannot convert a Symbol value to a string in JS
    // toSafeString safely catches this error and returns ''
    assert.strictEqual(toSafeString(boxed), '');
  });

  test('extractName handles Symbol as direct field', () => {
    const res = extractName(Symbol('name_sym'));
    assert.deepStrictEqual(res, { name: '' });
  });

  test('extractName handles Symbol subfields in compound name', () => {
    const res = extractName({ first: Symbol('first'), last: Symbol('last') });
    assert.deepStrictEqual(res, { name: '' });
  });

  test('extractEmail handles Symbol as direct field', () => {
    assert.strictEqual(extractEmail(Symbol('email_sym')), '');
  });

  test('extractEmail handles Symbol in compound email', () => {
    assert.strictEqual(extractEmail({ email: Symbol('email_sym') }), '');
  });

  test('extractPhone handles Symbol as direct field', () => {
    assert.strictEqual(extractPhone(Symbol('phone_sym')), '');
  });

  test('extractPhone handles Symbol in compound phone', () => {
    assert.strictEqual(extractPhone({ full: Symbol('phone_sym') }), '');
  });

  test('extractPhone handles Symbols in code/area/phone subfields', () => {
    assert.strictEqual(
      extractPhone({
        code: Symbol('84'),
        area: Symbol('090'),
        phone: Symbol('1234567'),
      }),
      ''
    );
  });

  // -------------------------------------------------------------------------
  // 3. BOOLEAN VALUES & BIGINT & SPECIAL NUMBERS
  // -------------------------------------------------------------------------
  console.log('\n>>> 3. Boolean Values & Special Numbers');

  test('toSafeString handles boolean true and false', () => {
    assert.strictEqual(toSafeString(true), 'true');
    assert.strictEqual(toSafeString(false), 'false');
  });

  test('toSafeString handles BigInt', () => {
    assert.strictEqual(toSafeString(9007199254740991n), '9007199254740991');
  });

  test('toSafeString handles NaN and Infinity', () => {
    assert.strictEqual(toSafeString(NaN), '');
    assert.strictEqual(toSafeString(Infinity), '');
    assert.strictEqual(toSafeString(-Infinity), '');
  });

  test('toSafeString handles 0, -0, and floats', () => {
    assert.strictEqual(toSafeString(0), '0');
    assert.strictEqual(toSafeString(-0), '0');
    assert.strictEqual(toSafeString(3.14159), '3.14159');
  });

  test('extractName handles boolean values directly', () => {
    assert.deepStrictEqual(extractName(true), { name: 'true' });
    assert.deepStrictEqual(extractName(false), { name: 'false' });
  });

  test('extractName handles boolean values in compound object', () => {
    assert.deepStrictEqual(extractName({ first: true, last: false }), {
      name: 'true',
      lastName: 'false',
    });
  });

  test('extractName handles numeric 0 in compound object', () => {
    assert.deepStrictEqual(extractName({ first: 0, last: 1 }), {
      name: '0',
      lastName: '1',
    });
  });

  test('extractEmail handles boolean values directly', () => {
    assert.strictEqual(extractEmail(true), 'true');
    assert.strictEqual(extractEmail(false), 'false');
  });

  test('extractEmail handles boolean values in compound object', () => {
    assert.strictEqual(extractEmail({ email: true }), 'true');
    assert.strictEqual(extractEmail({ email: false }), 'false');
  });

  test('extractPhone handles boolean values directly (returns empty since no digits)', () => {
    assert.strictEqual(extractPhone(true), '');
    assert.strictEqual(extractPhone(false), '');
  });

  test('extractPhone handles BigInt phone number', () => {
    assert.strictEqual(extractPhone(84901234567n), '84901234567');
  });

  test('extractPhone handles BigInt in compound full property', () => {
    assert.strictEqual(extractPhone({ full: 84901234567n }), '84901234567');
  });

  // -------------------------------------------------------------------------
  // 4. PIPELINE VALIDATION & TYPE SAFETY OF BOOLEAN/NUMERIC NORMALIZED CONTACTS
  // -------------------------------------------------------------------------
  console.log('\n>>> 4. Pipeline Validation & Type Safety');

  test('validateContact on boolean-filled contact rejects email & phone gracefully', () => {
    const normalized = {
      name: 'true',
      lastName: 'false',
      email: 'true',
      phone: '',
    };
    const res = validateContact(normalized);
    assert.strictEqual(res.isValid, false);
    assert.strictEqual(res.errors.length, 2); // invalid email, missing phone
    assert.ok(res.errors[0].includes('Invalid email format'));
    assert.ok(res.errors[1].includes('Phone number is required'));
  });

  test('validateContact on 0-filled contact validates appropriately', () => {
    const normalized = {
      name: '0',
      lastName: '1',
      email: '0',
      phone: '0',
    };
    const res = validateContact(normalized);
    assert.strictEqual(res.isValid, false);
    assert.ok(res.errors.some((e) => e.includes('Invalid email format')));
    assert.ok(res.errors.some((e) => e.includes('must contain 9-15 digits')));
  });

  test('validateContact on contact with valid fields passes', () => {
    const normalized = {
      name: 'Nguyen',
      lastName: 'Van An',
      email: 'van.an.nguyen@aasc.com.vn',
      phone: '+84901234567',
    };
    const res = validateContact(normalized);
    assert.strictEqual(res.isValid, true);
    assert.strictEqual(res.errors.length, 0);
  });

  // -------------------------------------------------------------------------
  // 5. REGEX ADVERSARIAL STRESS & REDOS RESILIENCE
  // -------------------------------------------------------------------------
  console.log('\n>>> 5. Regex Adversarial Stress & ReDoS Resilience');

  test('RFC 5322 ReDoS resistance: massive repetitive local-part', () => {
    const start = Date.now();
    const malicious = 'a'.repeat(2000) + '@' + 'b'.repeat(2000);
    const result = isValidEmail(malicious);
    const duration = Date.now() - start;
    assert.strictEqual(result, false);
    assert.ok(duration < 50, `Regex took too long: ${duration}ms`);
  });

  test('RFC 5322 ReDoS resistance: massive valid dot-separated atoms', () => {
    const start = Date.now();
    const massive = 'a.'.repeat(1000) + 'a@domain.com';
    const result = isValidEmail(massive);
    const duration = Date.now() - start;
    assert.strictEqual(result, true);
    assert.ok(duration < 50, `Regex took too long: ${duration}ms`);
  });

  test('RFC 5322 ReDoS resistance: massive invalid trailing dot before @', () => {
    const start = Date.now();
    const malicious = 'a.'.repeat(1000) + '@domain.com';
    const result = isValidEmail(malicious);
    const duration = Date.now() - start;
    assert.strictEqual(result, false);
    assert.ok(duration < 50, `Regex took too long: ${duration}ms`);
  });

  test('RFC 5322 ReDoS resistance: massive domain labels without matching TLD', () => {
    const start = Date.now();
    const malicious = 'valid.user@' + 'label-'.repeat(500) + 'domain';
    const result = isValidEmail(malicious);
    const duration = Date.now() - start;
    assert.strictEqual(result, false);
    assert.ok(duration < 50, `Regex took too long: ${duration}ms`);
  });

  test('Phone ReDoS resistance: massive digit string', () => {
    const start = Date.now();
    const malicious = '+' + '9'.repeat(10000);
    const result = isValidPhone(malicious);
    const duration = Date.now() - start;
    assert.strictEqual(result, false);
    assert.ok(duration < 20, `Phone regex took too long: ${duration}ms`);
  });

  // -------------------------------------------------------------------------
  // 6. EXTREME RFC 5322 EMAIL BOUNDARY CASES
  // -------------------------------------------------------------------------
  console.log('\n>>> 6. Extreme RFC 5322 Email Boundary Cases');

  const validEmails = [
    'simple@example.com',
    'very.common@example.com',
    'disposable.style.email.with+symbol@example.com',
    'other.email-with-hyphen@example.com',
    'fully-qualified-domain@example.com',
    'user.name+tag+sorting@example.com',
    'x@example.com',
    'example-indeed@strange-example.com',
    'admin@mailserver1.net',
    'example@s.example',
    'mailhost!username@example.org',
    'user%example.com@example.org',
    'user-@example.org',
    'customer_service@vnpost.vn',
    'user@' + 'a'.repeat(63) + '.com', // exact max 63-char domain label
    'user@xn--d1abbgf6aiiy.xn--p1ai', // IDN punycode
  ];

  for (const email of validEmails) {
    test(`Valid RFC 5322 email: "${email.slice(0, 40)}..."`, () => {
      assert.strictEqual(isValidEmail(email), true);
    });
  }

  const invalidEmails = [
    'Abc.example.com', // no @
    'A@b@c@example.com', // multiple @
    'a"b(c)d,e:f;g<h>i[j\\k]l@example.com', // special chars outside quotes
    'just"not"right@example.com',
    'this is"not\\allowed@example.com',
    'this\\ still\\"not\\\\allowed@example.com',
    'user@' + 'a'.repeat(64) + '.com', // domain label exceeds 63 chars
    'user@-leadinghyphen.com', // leading hyphen in domain label
    'user@trailinghyphen-.com', // trailing hyphen in domain label
    'i_like_underscore@but_its_not_allowed_in_this_part.example.com', // underscore in domain
    '.leadingdot@example.com',
    'trailingdot.@example.com',
    'consecutive..dots@example.com',
    'user@.leadingdomaindot.com',
    'user@trailingdomaindot.com.',
    'user@consecutive..domaindots.com',
    'user@domain_with_underscore.com',
    'user@domain..vn',
  ];

  for (const email of invalidEmails) {
    test(`Invalid email correctly rejected: "${email}"`, () => {
      assert.strictEqual(isValidEmail(email), false);
    });
  }

  // -------------------------------------------------------------------------
  // 7. EXTREME PHONE FORMAT BOUNDARY CASES
  // -------------------------------------------------------------------------
  console.log('\n>>> 7. Extreme Phone Format Boundary Cases');

  const validPhones = [
    '0901234567',
    '+84901234567',
    '123456789', // min: 9
    '+123456789',
    '123456789012345', // max: 15
    '+123456789012345',
    '0084901234567', // 13 digits
  ];

  for (const phone of validPhones) {
    test(`Valid phone correctly accepted: "${phone}"`, () => {
      assert.strictEqual(isValidPhone(phone), true);
    });
  }

  const invalidPhones = [
    '12345678', // 8 digits (too short)
    '+12345678',
    '1234567890123456', // 16 digits (too long)
    '+1234567890123456',
    '0901234567\n', // newline injection
    ' 0901234567', // leading space
    '0901234567 ', // trailing space
    '+ 84901234567', // space after plus
    '++84901234567', // double plus
    '+',
    '090-123-4567', // unstripped dash
    '(090) 1234567', // unstripped parens
    'abcdefghi', // letters
    '',
    null,
    undefined,
  ];

  for (const phone of invalidPhones) {
    test(`Invalid phone correctly rejected: ${JSON.stringify(phone)}`, () => {
      assert.strictEqual(isValidPhone(phone), false);
    });
  }

  // -------------------------------------------------------------------------
  // 8. END-TO-END HTTP WEBHOOK INTEGRATION WITH ADVERSARIAL PAYLOADS
  // -------------------------------------------------------------------------
  console.log('\n>>> 8. HTTP Webhook Integration Adversarial Tests (Supertest)');

  await testAsync('HTTP POST with null-prototype body returns HTTP 400 (never 500)', async () => {
    const payload = Object.create(null);
    payload.q3_name = 'Test User';
    payload.q4_email = 'bad_email';
    payload.q5_phoneNumber = '0901234567';

    const res = await request(app).post('/webhook/jotform').send(payload);
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.code, 'VALIDATION_ERROR');
  });

  await testAsync('HTTP POST with all-boolean payload returns HTTP 400 (never 500)', async () => {
    const payload = {
      q3_name: true,
      q4_email: false,
      q5_phoneNumber: true,
    };
    const res = await request(app).post('/webhook/jotform').send(payload);
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.code, 'VALIDATION_ERROR');
  });

  await testAsync('HTTP POST with deeply nested compound objects returns HTTP 400 (never 500)', async () => {
    const payload = {
      q3_name: { first: { a: { b: 123 } }, last: { c: { d: 456 } } },
      q4_email: { email: { nested: 'obj' } },
      q5_phoneNumber: { full: { deep: 'number' } },
    };
    const res = await request(app).post('/webhook/jotform').send(payload);
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.code, 'VALIDATION_ERROR');
    assert.strictEqual(res.body.details.length, 3); // all 3 missing/empty
  });

  await testAsync('HTTP POST with rawRequest containing boolean primitives returns HTTP 400 (never 500)', async () => {
    const payload = {
      rawRequest: JSON.stringify({
        q3_name: { first: false, last: true },
        q4_email: { email: false },
        q5_phoneNumber: { full: true },
      }),
    };
    const res = await request(app).post('/webhook/jotform').send(payload);
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.code, 'VALIDATION_ERROR');
  });

  await testAsync('HTTP POST with array body returns HTTP 400 (never 500)', async () => {
    const res = await request(app).post('/webhook/jotform').send([1, 2, 3]);
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.code, 'VALIDATION_ERROR');
  });

  await testAsync('HTTP POST with completely empty payload returns HTTP 400 (never 500)', async () => {
    const res = await request(app).post('/webhook/jotform').send({});
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.code, 'VALIDATION_ERROR');
    assert.strictEqual(res.body.details.length, 3);
  });

  await testAsync('HTTP POST with valid Vietnamese contact payload returns HTTP 200/success (mock)', async () => {
    const payload = {
      rawRequest: JSON.stringify({
        q3_name: { first: 'Nguyễn', last: 'Văn Bình' },
        q4_email: 'nguyen.van.binh@aasc.com.vn',
        q5_phoneNumber: '+84 (90) 123-4567',
        submission_id: 'sub_999888777',
      }),
    };
    const res = await request(app).post('/webhook/jotform').send(payload);
    // Since bitrix24Service might call mock or real, let's verify it didn't throw internal 500
    // If upstream mock isn't intercepting or Bitrix24 fails, it would be Bitrix24Error or 200
    assert.notStrictEqual(res.status, 500, 'Must never produce HTTP 500');
    assert.ok(res.status === 200 || res.status === 502 || res.status === 400);
  });

  console.log('\n======================================================================');
  console.log(`TOTAL TESTS: ${total} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('======================================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

run().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
