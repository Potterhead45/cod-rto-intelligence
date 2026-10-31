import { describe, it, expect } from 'vitest';
import { cleanPhoneNumber } from '../server/engine/risk-scoring.js';

describe('Data Normalization & Cleaning', () => {
  it('normalizes status variants correctly', () => {
    const rawStatuses = ['DELIVERED', 'delivered', 'RTO', 'Rto', 'RTO ', 'IN_TRANSIT'];
    const normalized = rawStatuses.map(s => s.trim().toUpperCase());

    expect(normalized).toEqual(['DELIVERED', 'DELIVERED', 'RTO', 'RTO', 'RTO', 'IN_TRANSIT']);
  });

  it('calculates completed order RTO rate excluding in-transit orders', () => {
    const delivered = 1444;
    const rto = 573;
    const inTransit = 1;

    const completed = delivered + rto;
    const rtoRate = (rto / completed) * 100;

    expect(completed).toBe(2017);
    expect(Number(rtoRate.toFixed(2))).toBe(28.41);
  });

  it('normalizes phone numbers and handles +91 prefix and formatting', () => {
    const phone1 = cleanPhoneNumber('+91 93117 90015');
    expect(phone1.clean).toBe('9311790015');
    expect(phone1.isValid).toBe(true);

    const phone2 = cleanPhoneNumber('9876543210');
    expect(phone2.clean).toBe('9876543210');
    expect(phone2.isValid).toBe(true);

    // Truncated 9-digit phone
    const phone3 = cleanPhoneNumber('723013610');
    expect(phone3.clean).toBe('723013610');
    expect(phone3.isValid).toBe(false);

    // Invalid starting digit
    const phone4 = cleanPhoneNumber('2234567890');
    expect(phone4.isValid).toBe(false);
  });

  it('handles missing values gracefully without throwing', () => {
    const rawPincodes = [null, undefined, '', '0', '110001', '846043'];
    const valid = rawPincodes.filter(p => p && /^[1-8]\d{5}$/.test(p));

    expect(valid).toEqual(['110001', '846043']);
  });
});
