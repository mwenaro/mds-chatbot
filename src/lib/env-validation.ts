// Environment validation utility
interface EnvConfig {
  [key: string]: {
    required: boolean;
    description: string;
    default?: string;
    validate?: (value: string) => boolean;
  };
}

const ENV_CONFIG: EnvConfig = {
  // Clerk Authentication
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: {
    required: true,
    description: 'Clerk publishable key for user authentication',
  },
  CLERK_SECRET_KEY: {
    required: true,
    description: 'Clerk secret key for user authentication',
  },
  
  // AI Provider API Keys
  OPENAI_API_KEY: {
    required: false,
    description: 'OpenAI API key for GPT models',
    validate: (value) => value.startsWith('sk-'),
  },
  GROQ_API_KEY: {
    required: false,
    description: 'Groq API key for Llama models (free at console.groq.com)',
  },
  HUGGINGFACE_API_KEY: {
    required: false,
    description: 'Hugging Face API key for HF models',
  },
  
  // AI Model Configuration
  OPENAI_MODEL: {
    required: false,
    description: 'OpenAI model to use',
    default: 'gpt-4o-mini',
  },
  OPENAI_TEMPERATURE: {
    required: false,
    description: 'OpenAI temperature setting',
    default: '0.7',
    validate: (value) => {
      const num = parseFloat(value);
      return !isNaN(num) && num >= 0 && num <= 2;
    },
  },
  OPENAI_MAX_TOKENS: {
    required: false,
    description: 'OpenAI max tokens setting',
    default: '1000',
    validate: (value) => {
      const num = parseInt(value);
      return !isNaN(num) && num > 0 && num <= 4096;
    },
  },
  
  // Database
  MONGODB_URI: {
    required: false,
    description: 'MongoDB connection string for conversation storage',
    validate: (value) => value.startsWith('mongodb'),
  },
  
  // Application Settings
  NEXT_PUBLIC_APP_URL: {
    required: false,
    description: 'Public URL of the application',
    default: 'http://localhost:3000',
  },
};

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  missingRequired: string[];
  missingOptional: string[];
}

export function validateEnvironment(): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const missingRequired: string[] = [];
  const missingOptional: string[] = [];

  for (const [key, config] of Object.entries(ENV_CONFIG)) {
    const value = process.env[key];
    
    if (!value) {
      if (config.required) {
        missingRequired.push(key);
        errors.push(`Missing required environment variable: ${key} - ${config.description}`);
      } else {
        missingOptional.push(key);
        warnings.push(`Missing optional environment variable: ${key} - ${config.description}`);
      }
      continue;
    }
    
    // Validate value if validator is provided
    if (config.validate && !config.validate(value)) {
      errors.push(`Invalid value for ${key}: ${value}`);
    }
  }
  
  // Check for at least one AI provider
  const hasOpenAI = process.env.OPENAI_API_KEY;
  const hasGroq = process.env.GROQ_API_KEY;
  const hasHuggingFace = process.env.HUGGINGFACE_API_KEY;
  
  if (!hasOpenAI && !hasGroq && !hasHuggingFace) {
    errors.push('At least one AI provider API key is required (OPENAI_API_KEY, GROQ_API_KEY, or HUGGINGFACE_API_KEY)');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    missingRequired,
    missingOptional,
  };
}

export function getEnvStatus(): {
  hasAuth: boolean;
  hasDatabase: boolean;
  availableProviders: string[];
  requiredMissing: string[];
} {
  const hasAuth = !!(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY);
  const hasDatabase = !!process.env.MONGODB_URI;
  
  const availableProviders: string[] = [];
  if (process.env.OPENAI_API_KEY) availableProviders.push('OpenAI');
  if (process.env.GROQ_API_KEY) availableProviders.push('Groq');
  if (process.env.HUGGINGFACE_API_KEY) availableProviders.push('Hugging Face');
  
  const validation = validateEnvironment();
  
  return {
    hasAuth,
    hasDatabase,
    availableProviders,
    requiredMissing: validation.missingRequired,
  };
}

export function createEnvTemplate(): string {
  let template = `# MDS Chatbot Environment Variables
# Copy this file to .env.local and fill in your values

`;

  for (const [key, config] of Object.entries(ENV_CONFIG)) {
    template += `# ${config.description}\n`;
    if (config.required) {
      template += `${key}=\n\n`;
    } else {
      template += `# ${key}=${config.default || ''}\n\n`;
    }
  }
  
  template += `
# Quick Setup Guide:
# 1. Get Clerk keys at https://dashboard.clerk.com
# 2. Get Groq API key (free) at https://console.groq.com
# 3. Get OpenAI API key at https://platform.openai.com (optional)
# 4. Set up MongoDB (optional, for conversation persistence)
`;

  return template;
}

// Runtime validation hook for use in components
export function useEnvValidation() {
  const validation = validateEnvironment();
  const status = getEnvStatus();
  
  return {
    ...validation,
    ...status,
    isConfigured: validation.valid && status.availableProviders.length > 0,
  };
}

const envValidation = {
  validateEnvironment,
  getEnvStatus,
  createEnvTemplate,
  useEnvValidation,
};

export default envValidation;
