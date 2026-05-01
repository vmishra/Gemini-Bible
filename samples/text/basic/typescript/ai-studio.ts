/**
 * Basic text generation against the Gemini Developer API (AI Studio).
 *
 * Surface: AI Studio (api-key authenticated).
 * SDK:     @google/genai (unified TypeScript SDK).
 * Auth:    GEMINI_API_KEY in the environment.
 */

import { GoogleGenAI } from '@google/genai'

export async function main(opts: { model?: string; prompt?: string } = {}) {
  const model = opts.model ?? 'gemini-2.5-flash'
  const prompt =
    opts.prompt ??
    'Explain transformers to a senior backend engineer in three sentences.'

  const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })

  const response = await client.models.generateContent({
    model,
    contents: prompt,
  })

  const usage = response.usageMetadata
  return {
    text: response.text,
    model,
    usage: {
      promptTokens: usage?.promptTokenCount,
      outputTokens: usage?.candidatesTokenCount,
      thinkingTokens: usage?.thoughtsTokenCount,
      cachedTokens: usage?.cachedContentTokenCount,
      totalTokens: usage?.totalTokenCount,
    },
  }
}

if (require.main === module) {
  main().then((r) => console.log(JSON.stringify(r, null, 2)))
}
