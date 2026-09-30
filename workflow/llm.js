import Anthropic from '@anthropic-ai/sdk';

export const MODELS = {
  pitch: process.env.MODEL_PITCH || 'claude-haiku-4-5-20251001',
  build: process.env.MODEL_BUILD || 'claude-sonnet-5-5',
};

let client;

export async function ask({ model, system, prompt, maxTokens, effort }) {
  client ??= new Anthropic({ maxRetries: 4 });
  const started = Date.now();
  const seconds = () => ((Date.now() - started) / 1000).toFixed(1);
  console.log(`[llm] ${model} request started (max_tokens ${maxTokens}${effort ? `, effort ${effort}` : ''})`);
  const response = await client.messages
    .create({
      model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: prompt }],
      ...(effort && { output_config: { effort } }),
    })
    .catch((error) => {
      console.error(`[llm] ${model} request failed after ${seconds()}s: ${error?.message ?? error}`);
      throw error;
    });
  console.log(
    `[llm] ${model} done in ${seconds()}s (in ${response.usage.input_tokens}, out ${response.usage.output_tokens}, stop: ${response.stop_reason})`,
  );
  const text = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  if (!text.trim()) throw new Error(`${model} returned no text (stop_reason: ${response.stop_reason}, output_tokens: ${response.usage.output_tokens})`);
  return text;
}
