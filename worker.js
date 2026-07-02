/**
 * LEXIS — Cloudflare Worker Translation Proxy
 * Deploy this to Cloudflare Workers (free tier)
 * Set secret: ANTHROPIC_API_KEY = your key
 */

export default {
  async fetch(request, env) {
    // Allow CORS from anywhere (your app)
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    try {
      const { text, from, to } = await request.json();
      if (!text || !to) {
        return new Response(JSON.stringify({ error: 'Missing text or to' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 256,
          messages: [{
            role: 'user',
            content: `Translate "${text}" from ${from} to ${to}. Reply with ONLY the translated text, nothing else.`
          }]
        })
      });

      const data = await response.json();
      const translated = data.content?.[0]?.text?.trim() || '';

      return new Response(JSON.stringify({ translated }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }
};
