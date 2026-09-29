import { createHmac, timingSafeEqual } from 'node:crypto';

const secret = () => import.meta.env.ADMIN_PASSWORD ?? '';
const hmac = (p: string) => createHmac('sha256', secret()).update(p).digest('hex');

/** Token firmado con caducidad de 7 días. La cookie ya no puede falsificarse. */
export const signSession = () => {
  const exp = String(Date.now() + 7 * 24 * 60 * 60 * 1000);
  return `${exp}.${hmac(exp)}`;
};

export const isValidSession = (token?: string) => {
  if (!token || !secret()) return false;
  const [exp, sig] = token.split('.');
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  const good = hmac(exp);
  return sig.length === good.length && timingSafeEqual(Buffer.from(sig), Buffer.from(good));
};
