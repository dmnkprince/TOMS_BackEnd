import crypto from 'crypto';

/**
 * Generates a unique incident reference number.
 * Format: TOMS-YYYYMMDD-XXXX (e.g. TOMS-20261112-9A4B)
 */
export const generateReferenceNumber = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const randomSuffix = crypto.randomBytes(3).toString('hex').toUpperCase();

  return `TOMS-${year}${month}${day}-${randomSuffix}`;
};
