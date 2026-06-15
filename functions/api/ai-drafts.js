import handler from '../../api/ai-drafts.js';

export function onRequest(context) {
  return handler(context.request, context.env);
}
