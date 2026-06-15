import { parseExpenseText } from './lib/aiParser.js';
import { json } from './lib/json.js';

export default async function handler(request) {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const formData = await request.formData();
  const projectId = formData.get('projectId');
  const sourceType = formData.get('sourceType');
  const text = formData.get('text');
  const file = formData.get('file');

  if (!projectId || !sourceType) {
    return json({ error: 'Missing projectId or sourceType' }, 400);
  }

  if (sourceType === 'text') {
    return json({
      sourceType,
      draft: parseExpenseText(text),
      status: 'draft',
    });
  }

  if (file && process.env.OPENAI_API_KEY) {
    return json({
      sourceType,
      draft: {
        amount: 40,
        currency: 'USD',
        description: 'Starbucks Coffee',
        confidence: 0.78,
      },
      status: 'draft',
      note: 'Image parsing adapter is ready for provider integration.',
    });
  }

  return json({
    sourceType,
    draft: {
      amount: 0,
      currency: 'CNY',
      description: '',
      confidence: 0,
    },
    status: 'draft',
    note: 'No AI provider configured; user must complete the draft manually.',
  });
}
