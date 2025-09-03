#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Environment configuration
const ENV_CONFIG = {
  // Clerk Authentication (Required)
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: {
    required: true,
    description: 'Clerk publishable key for user authentication',
    helpUrl: 'https://dashboard.clerk.com',
  },
  CLERK_SECRET_KEY: {
    required: true,
    description: 'Clerk secret key for user authentication',
    helpUrl: 'https://dashboard.clerk.com',
  },
  
  // AI Provider API Keys (At least one required)
  OPENAI_API_KEY: {
    required: false,
    description: 'OpenAI API key for GPT models',
    helpUrl: 'https://platform.openai.com',
    validate: (value) => value.startsWith('sk-'),
  },
  GROQ_API_KEY: {
    required: false,
    description: 'Groq API key for Llama models (free)',
    helpUrl: 'https://console.groq.com',
  },
  HUGGINGFACE_API_KEY: {
    required: false,
    description: 'Hugging Face API key for HF models',
    helpUrl: 'https://huggingface.co/settings/tokens',
  },
  
  // AI Model Configuration (Optional)
  OPENAI_MODEL: {
    required: false,
    description: 'OpenAI model to use (default: gpt-4o-mini)',
    default: 'gpt-4o-mini',
  },
  OPENAI_TEMPERATURE: {
    required: false,
    description: 'OpenAI temperature setting (0-2, default: 0.7)',
    default: '0.7',
    validate: (value) => {
      const num = parseFloat(value);
      return !isNaN(num) && num >= 0 && num <= 2;
    },
  },
  OPENAI_MAX_TOKENS: {
    required: false,
    description: 'OpenAI max tokens setting (default: 1000)',
    default: '1000',
    validate: (value) => {
      const num = parseInt(value);
      return !isNaN(num) && num > 0 && num <= 4096;
    },
  },
  
  // Database (Optional)
  MONGODB_URI: {
    required: false,
    description: 'MongoDB connection string for conversation storage',
    validate: (value) => value.startsWith('mongodb'),
  },
  
  // Application Settings (Optional)
  NEXT_PUBLIC_APP_URL: {
    required: false,
    description: 'Public URL of the application',
    default: 'http://localhost:3000',
  },
};

function loadEnvFile() {
  const envPath = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) {
    return {};
  }
  
  const envContent = fs.readFileSync(envPath, 'utf8');
  const envVars = {};
  
  envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && !key.startsWith('#') && valueParts.length > 0) {
      envVars[key.trim()] = valueParts.join('=').trim();
    }
  });
  
  return envVars;
}

function validateEnvironment() {
  console.log('🔍 Validating environment variables...\n');
  
  const envVars = loadEnvFile();
  const errors = [];
  const warnings = [];
  const missing = [];
  
  // Check each environment variable
  for (const [key, config] of Object.entries(ENV_CONFIG)) {
    const value = envVars[key] || process.env[key];
    
    if (!value) {
      if (config.required) {
        errors.push(`❌ Missing required: ${key}`);
        missing.push({ key, config });
      } else {
        warnings.push(`⚠️  Missing optional: ${key}`);
      }
      continue;
    }
    
    // Validate value if validator is provided
    if (config.validate && !config.validate(value)) {
      errors.push(`❌ Invalid value for ${key}: ${value}`);
      continue;
    }
    
    console.log(`✅ ${key}: configured`);
  }
  
  // Check for at least one AI provider
  const hasOpenAI = envVars.OPENAI_API_KEY || process.env.OPENAI_API_KEY;
  const hasGroq = envVars.GROQ_API_KEY || process.env.GROQ_API_KEY;
  const hasHuggingFace = envVars.HUGGINGFACE_API_KEY || process.env.HUGGINGFACE_API_KEY;
  
  if (!hasOpenAI && !hasGroq && !hasHuggingFace) {
    errors.push('❌ At least one AI provider API key is required (OPENAI_API_KEY, GROQ_API_KEY, or HUGGINGFACE_API_KEY)');
  }
  
  console.log('');
  
  // Show warnings
  if (warnings.length > 0) {
    console.log('⚠️  Warnings:');
    warnings.forEach(warning => console.log(`   ${warning}`));
    console.log('');
  }
  
  // Show errors
  if (errors.length > 0) {
    console.log('❌ Errors:');
    errors.forEach(error => console.log(`   ${error}`));
    console.log('');
    
    // Show help for missing required variables
    if (missing.length > 0) {
      console.log('📋 Quick Setup Guide:');
      missing.forEach(({ key, config }) => {
        console.log(`   ${key}: ${config.description}`);
        if (config.helpUrl) {
          console.log(`   📍 Get it at: ${config.helpUrl}`);
        }
        console.log('');
      });
    }
    
    console.log('💡 Create a .env.local file with the missing variables.');
    console.log('💡 Run "npm run create-env-template" to generate a template.\n');
    
    process.exit(1);
  }
  
  // Show status summary
  console.log('📊 Status Summary:');
  const hasAuth = (envVars.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) && 
                  (envVars.CLERK_SECRET_KEY || process.env.CLERK_SECRET_KEY);
  const hasDb = envVars.MONGODB_URI || process.env.MONGODB_URI;
  
  console.log(`   ✅ Authentication: ${hasAuth ? 'Configured' : 'Missing'}`);
  console.log(`   🤖 AI Providers: ${[hasOpenAI && 'OpenAI', hasGroq && 'Groq', hasHuggingFace && 'HuggingFace'].filter(Boolean).join(', ') || 'None'}`);
  console.log(`   💾 Database: ${hasDb ? 'Configured' : 'Not configured (using local storage)'}`);
  
  console.log('\n✅ Environment validation passed! You can now run the application.\n');
}

function createEnvTemplate() {
  console.log('📄 Creating environment template...\n');
  
  let template = `# MDS Chatbot Environment Variables
# Copy this file to .env.local and fill in your values

`;

  for (const [key, config] of Object.entries(ENV_CONFIG)) {
    template += `# ${config.description}\n`;
    if (config.helpUrl) {
      template += `# Get it at: ${config.helpUrl}\n`;
    }
    if (config.required) {
      template += `${key}=\n\n`;
    } else {
      template += `# ${key}=${config.default || ''}\n\n`;
    }
  }
  
  template += `
# Quick Setup Guide:
# 1. 🔐 Get Clerk keys at https://dashboard.clerk.com
#    - Create a new application
#    - Copy the publishable key and secret key
#
# 2. 🤖 Get Groq API key (FREE) at https://console.groq.com
#    - Sign up for a free account
#    - Generate an API key
#    - Groq provides fast, free access to Llama models
#
# 3. 🚀 Optional: Get OpenAI API key at https://platform.openai.com
#    - Required for GPT models
#    - Paid service with usage-based pricing
#
# 4. 💾 Optional: Set up MongoDB for conversation persistence
#    - Use MongoDB Atlas (free tier available)
#    - Or local MongoDB instance
#
# 5. 🔧 Run 'npm run validate-env' to check your configuration
`;

  const envPath = path.join(process.cwd(), '.env.template');
  fs.writeFileSync(envPath, template);
  
  console.log(`✅ Environment template created: ${envPath}`);
  console.log('📋 Copy this file to .env.local and fill in your values.\n');
}

// Check command line arguments
const command = process.argv[2];

if (command === 'template') {
  createEnvTemplate();
} else {
  validateEnvironment();
}
