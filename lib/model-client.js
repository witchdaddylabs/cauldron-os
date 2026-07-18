/**
 * model-client.js
 *
 * Extracted model calling layer for Cauldron OS.
 * Handles both local Ollama and cloud providers (OpenAI-compatible + Gemini).
 *
 * This module was extracted from server.js during the 2026 refactor
 * (Phase 1 of the Transition Plan).
 */

const OPENAI_BASE_URL = 'https://api.openai.com/v1/chat/completions';
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
module.exports.GEMINI_BASE_URL = GEMINI_BASE_URL;

const CLOUD_MODELS = {
  gemini: {
    defaultModel: 'gemini-3.1-flash-lite-preview',
    models: ['gemini-3.1-flash-lite-preview', 'gemini-3.1-pro-preview'],
    labels: {
      'gemini-3.1-flash-lite-preview': 'Gemini Flash 3.1 Lite Preview',
      'gemini-3.1-pro-preview': 'Gemini Pro 3.1 Preview',
    },
  },
  openai: {
    defaultModel: 'gpt-5.4',
    models: ['gpt-5.4'],
    labels: {
      'gpt-5.4': 'GPT-5.4',
    },
  },
};

function getCloudModelName(provider, _projectType = 'app', requestedModel = '') {
  const config = CLOUD_MODELS[provider];
  if (!config) throw new Error(`Unsupported cloud provider: ${provider}`);
  if (requestedModel && config.models.includes(requestedModel)) return requestedModel;
  return config.defaultModel;
}

function extractJsonObject(text = '') {
  const trimmed = String(text).trim();
  try {
    return JSON.parse(trimmed);
  } catch {}

  const first = trimmed.indexOf('{');
  const last = trimmed.lastIndexOf('}');
  if (first !== -1 && last !== -1 && last > first) {
    return JSON.parse(trimmed.slice(first, last + 1));
  }

  throw new Error('Model did not return a JSON object');
}

function normaliseClarifyResult(raw) {
  const fallback = {
    questions: [],
    assumptions: [],
    redFlags: [],
    suggestedScope: [],
  };

  const result = { ...fallback, ...(raw || {}) };
  result.questions = Array.isArray(result.questions)
    ? result.questions
        .slice(0, 8)
        .map((q, index) => {
          const id =
            String(q?.id || `question-${index + 1}`)
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, '-')
              .replace(/^-|-$/g, '') || `question-${index + 1}`;
          return {
            id,
            label: String(q?.label || q?.question || '').trim(),
            why: String(q?.why || '').trim(),
          };
        })
        .filter((q) => q.label)
    : [];

  result.assumptions = Array.isArray(result.assumptions)
    ? result.assumptions.slice(0, 4).map(String)
    : [];
  result.redFlags = Array.isArray(result.redFlags) ? result.redFlags.slice(0, 4).map(String) : [];
  result.suggestedScope = Array.isArray(result.suggestedScope)
    ? result.suggestedScope.slice(0, 5).map(String)
    : [];

  if (result.questions.length === 0) {
    throw new Error('Model returned no clarifying questions');
  }

  return result;
}

function normaliseOpenAICompatibleChatUrl(baseUrl = '') {
  const raw = String(baseUrl || '').trim() || OPENAI_BASE_URL;
  if (raw.endsWith('/chat/completions')) return raw;
  return raw.replace(/\/$/, '').replace(/\/v1$/, '/v1') + '/chat/completions';
}

function modelRequiresDefaultTemperature(model = '') {
  const id = String(model || '').toLowerCase();
  return (
    id.startsWith('gpt-5') || id.startsWith('o1') || id.startsWith('o3') || id.startsWith('o4')
  );
}

function buildChatPayload({ model, messages, temperature, stream = false }) {
  const payload = { model, messages };
  if (stream) payload.stream = true;
  if (!modelRequiresDefaultTemperature(model)) payload.temperature = temperature;
  return payload;
}

function inferProviderFromModel(model = '') {
  const id = String(model || '').toLowerCase();
  if (id.startsWith('gemini-')) return 'gemini';
  if (id.startsWith('gpt-') || id.startsWith('o') || id.startsWith('chatgpt-')) return 'openai';
  if (id.startsWith('claude-') || id.startsWith('anthropic.')) return 'anthropic';
  if (id.startsWith('bedrock-') || id.includes('.claude-')) return 'bedrock';
  if (id.startsWith('nvidia/') || id.startsWith('nv-')) return 'nim';
  if (
    id.startsWith('glm-') ||
    id.startsWith('qwen') ||
    id.startsWith('kimi') ||
    id.startsWith('deepseek')
  )
    return 'openai';
  return 'openai';
}

async function callOllamaModel({
  model,
  prompt,
  systemPrompt,
  numPredict = 8192,
  temperature = 0.55,
}) {
  const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434';
  const OLLAMA_URL = `${OLLAMA_BASE_URL}/api/generate`;
  const OLLAMA_TIMEOUT_MS = 600000;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT_MS);
  try {
    const ollamaRes = await fetch(OLLAMA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        prompt,
        system: systemPrompt,
        stream: false,
        options: {
          num_predict: numPredict,
          temperature,
          top_p: 0.9,
        },
      }),
    }).catch(() => {
      throw new Error(`Cannot reach Ollama at ${OLLAMA_URL}. Is Ollama running?`);
    });

    if (!ollamaRes.ok) {
      const text = await ollamaRes.text();
      throw new Error(`Ollama ${ollamaRes.status}: ${text}`);
    }

    const data = await ollamaRes.json();
    return data.response || data.message || '';
  } finally {
    clearTimeout(timeout);
  }
}

async function callCloudModel({
  provider,
  apiKey,
  prompt,
  systemPrompt,
  projectType,
  requestedModel = '',
  baseUrl = '',
  timeoutMs = 300000,
}) {
  const url = provider === 'gemini' ? GEMINI_BASE_URL : normaliseOpenAICompatibleChatUrl(baseUrl);
  const model = getCloudModelName(provider, projectType, requestedModel);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt },
    ];
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify(
        buildChatPayload({
          model,
          messages,
          temperature: provider === 'gemini' ? 0.5 : 0.55,
        })
      ),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`${provider} ${response.status}: ${text}`);
    }

    const data = await response.json();
    const blueprint = data?.choices?.[0]?.message?.content;

    if (!blueprint) {
      throw new Error(`${provider} returned no blueprint content`);
    }

    return blueprint;
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = {
  CLOUD_MODELS,
  getCloudModelName,
  extractJsonObject,
  normaliseClarifyResult,
  normaliseOpenAICompatibleChatUrl,
  modelRequiresDefaultTemperature,
  buildChatPayload,
  inferProviderFromModel,
  callOllamaModel,
  callCloudModel,
};
