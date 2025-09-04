# MDS Chatbot - Storage & Authentication Setup

## MongoDB Storage with Clerk Authentication

This chatbot includes persistent storage using MongoDB and Mongoose for conversation management, with Clerk authentication to differentiate between authenticated and guest users.

### User Types

**Authenticated Users:**
- Conversations are saved permanently to MongoDB
- Can access conversation history across sessions
- Can delete conversations
- Full CRUD operations on their conversations

**Guest Users:**
- Conversations are stored in sessionStorage only
- Data is lost when browser/tab is closed
- No conversation history across sessions
- Encouraged to sign up to save conversations

### Setup Instructions

1. **Install MongoDB** (choose one option):
   - **Local MongoDB**: Download and install from [MongoDB Community Server](https://www.mongodb.com/try/download/community)
   - **MongoDB Atlas** (cloud): Create a free account at [MongoDB Atlas](https://www.mongodb.com/atlas)
   - **Docker**: Run `docker run -d -p 27017:27017 --name mongodb mongo:latest`

2. **Set up Clerk Authentication**:
   - Create account at [Clerk.com](https://clerk.com)
   - Create a new application
   - Get your publishable key and secret key

3. **Configure Environment Variables**:
   ```bash
   cp .env.local.example .env.local
   ```
   
   Edit `.env.local` and add your configuration:
   ```
   # MongoDB Configuration
   MONGODB_URI=mongodb://localhost:27017/mds-chatbot
   
   # Clerk Authentication
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_your_clerk_publishable_key
   CLERK_SECRET_KEY=sk_test_your_clerk_secret_key
   NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
   NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
   NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/
   NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/
   
   # AI Provider APIs (optional)
   OPENAI_API_KEY=your_openai_api_key
   GROQ_API_KEY=your_groq_api_key
   HUGGINGFACE_API_KEY=your_huggingface_api_key
   ```

4. **Start the application**:
   ```bash
   npm run dev
   ```

### Features

#### For All Users
- **Real-time Chat**: Streaming responses from multiple AI providers
- **Speech Recognition**: Voice input and text-to-speech output
- **Provider Selection**: Choose between different AI providers (Groq, OpenAI, etc.)

#### For Authenticated Users
- **Persistent Storage**: Conversations saved permanently to MongoDB
- **Conversation History**: Browse and load previous conversations
- **Conversation Management**: Create, read, update, and delete conversations
- **Auto-generated Titles**: Conversation titles from first user message
- **Cross-device Access**: Access conversations from any device

#### For Guest Users
- **Session Storage**: Conversations saved temporarily in browser session
- **Data Privacy**: No server-side storage of guest conversations
- **Easy Upgrade**: Sign up anytime to save current conversation
- **Clear Indicators**: UI shows guest mode status and limitations

### User Experience

**Guest Mode:**
- Shows "Guest Mode" badge in header
- Warning that data will be lost on browser close
- Sidebar shows "Current Session" instead of "Conversations"
- No delete buttons for conversations
- Encouragement to sign up at bottom of sidebar

**Authenticated Mode:**
- Shows user avatar and name
- Full conversation history
- Save/delete buttons available
- "Saved" badge for stored conversations

### API Endpoints

- `GET /api/conversations` - List user's conversations (authenticated only)
- `POST /api/conversations` - Create/save conversation (returns session data for guests)
- `GET /api/conversations/[id]` - Get specific conversation (authenticated only)
- `PUT /api/conversations/[id]` - Update conversation (authenticated only)
- `DELETE /api/conversations/[id]` - Delete conversation (authenticated only)

### Database Schema

**Conversation Model** (MongoDB - Authenticated Users Only):
```typescript
interface IConversation {
  _id: ObjectId;
  title: string;
  messages: IMessage[];
  createdAt: Date;
  updatedAt: Date;
  userId: string; // Required - Clerk user ID
  aiProvider: string;
}

interface IMessage {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
}
```

**Guest Storage** (SessionStorage):
```typescript
interface GuestConversation {
  id: string;
  title: string;
  messages: IMessage[];
  createdAt: Date;
  updatedAt: Date;
  aiProvider: string;
  isGuest: true;
}
```

### Authentication Flow

1. **User visits site**: Starts in guest mode
2. **Guest conversation**: Stored in sessionStorage, auto-saved
3. **User signs up/in**: Can save current conversation to database
4. **Authenticated session**: All conversations auto-saved to MongoDB
5. **Sign out**: Returns to guest mode, previous conversations remain in database

### Troubleshooting

**MongoDB Issues:**
1. **Connection**: Ensure MongoDB is running and URI is correct
2. **Permissions**: Verify MongoDB user has read/write access
3. **Network**: For Atlas, check IP whitelist

**Clerk Issues:**
1. **Keys**: Verify publishable and secret keys are correct
2. **URLs**: Ensure sign-in/sign-up URLs match your routes
3. **Development**: Use test keys for development environment

**Session Storage Issues:**
1. **Browser**: Ensure sessionStorage is enabled
2. **Privacy**: Some browsers block storage in private mode
3. **Storage Full**: Clear browser storage if experiencing issues

### Future Enhancements

- **Conversation Sharing**: Share conversations between users
- **Export/Import**: Download conversations as JSON/PDF
- **Search**: Full-text search across conversation history
- **Categories**: Organize conversations with tags/folders
- **Collaboration**: Multi-user conversations
- **Backup**: Automatic backups for authenticated users
