import React, { useEffect, useState } from 'react';
import { fetchExchangeRate } from '../services/exchangeRateService';
import { formatMoney, fromMinorUnits } from '../domain/money';

const currencies = ['CNY', 'USD', 'AMD'];
const names = { CNY: '人民币', USD: '美元', AMD: '德拉姆' };

export function useDisplayCurrency(project) {
  const [currency, setCurrency] = useState('CNY');
  const [quote, setQuote] = useState(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const base = project.default_currency;
  useEffect(() => { setCurrency('CNY'); }, [project.id]);
  useEffect(() => {
    let active = true;
    setQuote(null);
    setError(false);
    if (currency === base) return;
    fetchExchangeRate({ fromCurrency: base, toCurrency: currency })
      .then((value) => { if (active) setQuote({ ...value, base, currency }); })
      .catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [base, currency, retry]);
  const rate = currency === base ? 1 : quote?.base === base && quote?.currency === currency ? quote.rate : null;
  return {
    currency, base, quote, error, rate,
    next: () => setCurrency((value) => currencies[(currencies.indexOf(value) + 1) % currencies.length]),
    retry: () => setRetry((value) => value + 1),
    format: (minor) => rate === null ? `${currency} …` : `${currency === base ? '' : '≈ '}${formatMoney(fromMinorUnits(minor) * rate, currency)}`,
  };
}

export function CurrencyAmount({ display, minor, children }) {
  return <button className="currency-amount" type="button" onClick={display.next}
    title={`${names[display.currency]} · 切换币种`} aria-label={`${names[display.currency]}，切换币种`}>
    {children ?? display.format(minor)}
  </button>;
}

export function CurrencyNote({ display }) {
  if (display.currency === display.base) return null;
  return <small className="currency-note" role="status">
    {display.error ? <button type="button" onClick={display.retry}>汇率获取失败，点击重试</button>
      : display.rate === null ? '正在获取汇率…'
        : <>参考汇率 · 结算币种 {display.base}{display.quote?.provider === 'open.er-api.com' && <> · <a href="https://www.exchangerate-api.com" target="_blank" rel="noreferrer" title="每日更新的参考汇率">ExchangeRate-API</a></>}</>}
  </small>;
}
