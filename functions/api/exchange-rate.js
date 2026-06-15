import handler from '../../api/exchange-rate.js';

export function onRequest(context) {
  return handler(context.request, context.env);
}
