export interface AIModelConfig {
  temperature: number;
  maxTokens: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  streaming?: boolean;
}

export interface AntiHallucinationConfig {
  lowHallucinationMode: boolean;
  validateResponses: boolean;
  addDisclaimers: boolean;
  sanitizeContent: boolean;
  maxContextTokens: number;
}

export class AIConfigurationService {
  // Anti-hallucination optimized configurations
  static readonly ANTI_HALLUCINATION_CONFIG: AIModelConfig = {
    temperature: 0.3,           // Lower temperature for more deterministic responses
    maxTokens: 1000,           // Reasonable limit to prevent rambling
    topP: 0.8,                 // Use nucleus sampling for better quality
    frequencyPenalty: 0.1,     // Slight penalty to reduce repetition
    presencePenalty: 0.1,      // Encourage topic diversity
    streaming: true,
  };

  static readonly BALANCED_CONFIG: AIModelConfig = {
    temperature: 0.5,
    maxTokens: 1500,
    topP: 0.9,
    frequencyPenalty: 0.05,
    presencePenalty: 0.05,
    streaming: true,
  };

  static readonly CREATIVE_CONFIG: AIModelConfig = {
    temperature: 0.8,
    maxTokens: 2000,
    topP: 0.95,
    frequencyPenalty: 0,
    presencePenalty: 0,
    streaming: true,
  };

  static readonly DEFAULT_ANTI_HALLUCINATION: AntiHallucinationConfig = {
    lowHallucinationMode: true,
    validateResponses: true,
    addDisclaimers: true,
    sanitizeContent: false,    // Set to true for strict mode
    maxContextTokens: 4000,
  };

  /**
   * Get AI model configuration based on use case
   */
  static getModelConfig(
    useCase: 'factual' | 'balanced' | 'creative' = 'factual',
    customConfig?: Partial<AIModelConfig>
  ): AIModelConfig {
    let baseConfig: AIModelConfig;

    switch (useCase) {
      case 'factual':
        baseConfig = this.ANTI_HALLUCINATION_CONFIG;
        break;
      case 'creative':
        baseConfig = this.CREATIVE_CONFIG;
        break;
      case 'balanced':
      default:
        baseConfig = this.BALANCED_CONFIG;
        break;
    }

    return { ...baseConfig, ...customConfig };
  }

  /**
   * Get configuration for OpenAI models
   */
  static getOpenAIConfig(
    useCase: 'factual' | 'balanced' | 'creative' = 'factual',
    customConfig?: Partial<AIModelConfig>
  ) {
    const config = this.getModelConfig(useCase, customConfig);
    
    return {
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      temperature: config.temperature,
      maxTokens: config.maxTokens,
      topP: config.topP,
      frequencyPenalty: config.frequencyPenalty,
      presencePenalty: config.presencePenalty,
      streaming: config.streaming,
      openAIApiKey: process.env.OPENAI_API_KEY,
    };
  }

  /**
   * Get configuration for Groq models
   */
  static getGroqConfig(
    useCase: 'factual' | 'balanced' | 'creative' = 'factual',
    model?: string
  ) {
    const config = this.getModelConfig(useCase);
    
    return {
      model: model || 'llama-3.1-8b-instant',
      temperature: config.temperature,
      max_tokens: config.maxTokens,
      top_p: config.topP,
      frequency_penalty: config.frequencyPenalty,
      presence_penalty: config.presencePenalty,
      stream: config.streaming,
    };
  }

  /**
   * Get anti-hallucination configuration
   */
  static getAntiHallucinationConfig(
    customConfig?: Partial<AntiHallucinationConfig>
  ): AntiHallucinationConfig {
    return { ...this.DEFAULT_ANTI_HALLUCINATION, ...customConfig };
  }

  /**
   * Estimate token count (rough approximation)
   */
  static estimateTokenCount(text: string): number {
    // Rough approximation: 1 token ≈ 4 characters for English text
    return Math.ceil(text.length / 4);
  }

  /**
   * Check if we should use low hallucination mode based on query type
   */
  static shouldUseLowHallucinationMode(query: string): boolean {
    const factualKeywords = [
      'fact', 'statistic', 'data', 'research', 'study', 'report',
      'date', 'time', 'when', 'where', 'how many', 'percentage',
      'cost', 'price', 'url', 'link', 'website', 'source',
      'official', 'government', 'law', 'legal', 'medical', 'health'
    ];

    const queryLower = query.toLowerCase();
    return factualKeywords.some(keyword => queryLower.includes(keyword));
  }

  /**
   * Get environment-specific overrides
   */
  static getEnvironmentConfig(): Partial<AIModelConfig> {
    return {
      temperature: parseFloat(process.env.OPENAI_TEMPERATURE || '0.3'),
      maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS || '1000'),
    };
  }

  /**
   * Validate configuration values
   */
  static validateConfig(config: AIModelConfig): boolean {
    if (config.temperature < 0 || config.temperature > 2) {
      console.warn('Temperature should be between 0 and 2');
      return false;
    }
    
    if (config.maxTokens && config.maxTokens < 1) {
      console.warn('Max tokens should be positive');
      return false;
    }

    if (config.topP && (config.topP < 0 || config.topP > 1)) {
      console.warn('TopP should be between 0 and 1');
      return false;
    }

    return true;
  }
}