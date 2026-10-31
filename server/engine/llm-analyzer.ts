import OpenAI from 'openai';
import dotenv from 'dotenv';
import { LLMAddressAnalysis, LLMAddressAnalysisSchema } from './types.js';

dotenv.config();

let groqClient: OpenAI | null = null;
let cachedApiKey: string | null = null;

function getGroqClient(): OpenAI | null {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || apiKey.trim() === '' || apiKey.includes('your_groq_api_key_here') || apiKey.includes('YOUR_API_KEY')) {
    return null;
  }
  if (!groqClient || cachedApiKey !== apiKey) {
    cachedApiKey = apiKey;
    groqClient = new OpenAI({
      apiKey,
      baseURL: 'https://api.groq.com/openai/v1'
    });
  }
  return groqClient;
}

/**
 * Deterministic Mock Analyzer for Indian E-Commerce Names and Addresses.
 * Handles Hinglish, local landmarks, missing components, and garbage strings.
 */
export function mockAnalyzeCustomerAndAddress(name: string, address: string): LLMAddressAnalysis {
  const cleanName = (name || '').trim();
  const lowerName = cleanName.toLowerCase();
  const cleanAddr = (address || '').trim();
  const lowerAddr = cleanAddr.toLowerCase();

  // 1. Name Analysis
  let isSuspiciousName = false;
  let nameReason: string | undefined = undefined;

  const testTokens = ['test order', 'test', 'asdf', 'fake', 'dummy', 'qwerty', 'demo', 'sample'];
  const minimalTokens = ['na', 'xyz', 'abc', 'none', 'null', 'user', 'admin'];

  if (testTokens.some(t => lowerName === t || lowerName.startsWith(t + ' ') || lowerName.endsWith(' ' + t))) {
    isSuspiciousName = true;
    nameReason = `Customer name "${cleanName}" contains known test/placeholder token.`;
  } else if (minimalTokens.includes(lowerName) || lowerName === 'xyz xyz') {
    isSuspiciousName = true;
    nameReason = `Customer name "${cleanName}" is a placeholder or meaningless identifier.`;
  } else if (cleanName.length <= 2) {
    isSuspiciousName = true;
    nameReason = `Customer name "${cleanName}" is abnormally short (<= 2 chars).`;
  }

  // 2. Address Analysis
  const isPlaceholderAddress =
    cleanAddr.length < 5 ||
    ['.', 'xyz', 'home', 'call me', 'delhi', 'mumbai', 'kolkata', 'patna', 'pune', 'chennai', 'hyderabad'].includes(lowerAddr) ||
    /^(.)\1{2,}$/.test(cleanAddr); // repeated chars like "..." or "xxx"

  const missingComponents: string[] = [];

  // Check house / flat identifier
  const hasHouseNumber =
    /\b(flat|house|plot|room|block|sector|h\.?no|no\.?|floor|b-\d+|c-\d+|a-\d+)\b/i.test(cleanAddr) ||
    /\d+/.test(cleanAddr);
  if (!hasHouseNumber && !isPlaceholderAddress) {
    missingComponents.push('house_or_flat_number');
  }

  // Check street / locality / society
  const hasLocality =
    /\b(road|marg|street|gali|lane|nagar|colony|society|apartments?|enclave|bazaar|mohalla|vihar|city|town|sector)\b/i.test(cleanAddr);
  if (!hasLocality && !isPlaceholderAddress) {
    missingComponents.push('street_or_society');
  }

  // Check landmark
  const hasLandmark =
    /\b(near|opp|opposite|behind|beside|front|ke paas|ke samne|ke peeche|mandir|masjid|temple|hospital|station|water tank|school|chowk|gate|park|bazaar)\b/i.test(cleanAddr);
  if (!hasLandmark && !isPlaceholderAddress && cleanAddr.length < 25) {
    missingComponents.push('landmark');
  }

  // Detect language / style
  const isHinglish =
    /\b(ke paas|ke peeche|ke samne|ghar|mandir|masjid|chowk|gali no|andar|wala|wali|ph krke aana|ka naam|paas)\b/i.test(cleanAddr);

  let completenessScore = 85;
  if (isPlaceholderAddress) {
    completenessScore = 10;
  } else if (cleanAddr.length < 12) {
    completenessScore = 25;
  } else {
    if (!hasHouseNumber) completenessScore -= 25;
    if (!hasLocality) completenessScore -= 20;
    if (!hasLandmark && cleanAddr.length < 30) completenessScore -= 10;
    if (cleanAddr.length >= 35) completenessScore += 10;
    completenessScore = Math.max(15, Math.min(95, completenessScore));
  }

  let summaryNote = '';
  if (isPlaceholderAddress) {
    summaryNote = 'Blatant placeholder or incomplete address string detected.';
  } else if (completenessScore < 40) {
    summaryNote = `Sparse address lacking clear delivery points (${missingComponents.join(', ')}).`;
  } else if (isHinglish) {
    summaryNote = 'Valid Indian colloquial/Hinglish address with identifiable localized landmarks.';
  } else {
    summaryNote = 'Sufficiently structured residential/commercial delivery address.';
  }

  return {
    is_suspicious_name: isSuspiciousName,
    name_suspicion_reason: nameReason,
    address_completeness_score: completenessScore,
    is_placeholder_address: isPlaceholderAddress,
    missing_components: missingComponents,
    detected_language: isHinglish ? 'Hinglish' : 'English',
    summary_note: summaryNote
  };
}

/**
 * Executes LLM Analysis via Groq or falls back deterministically.
 */
export async function analyzeCustomerAndAddress(
  name: string,
  address: string,
  city?: string,
  state?: string,
  pincode?: string
): Promise<{ result: LLMAddressAnalysis; aiUsed: boolean }> {
  const client = getGroqClient();

  if (!client) {
    return {
      result: mockAnalyzeCustomerAndAddress(name, address),
      aiUsed: false
    };
  }

  const model = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
  const timeoutMs = 4500; // Fast 4.5s timeout

  const prompt = `
You are an expert Indian e-commerce delivery logistics analyst.
Analyze the following customer name and address for Cash-on-Delivery (COD) risk:
- Customer Name: "${name}"
- Address: "${address}"
- City: "${city || 'Unknown'}"
- State: "${state || 'Unknown'}"
- Pincode: "${pincode || 'Unknown'}"

Evaluate:
1. Is the customer name a suspicious fake/test token (e.g., 'test', 'asdf', 'fake', single letters)?
2. Address completeness: Does it have a valid house/flat number, road/street/society, and nearby landmark?
3. Understand Indian English and Hinglish expressions (e.g., 'ke paas', 'ghar ka naam', 'near water tank', 'ph krke aana').
4. Detect garbage/placeholder addresses (e.g. '.', 'xyz', 'home', city name only).

Respond strictly with valid JSON conforming to:
{
  "is_suspicious_name": boolean,
  "name_suspicion_reason": string or null,
  "address_completeness_score": number (0 to 100),
  "is_placeholder_address": boolean,
  "missing_components": string[],
  "detected_language": "English" | "Hinglish" | "Other",
  "summary_note": string
}
`;

  try {
    const callPromise = client.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: 'You are an Indian delivery address and customer identity validation assistant. Output strictly valid JSON.'
        },
        { role: 'user', content: prompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1
    });

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Groq request timed out')), timeoutMs)
    );

    const response = await Promise.race([callPromise, timeoutPromise]);
    const rawContent = response.choices[0]?.message?.content || '{}';
    const parsedJson = JSON.parse(rawContent);

    // Validate with Zod
    const validated = LLMAddressAnalysisSchema.safeParse(parsedJson);
    if (!validated.success) {
      console.warn('Groq response failed Zod schema validation. Falling back to mock.', validated.error);
      return {
        result: mockAnalyzeCustomerAndAddress(name, address),
        aiUsed: false
      };
    }

    return {
      result: validated.data,
      aiUsed: true
    };
  } catch (error) {
    console.warn('Groq API call failed or timed out. Falling back to deterministic mock analyzer:', error);
    return {
      result: mockAnalyzeCustomerAndAddress(name, address),
      aiUsed: false
    };
  }
}
