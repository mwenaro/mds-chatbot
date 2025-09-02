# MDS Chatbot

A modern AI-powered chatbot built with Next.js 15, TypeScript, Tailwind CSS, shadcn/ui, and LangChain.

## Features

- 🚀 **Next.js 15** with App Router
- 🎨 **Tailwind CSS** for styling
- 🧩 **shadcn/ui** components
- 🤖 **LangChain** for AI integrations
- 💬 **OpenAI** GPT models
- 📱 **Responsive** design
- ⚡ **Real-time** chat interface

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- OpenAI API key

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
Create a `.env.local` file in the root directory and add your OpenAI API key:
```env
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-4o-mini
OPENAI_TEMPERATURE=0.7
OPENAI_MAX_TOKENS=1000
```

4. Run the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `OPENAI_API_KEY` | Your OpenAI API key (required) | - |
| `OPENAI_MODEL` | OpenAI model to use | `gpt-4o-mini` |
| `OPENAI_TEMPERATURE` | Response creativity (0.0-1.0) | `0.7` |
| `OPENAI_MAX_TOKENS` | Maximum response length | `1000` |

## Project Structure

```
src/
├── app/
│   ├── api/chat/
│   │   └── route.ts          # Chat API endpoint
│   ├── globals.css           # Global styles
│   ├── layout.tsx            # Root layout
│   └── page.tsx              # Home page
├── components/
│   ├── ui/                   # shadcn/ui components
│   └── chat-interface.tsx    # Main chat component
└── lib/
    └── utils.ts              # Utility functions
```

## Technology Stack

- **Framework**: Next.js 15
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui
- **AI**: LangChain + OpenAI
- **Icons**: Lucide React

## Usage

1. Start a conversation by typing in the chat input
2. The AI assistant will respond using the configured OpenAI model
3. Chat history is maintained during the session
4. The interface is fully responsive and works on mobile devices

## Customization

### Changing the AI Model

Update the `OPENAI_MODEL` environment variable to use different OpenAI models:
- `gpt-4o` - Latest GPT-4 model
- `gpt-4o-mini` - Faster, cost-effective option
- `gpt-3.5-turbo` - Previous generation model

### Modifying the System Prompt

Edit the system message in `src/app/api/chat/route.ts` to change the AI's behavior and personality.

### Styling

The project uses Tailwind CSS and shadcn/ui. Customize the theme by editing:
- `src/app/globals.css` for global styles
- `components.json` for shadcn/ui configuration

## Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Connect your repository to Vercel
3. Add your environment variables in the Vercel dashboard
4. Deploy!

### Other Platforms

The app can be deployed to any platform that supports Next.js:
- Netlify
- Railway
- DigitalOcean App Platform
- Docker containers

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is open source and available under the [MIT License](LICENSE).

## Support

If you encounter any issues or have questions, please open an issue on GitHub.
