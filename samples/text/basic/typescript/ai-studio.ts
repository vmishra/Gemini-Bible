/**
 * Basic text generation against the Gemini Developer API (AI Studio).
 *
 * Surface: AI Studio (api-key authenticated).
 * SDK:     @google/genai (unified TypeScript SDK).
 * Auth:    GEMINI_API_KEY in the environment.
 */

import { GoogleGenAI } from '@google/genai'

export async function main(opts: { model?: string; prompt?: string } = {}) {
  const model = opts.model ?? 'gemini-3-flash-preview'
  const prompt =
    opts.prompt ??
    'Explain transformers to a senior backend engineer in three sentences.'

  // GoogleGenAI({}) reads GEMINI_API_KEY from process.env automatically.
  const client = new GoogleGenAI({})

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
