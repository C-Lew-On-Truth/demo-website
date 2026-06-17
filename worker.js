export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: { ...corsHeaders, 'Access-Control-Max-Age': '86400' } })
    }

    // POST /preview — save HTML, return id
    if (request.method === 'POST' && url.pathname === '/preview') {
      try {
        const { html } = await request.json()
        if (!html) return json({ error: 'Missing html' }, 400, corsHeaders)
        const id = crypto.randomUUID()
        await env.PREVIEWS.put(id, html)
        return json({ id }, 200, corsHeaders)
      } catch {
        return json({ error: 'Bad request' }, 400, corsHeaders)
      }
    }

    // GET /preview/:id — serve stored preview as a full HTML page
    if (request.method === 'GET' && url.pathname.startsWith('/preview/')) {
      const id = url.pathname.slice('/preview/'.length)
      if (!id) return new Response('Not found', { status: 404 })
      const html = await env.PREVIEWS.get(id)
      if (!html) return new Response('Preview not found or expired', { status: 404 })
      return new Response(html, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      })
    }

    // GET /?url=... — CORS proxy for fetching publisher pages
    if (request.method === 'GET' && url.searchParams.has('url')) {
      const target = url.searchParams.get('url')
      if (!target || !/^https?:\/\//i.test(target)) {
        return json({ error: 'Missing or invalid url parameter' }, 400, corsHeaders)
      }
      try {
        const response = await fetch(target, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
          },
          redirect: 'follow',
        })
        const contents = await response.text()
        return json({ contents, status: { http_code: response.status } }, 200, corsHeaders)
      } catch (e) {
        return json({ error: e.message }, 500, corsHeaders)
      }
    }

    return new Response('Not found', { status: 404, headers: corsHeaders })
  },
}

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  })
}
