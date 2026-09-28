const PROMPT_INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(all|any|the)\s+(previous|prior|above|system|developer)\s+instructions?/i,
  /disregard\s+(all|any|the)\s+(previous|prior|above)\s+instructions?/i,
  /override\s+(the\s+)?(system|developer|safety)\s+(prompt|message|rules?)/i,
  /(reveal|show|print|give)\s+(me\s+)?(the\s+)?(system|developer)\s+prompt/i,
  /(reveal|show|print|give)\b[\s\S]{0,60}\b(api\s*keys?|passwords?|tokens?|secrets?)/i,
  /(system|developer)\s+message\s*[:=]/i,
  /\b(jailbreak|prompt\s+injection|dan\s+mode|developer\s+mode)\b/i,
  /\b(act|pretend|roleplay)\s+as\s+(an?\s+)?(unrestricted|different|new)\s+(assistant|system|developer)\b/i,
  /\b(forget|ignore)\s+(your|the)\s+(role|rules|safety|instructions?)\b/i,
  /(?:^|\n)\s*(system|developer|assistant)\s*:/i,
  /\b(execute|run)\s+(shell|bash|powershell|cmd|sql)\b/i,
  /\b(drop|delete|truncate)\s+(table|database|schema)\b/i,
  /\b(read|dump|export)\s+(the\s+)?(database|env|environment|secrets?)\b/i,
  /\baccess\s+(another|other)\s+(user|account|workspace|tenant)/i,
  /\blist\s+(all|every)\s+(users?|accounts?|passwords?|tokens?|api\s*keys?)/i,
];

const PURPOSE_PATTERNS: RegExp[] = [
  /\b(meeting|meetings|appointment|appointments|calendar|schedule|scheduled|availability|slot|slots)\b/i,
  /\b(interview|interviews|interviewer|panel|panels|candidate|candidates|feedback)\b/i,
  /\b(contact|contacts|client|clients|position|positions|job|jobs|event type|event types)\b/i,
  /\b(discuss(?:ed|ion)?|discussion|notes?|summary|summarize|action item|decision|prepare|previous|history|related)\b/i,
  /\b(payment|api|website|project|integration|redesign|follow[- ]?up)\b/i,
];

export type AiQueryScreen =
  | { allowed: true; normalizedQuery: string }
  | { allowed: false; reason: 'prompt_injection' | 'unsafe_data_request' | 'empty' };

export function screenAiQuery(query: string): AiQueryScreen {
  const normalizedQuery = query
    .normalize('NFKC')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200D\uFEFF]/g, '')
    .trim();
  if (!normalizedQuery) return { allowed: false, reason: 'empty' };

  if (PROMPT_INJECTION_PATTERNS.some((pattern) => pattern.test(normalizedQuery))) {
    return { allowed: false, reason: 'prompt_injection' };
  }

  const excessiveRepetition = /(.)\1{80,}/s.test(normalizedQuery) || normalizedQuery.split(/\s+/).length > 450;
  if (excessiveRepetition) return { allowed: false, reason: 'unsafe_data_request' };

  return { allowed: true, normalizedQuery };
}

export function isClearlyPanelFlowOutOfScope(query: string): boolean {
  const lower = query.toLowerCase();
  const hasPurposeSignal = PURPOSE_PATTERNS.some((pattern) => pattern.test(query));
  const obviousGeneralPurposeRequest = /\b(write|generate|create|translate|solve|debug|code|program|recipe|essay|poem|story|joke|homework|weather|news|stock|crypto|politics|medical|legal)\b/i.test(query);

  const dangerousRequest = /\b(hack|exploit|malware|ransomware|phishing|credential stuffing|credential theft|steal passwords?|exfiltrate|scrape private data|dump secrets|keylogger|bypass authentication)\b/i.test(lower);

  return dangerousRequest || (obviousGeneralPurposeRequest && !hasPurposeSignal);
}

export function protectRetrievedText(text: string): string {
  if (!text) return text;
  const looksInstructional = PROMPT_INJECTION_PATTERNS.some((pattern) => pattern.test(text));
  if (!looksInstructional) return text;

  return text
    .replace(/ignore\s+(all|any|the)\s+(previous|prior|above|system|developer)\s+instructions?/gi, '[instruction-like text omitted]')
    .replace(/disregard\s+(all|any|the)\s+(previous|prior|above)\s+instructions?/gi, '[instruction-like text omitted]')
    .replace(/(reveal|show|print|give)\s+(me\s+)?(the\s+)?(system|developer)\s+prompt/gi, '[sensitive prompt request omitted]')
    .replace(/(reveal|show|print|give)\b[\s\S]{0,60}\b(api\s*keys?|passwords?|tokens?|secrets?)/gi, '[sensitive secret request omitted]');
}

const SECRET_PATTERNS = [
  /sk-[A-Za-z0-9_-]{20,}/g,
  /AIza[0-9A-Za-z_-]{20,}/g,
  /gsk_[A-Za-z0-9_-]{20,}/g,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/gi,
];

export function sanitizeAiOutput(output: string, maxCharacters: number): string {
  let safe = output || '';
  for (const pattern of SECRET_PATTERNS) safe = safe.replace(pattern, '[redacted secret]');
  const lower = safe.toLowerCase();
  if (lower.includes('gemini_api_key=') || lower.includes('groq_api_key=') || lower.includes('jwt_secret=')) {
    safe = 'I can’t provide secrets, credentials, hidden prompts, or internal configuration. I can help with PanelFlow meetings, scheduling, contacts, panels, positions, and authorized records.';
  }
  return safe.length > maxCharacters ? `${safe.slice(0, maxCharacters)}\n[response truncated]` : safe;
}
