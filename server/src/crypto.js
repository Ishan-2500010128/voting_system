import crypto from 'crypto';

const key = () => {
  const k = Buffer.from(process.env.BALLOT_KEY || '', 'hex');
  if (k.length !== 32) throw new Error('BALLOT_KEY must be 64 hex characters (32 bytes).');
  return k;
};

export function encrypt(text) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const ct = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  return {
    ct: ct.toString('base64'),
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
  };
}

export function decrypt({ ct, iv, tag }) {
  const d = crypto.createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64'));
  d.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([d.update(Buffer.from(ct, 'base64')), d.final()]).toString('utf8');
}

export const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

export const newReceipt = () =>
  crypto.randomBytes(8).toString('hex').toUpperCase().match(/.{4}/g).join('-');
