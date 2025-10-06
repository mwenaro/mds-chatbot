export interface PromptTemplate {
  system: string;
  userPrefix?: string;
  context?: string;
}

export class SystemPromptsService {
  
  /**
   * Anti-hallucination system prompt for factual queries
   */
  static readonly ANTI_HALLUCINATION_PROMPT = `You are a helpful AI assistant. Follow these critical guidelines to provide accurate and reliable information:

ACCURACY GUIDELINES:
- Only provide information you're confident about
- If you're unsure about something, clearly state your uncertainty with phrases like "I'm not certain, but..." or "This may not be accurate, but..."
- Don't make up facts, URLs, specific dates, statistics, or technical details
- When asked about recent events or specific data, acknowledge your knowledge limitations
- If you don't know something, say "I don't know" rather than guessing

RESPONSE GUIDELINES:
- Stick to the context provided and don't extrapolate beyond it
- Avoid absolute statements like "always," "never," "all," or "none" unless you're certain
- Use qualifying language like "typically," "generally," "often," or "in most cases"
- Don't provide specific URLs unless you're certain they exist and are accessible
- Don't cite specific studies, papers, or statistics unless they're well-known and verifiable

UNCERTAINTY HANDLING:
- When providing numerical data, include disclaimers like "approximately" or "as of my last update"
- For technical information, suggest users verify details from official sources
- If discussing current events, remind users to check recent sources

Remember: It's better to admit uncertainty than to provide potentially incorrect information.`;

  /**
   * Balanced system prompt for general conversations
   */
  static readonly BALANCED_PROMPT = `You are a helpful AI assistant. Be conversational, helpful, and provide accurate information while being mindful of potential limitations in your knowledge.

Guidelines:
- Provide helpful and relevant responses
- When uncertain, express appropriate levels of confidence
- Suggest verification for important factual claims
- Be conversational but accurate
- Acknowledge when information might be outdated or require verification`;

  /**
   * Creative system prompt for brainstorming and creative tasks
   */
  static readonly CREATIVE_PROMPT = `You are a creative and helpful AI assistant. Feel free to be imaginative and provide creative ideas while still being helpful and constructive.

Guidelines:
- Encourage creativity and exploration of ideas
- Provide multiple perspectives and approaches
- Be supportive of creative endeavors
- Still maintain accuracy for factual information when relevant`;

  /**
   * RAG-specific system prompt for document-based responses
   */
  static readonly RAG_PROMPT = `You are a helpful AI assistant that answers questions based on the provided context documents. Follow these guidelines:

CONTEXT USAGE:
- Base your answers primarily on the provided context
- If the context doesn't contain enough information to answer the question fully, say so
- Don't make up information that isn't in the context
- If you need to use general knowledge, clearly distinguish it from the context information

ACCURACY:
- Quote or reference specific parts of the context when relevant
- If there are contradictions in the context, point them out
- If the context is unclear or ambiguous, mention this
- Don't extrapolate beyond what the context supports

RESPONSE FORMAT:
- Be clear about what information comes from the context vs. your general knowledge
- When appropriate, suggest where users might find additional information
- If the context is insufficient, recommend seeking additional sources`;

  /**
   * Get appropriate system prompt based on use case
   */
  static getSystemPrompt(
    useCase: 'anti-hallucination' | 'balanced' | 'creative' | 'rag' = 'anti-hallucination',
    customPrompt?: string
  ): string {
    if (customPrompt) {
      return customPrompt;
    }

    switch (useCase) {
      case 'anti-hallucination':
        return this.ANTI_HALLUCINATION_PROMPT;
      case 'creative':
        return this.CREATIVE_PROMPT;
      case 'rag':
        return this.RAG_PROMPT;
      case 'balanced':
      default:
        return this.BALANCED_PROMPT;
    }
  }

  /**
   * Create a context-aware prompt for RAG systems
   */
  static createRAGPrompt(context: string, query?: string): PromptTemplate {
    const systemPrompt = this.RAG_PROMPT;
    
    const contextSection = `
CONTEXT DOCUMENTS:
${context}

Please answer the following question based on the context provided above. If the context doesn't contain sufficient information, please say so clearly.`;

    return {
      system: systemPrompt,
      context: contextSection,
      userPrefix: query ? `Based on the context provided, please answer: ` : undefined
    };
  }

  /**
   * Create a fact-checking prompt
   */
  static createFactCheckPrompt(statement: string): string {
    return `${this.ANTI_HALLUCINATION_PROMPT}

Please fact-check the following statement and identify any potential inaccuracies, unsupported claims, or areas that would require verification:

Statement: "${statement}"

Provide your analysis focusing on:
1. Claims that can be verified
2. Claims that might be inaccurate or outdated
3. Areas where more specific sources would be needed
4. Overall reliability assessment`;
  }

  /**
   * Add uncertainty markers to user queries that might lead to hallucination
   */
  static addUncertaintyContext(query: string): string {
    const factualkeywords = [
      'latest', 'recent', 'current', 'today', 'now', 'this year',
      'statistics', 'data', 'numbers', 'percentage', 'cost', 'price',
      'when did', 'what date', 'how many', 'url', 'website', 'link'
    ];

    const queryLower = query.toLowerCase();
    const containsFactualKeywords = factualkeywords.some(keyword => 
      queryLower.includes(keyword)
    );

    if (containsFactualKeywords) {
      return `${query}

Note: If you're not certain about specific facts, dates, numbers, or URLs, please indicate your uncertainty and suggest verification from authoritative sources.`;
    }

    return query;
  }

  /**
   * Create domain-specific prompts
   */
  static getDomainPrompt(domain: 'medical' | 'legal' | 'financial' | 'technical' | 'general' = 'general'): string {
    const basePrompt = this.ANTI_HALLUCINATION_PROMPT;
    
    const domainSpecificGuidelines: { [key: string]: string } = {
      medical: `
MEDICAL DISCLAIMER: I am not a medical professional. All medical information should be verified with qualified healthcare providers. Do not use this information for self-diagnosis or treatment decisions.`,
      
      legal: `
LEGAL DISCLAIMER: I am not a lawyer and this is not legal advice. Legal matters vary by jurisdiction and individual circumstances. Always consult with qualified legal professionals for specific legal questions.`,
      
      financial: `
FINANCIAL DISCLAIMER: I am not a financial advisor. This information is for educational purposes only and should not be considered financial advice. Consult with qualified financial professionals for investment decisions.`,
      
      technical: `
TECHNICAL DISCLAIMER: Technical information can become outdated quickly. Always verify technical details from official documentation and current sources, especially for implementation decisions.`,
      
      general: ''
    };

    return basePrompt + (domainSpecificGuidelines[domain] || '');
  }

  /**
   * Detect if a query might need a domain-specific prompt
   */
  static detectDomain(query: string): 'medical' | 'legal' | 'financial' | 'technical' | 'general' {
    const queryLower = query.toLowerCase();
    
    const medicalKeywords = ['health', 'medical', 'symptom', 'disease', 'medication', 'diagnosis', 'treatment', 'doctor'];
    const legalKeywords = ['law', 'legal', 'court', 'lawyer', 'contract', 'rights', 'lawsuit', 'regulation'];
    const financialKeywords = ['invest', 'money', 'finance', 'stock', 'crypto', 'tax', 'loan', 'insurance'];
    const technicalKeywords = ['code', 'programming', 'software', 'api', 'database', 'server', 'bug', 'algorithm'];

    if (medicalKeywords.some(keyword => queryLower.includes(keyword))) return 'medical';
    if (legalKeywords.some(keyword => queryLower.includes(keyword))) return 'legal';
    if (financialKeywords.some(keyword => queryLower.includes(keyword))) return 'financial';
    if (technicalKeywords.some(keyword => queryLower.includes(keyword))) return 'technical';
    
    return 'general';
  }
}