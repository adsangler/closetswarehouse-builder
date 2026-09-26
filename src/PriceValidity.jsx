import { useEffect, useState } from 'react';
import { priceValidity } from './estimateValidity.js';

export default function PriceValidity({ estimate }) {
  const [now, setNow] = useState(Date.now);
  const quoteId = new URLSearchParams(window.location.search).get('quote') || '';
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  if (!estimate && !quoteId) return null;
  return <div className="mt-1 text-xs font-semibold text-stone-600">{priceValidity(estimate, quoteId, now)}</div>;
}
