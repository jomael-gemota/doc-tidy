// Text embeddings via OpenAI, used to index corrections for retrieval.
//
// Kept dependency-free (uses global fetch, Node 20+) so the server doesn't pull
// in the OpenAI SDK. Returns null when no key is configured or the call fails,
// so callers degrade gracefully (a correction is still stored, just without an
// embedding, and won't be retrievable until re-embedded).

const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL ?? 'text-embedding-3-small'

export async function embedText(text: string): Promise<number[] | null> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    console.warn('[embeddings] OPENAI_API_KEY not set — skipping embedding')
    return null
  }

  const input = text.slice(0, 8000) // stay well under model token limits
  try {
    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model: EMBEDDING_MODEL, input }),
    })

    if (!res.ok) {
      console.error('[embeddings] OpenAI returned', res.status, await res.text())
      return null
    }

    const data = (await res.json()) as { data?: Array<{ embedding: number[] }> }
    return data.data?.[0]?.embedding ?? null
  } catch (err) {
    console.error('[embeddings] request failed:', err)
    return null
  }
}
