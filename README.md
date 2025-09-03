# MDS Chatbot

A modern AI-powered chatbot built with Next.js 15, TypeScript, Tailwind CSS, shadcn/ui, and LangChain with support for multiple AI providers and advanced features.

## ✨ Features

- 🚀 **Next.js 15** with App Router and Turbopack
- 🎨 **Tailwind CSS v4** for modern styling
- 🧩 **shadcn/ui** components for beautiful UI
- 🤖 **Multiple AI Providers**:
  - OpenAI (GPT-4o, GPT-4o-mini)
  - Groq (Llama 3.1) - Fast & Free
  - Hugging Face models
  - Extensible architecture for more providers
- 🎤 **Speech-to-Text** with Web Speech API
- 🔊 **Text-to-Speech** with Web Speech Synthesis
- 📱 **Responsive** design that works on all devices
- ⚡ **Real-time streaming** responses
- 📝 **Markdown support** with syntax highlighting
- 🎯 **Provider switching** during conversations
- 💾 **Session persistence** (chat history maintained)
- 🔒 **Type-safe** with full TypeScript support

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- API keys for your chosen AI providers:
  - **OpenAI**: Get at [platform.openai.com](https://platform.openai.com)
  - **Groq**: Free at [console.groq.com](https://console.groq.com)
  - **Hugging Face**: Free at [huggingface.co](https://huggingface.co/settings/tokens)

### Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd mds-chatbot
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
Create a `.env.local` file in the root directory and add your API keys:
```env
# OpenAI Configuration (Optional)
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-4o-mini
OPENAI_TEMPERATURE=0.7
OPENAI_MAX_TOKENS=1000

# Groq Configuration (Optional - Free tier available)
GROQ_API_KEY=your_groq_api_key_here

# Hugging Face Configuration (Optional)
HUGGINGFACE_API_KEY=your_huggingface_api_key_here
```

**Note**: You only need to configure the API keys for the providers you want to use. The app will show available providers based on configured keys.

4. Run the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `OPENAI_API_KEY` | Your OpenAI API key | - | No* |
| `OPENAI_MODEL` | OpenAI model to use | `gpt-4o-mini` | No |
| `OPENAI_TEMPERATURE` | Response creativity (0.0-1.0) | `0.7` | No |
| `OPENAI_MAX_TOKENS` | Maximum response length | `1000` | No |
| `GROQ_API_KEY` | Your Groq API key | - | No* |
| `HUGGINGFACE_API_KEY` | Your Hugging Face token | - | No* |

*At least one AI provider API key is required for the app to function.

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── chat/              # OpenAI chat endpoint
│   │   ├── chat-direct/       # Direct OpenAI API endpoint
│   │   ├── chat-groq/         # Groq API endpoint
│   │   ├── chat-simple/       # Simplified chat endpoint
│   │   ├── chat-free/         # Free provider endpoint
│   │   └── test/              # API testing endpoint
│   ├── globals.css            # Global styles
│   ├── layout.tsx             # Root layout
│   └── page.tsx               # Home page
├── components/
│   ├── ui/                    # shadcn/ui components
│   │   ├── avatar.tsx
│   │   ├── badge.tsx
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── input.tsx
│   │   ├── scroll-area.tsx
│   │   └── textarea.tsx
│   ├── ai-provider-selector.tsx  # Provider selection UI
│   └── chat-interface.tsx        # Main chat component
├── hooks/
│   └── use-speech.ts          # Speech recognition & synthesis
└── lib/
    └── utils.ts               # Utility functions
```

## Technology Stack

- **Framework**: Next.js 15 with Turbopack
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS v4
- **UI Components**: shadcn/ui with Radix UI
- **AI Libraries**: 
  - LangChain for OpenAI integration
  - Groq SDK for Groq API
  - Hugging Face Inference API
- **Speech**: Web Speech API (Recognition & Synthesis)
- **Markdown**: react-markdown with syntax highlighting
- **Icons**: Lucide React
- **Development**: ESLint, PostCSS

## Usage

### Basic Chat
1. Start a conversation by typing in the chat input
2. Press Enter or click Send to submit your message
3. The AI assistant will respond with streaming text
4. Chat history is maintained during the session

### AI Provider Selection
1. Use the provider selector at the top to switch between AI providers
2. Each provider offers different models and capabilities:
   - **OpenAI**: Most advanced, requires paid API key
   - **Groq**: Fast responses, free tier available
   - **Hugging Face**: Open source models, free tier available

### Speech Features
1. **Speech-to-Text**: Click the microphone button to start voice input
2. **Text-to-Speech**: Enable auto-speak to have responses read aloud
3. **Browser Support**: Requires modern browser with Web Speech API

### Keyboard Shortcuts
- `Enter`: Send message
- `Shift + Enter`: New line
- `Escape`: Stop speech recognition (if active)

## Customization

### Adding New AI Providers
1. Create a new API route in `src/app/api/your-provider/route.ts`
2. Add the provider to the selector in `ai-provider-selector.tsx`
3. Configure any required environment variables

### Changing AI Models
Update environment variables for different models:
- **OpenAI**: `gpt-4o`, `gpt-4o-mini`, `gpt-3.5-turbo`
- **Groq**: `llama-3.1-70b-versatile`, `llama-3.1-8b-instant`

### Modifying System Prompts
Edit the system messages in respective API route files to change AI behavior and personality.

### Styling & Theming
- **Global Styles**: `src/app/globals.css`
- **Component Themes**: Modify shadcn/ui components in `src/components/ui/`
- **Tailwind Config**: `tailwind.config.ts`
- **shadcn/ui Config**: `components.json`

### Speech Settings
Customize speech features in `src/hooks/use-speech.ts`:
- Recognition language
- Synthesis voice
- Speech rate and pitch

## API Endpoints

| Endpoint | Provider | Description |
|----------|----------|-------------|
| `/api/chat` | OpenAI | LangChain integration with OpenAI |
| `/api/chat-direct` | OpenAI | Direct OpenAI API calls |
| `/api/chat-groq` | Groq | Fast Llama 3.1 models |
| `/api/chat-simple` | OpenAI | Simplified OpenAI endpoint |
| `/api/chat-free` | Placeholder | For free AI services |
| `/api/test` | OpenAI | API testing and health check |

## Browser Compatibility

### Core Features
- **Modern browsers**: Chrome 80+, Firefox 75+, Safari 13+, Edge 80+
- **Mobile**: iOS Safari 13+, Chrome Mobile 80+

### Speech Features
- **Speech Recognition**: Chrome, Edge, Safari (with user permission)
- **Speech Synthesis**: All modern browsers
- **Note**: Speech features require HTTPS in production

## Troubleshooting

### Common Issues

1. **"API key not configured" error**
   - Ensure your `.env.local` file contains the required API keys
   - Restart the development server after adding environment variables

2. **Speech recognition not working**
   - Check browser compatibility
   - Ensure microphone permissions are granted
   - Use HTTPS in production (required for speech features)

3. **Build errors**
   - Run `npm run lint` to check for TypeScript/ESLint issues
   - Ensure all dependencies are installed with `npm install`

4. **Streaming responses not working**
   - Check network connectivity
   - Verify API endpoints are accessible
   - Check browser console for errors

## Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Connect your repository to Vercel
3. Add your environment variables in the Vercel dashboard
4. Deploy!

**Important**: Make sure to add all required API keys as environment variables in your deployment platform.

### Other Platforms

The app can be deployed to any platform that supports Next.js:
- **Netlify**: Full support for Next.js
- **Railway**: Easy deployment with environment variables
- **DigitalOcean App Platform**: Container-based deployment
- **Docker**: Use the included Dockerfile for containerization

### Environment Variables in Production
Remember to set these in your deployment platform:
- `OPENAI_API_KEY` (if using OpenAI)
- `GROQ_API_KEY` (if using Groq)
- `HUGGINGFACE_API_KEY` (if using Hugging Face)

## Performance Considerations

- **Streaming**: All providers support real-time response streaming
- **Caching**: API responses can be cached based on your needs
- **Rate Limits**: Be aware of provider-specific rate limits
- **Bundle Size**: The app is optimized with Next.js code splitting

## Development

### Available Scripts

```bash
# Development server with Turbopack
npm run dev

# Production build
npm run build

# Start production server
npm run start

# Lint code
npm run lint
```

### Development Tips

1. **Hot Reload**: Turbopack provides instant hot reload for faster development
2. **Type Safety**: TypeScript is configured for strict type checking
3. **Code Quality**: ESLint and Prettier are configured for consistent code style
4. **Component Development**: Use shadcn/ui CLI to add new components

### Adding New Components

```bash
# Add shadcn/ui components
npx shadcn@latest add [component-name]

# Example: Add a dialog component
npx shadcn@latest add dialog
```

## Contributing

We welcome contributions! Here's how to get started:

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Make your changes** and ensure they follow the code style
4. **Add tests** if applicable
5. **Run the linter**: `npm run lint`
6. **Test your changes**: `npm run build`
7. **Commit your changes**: `git commit -m 'Add amazing feature'`
8. **Push to the branch**: `git push origin feature/amazing-feature`
9. **Submit a pull request**

### Contribution Guidelines

- Follow the existing code style and conventions
- Add TypeScript types for new features
- Update documentation for significant changes
- Test your changes across different browsers
- Ensure accessibility standards are maintained

## License

This project is open source and available under the [MIT License](LICENSE).

## Support

If you encounter any issues or have questions, please open an issue on GitHub.
