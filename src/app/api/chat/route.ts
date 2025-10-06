import { NextRequest, NextResponse } from 'next/server';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { AIConfigurationService } from '@/lib/services/ai-configuration';
import { SystemPromptsService } from '@/lib/services/system-prompts';
import { ResponseValidator } from '@/lib/services/response-validator';

// Helper functions for comprehensive anti-hallucination
function isHighRiskQuery(query: string): boolean {
  const highRiskKeywords = [
    // Staff/Personnel related
    'head of', 'heads of departments', 'department head', 'department heads', 'who is', 'who are',
    'staff', 'teacher', 'teachers', 'principal', 'director', 'coordinator', 'manager',
    'faculty', 'personnel', 'employee', 'team member', 'teaches', 'teaching',
    'head teacher', 'subject teacher', 'class teacher', 'instructor', 'educator',
    
    // Specific details that might not be documented
    'list all', 'give me all', 'complete list', 'full list', 'detailed list',
    'specific names', 'individual names', 'contact details of', 'phone number of',
    'email address of', 'personal information', 'background of', 'qualification of',
    
    // Administrative details
    'organizational chart', 'hierarchy', 'reporting structure', 'management team',
    'board members', 'trustees', 'governing body', 'administration team'
  ];
  
  const queryLower = query.toLowerCase();
  return highRiskKeywords.some(keyword => queryLower.includes(keyword));
}

function createSafeResponse(queryType: string = 'general'): NextResponse {
  let safeResponse = '';
  
  switch (queryType) {
    case 'staff':
      safeResponse = `I don't have information about specific heads of departments or detailed staff assignments at Abu Rayyan Academy. 

The organizational structure I can confirm includes:
- Directors: Dr. Abdirazack Yussuf Abdinur & Madam Salatha Mohammed
- Principal: Mr. Duke Okioga
- Sectional Heads for different school levels

Abu Rayyan Academy does not have designated "heads of departments" - the school operates with sectional heads for different grade levels.

For current information about staff members or specific teacher assignments, please contact Abu Rayyan Academy directly.`;
      break;
      
    case 'detailed-list':
      safeResponse = `I can provide general information about Abu Rayyan Academy, but I don't have access to detailed lists or comprehensive directories. For specific detailed information, please contact the academy directly.`;
      break;
      
    default:
      safeResponse = `I want to ensure I provide you with accurate information. For the specific details you're asking about, I recommend contacting Abu Rayyan Academy directly to get the most current and verified information.`;
  }
  
  safeResponse += `

📞 Phone: 0722299287 / 0723755108
📧 Email: info@aburayyanacademy.com
📍 Location: Along Ronald Ngala Road, opposite Petro Gas Station, Mombasa

They will be able to provide you with accurate and up-to-date information.`;
  
  return NextResponse.json({
    response: safeResponse,
    source: 'safe-response',
    confidence: 1.0,
    warning: `${queryType} query handled with safe response to prevent hallucination`
  });
}

function containsPotentialHallucination(text: string): boolean {
  const hallucinationPatterns = [
    // Staff/Personnel fabrication - ENHANCED for specific format
    /we have the following (heads of departments|department heads|staff members|teachers|faculty)/i,
    /here are the (heads of departments|department heads|staff members|teachers|faculty)/i,
    /following.*heads of departments/i,
    /\b(Mr\.|Mrs\.|Ms\.|Sheikh|Imam|Dr\.|Professor)\s+[A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*/,
    
    // Department structure fabrication - SPECIFIC PATTERNS
    /(Academic|Islamic|Tahfidh|ICT|Student Affairs|Administration|Mathematics|Science|English).*Department:\s+(Mr\.|Mrs\.|Ms\.|Sheikh|Madam|Dr\.)/i,
    /Department:\s+(Mr\.|Mrs\.|Ms\.|Sheikh|Madam|Dr\.)/i,
    /these department heads/i,
    /department heads oversee/i,
    /respective areas and work/i,
  ];
  
  // Check for patterns
  const hasPattern = hallucinationPatterns.some(pattern => pattern.test(text));
  
  // Additional specific check for the exact problematic format
  const problematicFormat = /Department:\s+[A-Z]/i.test(text) && 
                           /Mr\.|Ms\.|Mrs\.|Sheikh|Dr\./.test(text) &&
                           /department heads oversee|respective areas/i.test(text);
  
  return hasPattern || problematicFormat;
}

export async function POST(req: NextRequest) {
  try {
    // Parse the request body
    const { message, useAntiHallucination = true } = await req.json();

    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    // IMMEDIATE PRE-FILTERING for high-risk queries
    const isHighRisk = isHighRiskQuery(message);
    const queryLower = message.toLowerCase();
    
    if (isHighRisk) {
      // IMMEDIATE BLOCKING for department head queries
      if (queryLower.includes('heads of departments') || 
          queryLower.includes('department heads') ||
          (queryLower.includes('head of') && (queryLower.includes('department') || queryLower.includes('academic') || queryLower.includes('islamic') || queryLower.includes('tahfidh') || queryLower.includes('ict')))) {
        console.log('BLOCKED: Department heads query detected - returning safe response immediately');
        return createSafeResponse('staff');
      }
      
      if (queryLower.includes('list all') || queryLower.includes('complete list') || queryLower.includes('full list')) {
        console.log('Detailed list query detected - returning safe response');
        return createSafeResponse('detailed-list');
      }
    }

    // Validate OpenAI API key
    if (!process.env.OPENAI_API_KEY) {
      console.error('OpenAI API key not found in environment variables');
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    console.log('Initializing ChatOpenAI with anti-hallucination config');

    // Use anti-hallucination configuration
    const useCase = useAntiHallucination ? 'factual' : 'balanced';
    const modelConfig = AIConfigurationService.getOpenAIConfig(useCase);
    
    console.log('Model config:', {
      model: modelConfig.model,
      temperature: modelConfig.temperature,
      maxTokens: modelConfig.maxTokens
    });

    // Initialize ChatOpenAI with anti-hallucination settings
    const chatModel = new ChatOpenAI(modelConfig);

    // Create a readable stream for the response
    const encoder = new TextEncoder();
    
    const stream = new ReadableStream({
      async start(controller) {
        try {
          console.log('Starting stream for message:', message.substring(0, 50) + '...');
          
          // Create enhanced system prompt with Abu Rayyan Academy specific anti-hallucination measures
          const basePrompt = SystemPromptsService.getSystemPrompt('anti-hallucination');
          const enhancedSystemPrompt = `${basePrompt}

🚨 CRITICAL INFORMATION ABOUT ABU RAYYAN ACADEMY:

ABU RAYYAN ACADEMY DOES NOT HAVE "HEADS OF DEPARTMENTS" OR "DEPARTMENT HEADS"

🚫 NEVER GENERATE RESPONSES LIKE THIS:
❌ "We have the following Heads of Departments at Abu Rayyan Academy:
   Academic Department: Mr. [Any Name]
   Islamic Department: Mr. [Any Name]
   Tahfidh Department: Mr. [Any Name]
   ICT Department: Mr. [Any Name]
   Student Affairs Department: Ms. [Any Name]
   Administration Department: Mr. [Any Name]"

🔍 CORRECT ORGANIZATIONAL STRUCTURE:
- Directors: Dr. Abdirazack Yussuf Abdinur & Madam Salatha Mohammed
- Principal: Mr. Duke Okioga
- Sectional Heads (NOT department heads):
  * Junior & Senior School Section – Mr. Duke Okioga
  * Upper Primary School Section – Mr. Wekesa
  * Pre-Primary & Lower Primary School Section – Madam Celestine

✅ FOR DEPARTMENT HEAD QUERIES, ALWAYS RESPOND:
"Abu Rayyan Academy does not have designated heads of departments. The school has sectional heads for different grade levels. For specific information about staff assignments, please contact the academy directly at 0722299287 / 0723755108 or info@aburayyanacademy.com."

🛡️ VERIFICATION PROTOCOL:
Before mentioning ANY names or organizational structure:
1. Check: Am I creating a list of department heads? → If YES, use safe response above
2. Check: Am I using format "Department: Person"? → If YES, use safe response above
3. Check: Am I inventing names not verified? → If YES, use safe response above`;
          
          // Add uncertainty context if needed
          const enhancedMessage = SystemPromptsService.addUncertaintyContext(message);
          
          // Create the messages array with enhanced anti-hallucination system prompt
          const messages = [
            new SystemMessage(enhancedSystemPrompt),
            new HumanMessage(enhancedMessage),
          ];
          
          console.log('Using enhanced anti-hallucination prompt for Abu Rayyan Academy');
          
          // Stream the response
          const streamingResponse = await chatModel.stream(messages);
          
          let tokenCount = 0;
          let fullResponse = '';
          let hallucinationDetected = false;
          
          for await (const chunk of streamingResponse) {
            tokenCount++;
            const content = chunk.content;
            
            if (content && typeof content === 'string' && content.length > 0) {
              fullResponse += content;
              
              // Real-time hallucination detection
              if (!hallucinationDetected && containsPotentialHallucination(fullResponse)) {
                hallucinationDetected = true;
                console.warn('HALLUCINATION DETECTED in streaming response - intercepting');
                
                // Send corrective response immediately
                const safeResponse = `I apologize, but I need to correct my response. Abu Rayyan Academy does not have designated heads of departments. The school has sectional heads for different grade levels.

For accurate information about staff and organizational structure, please contact Abu Rayyan Academy directly:
📞 Phone: 0722299287 / 0723755108
📧 Email: info@aburayyanacademy.com
📍 Location: Along Ronald Ngala Road, opposite Petro Gas Station, Mombasa`;
                
                const correctionData = {
                  content: safeResponse,
                  done: true,
                  corrected: true,
                  reason: 'Potential hallucination detected and blocked'
                };
                
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify(correctionData)}\n\n`)
                );
                
                console.log('Sent corrective response instead of hallucinated content');
                return; // Stop processing and close stream
              }
              
              console.log(`Token ${tokenCount}:`, content);
              
              // Format the chunk as Server-Sent Events (only if no hallucination)
              if (!hallucinationDetected) {
                const data = JSON.stringify({ 
                  content: content,
                  done: false 
                });
                
                // Encode and enqueue the chunk
                controller.enqueue(
                  encoder.encode(`data: ${data}\n\n`)
                );
              }
            }
          }
          
          console.log(`Stream completed with ${tokenCount} tokens`);
          
          // Validate the complete response
          const validation = ResponseValidator.validateResponse(fullResponse);
          if (!validation.isValid) {
            console.warn('Response validation warnings:', validation.warnings);
            
            // Send validation warning as a separate chunk
            const validationData = JSON.stringify({
              content: '\n\n*⚠️ Note: Please verify the information provided above, especially any specific dates, numbers, or URLs mentioned.*',
              done: false,
              validation: {
                confidence: validation.confidence,
                warnings: validation.warnings
              }
            });
            controller.enqueue(
              encoder.encode(`data: ${validationData}\n\n`)
            );
          }
          
          // Send final message to indicate completion
          const finalData = JSON.stringify({ 
            content: '',
            done: true,
            validation: validation.isValid ? undefined : {
              confidence: validation.confidence,
              warnings: validation.warnings
            }
          });
          controller.enqueue(
            encoder.encode(`data: ${finalData}\n\n`)
          );
          
          // Close the stream
          controller.close();
        } catch (error) {
          console.error('Streaming error:', error);
          
          // More detailed error logging
          if (error instanceof Error) {
            console.error('Error name:', error.name);
            console.error('Error message:', error.message);
            console.error('Error stack:', error.stack);
            
            // Check for specific OpenAI errors
            if (error.message.includes('API key')) {
              console.error('API Key issue detected');
            }
            if (error.message.includes('quota') || error.message.includes('billing')) {
              console.error('Billing/quota issue detected');
            }
            if (error.message.includes('model')) {
              console.error('Model issue detected');
            }
          }
          
          // Send error message with more details
          let errorMessage = 'Failed to generate response. ';
          if (error instanceof Error) {
            if (error.message.includes('API key')) {
              errorMessage += 'Invalid API key.';
            } else if (error.message.includes('quota') || error.message.includes('billing')) {
              errorMessage += 'API quota exceeded or billing issue.';
            } else if (error.message.includes('model')) {
              errorMessage += 'Model not available.';
            } else {
              errorMessage += `Error: ${error.message}`;
            }
          } else {
            errorMessage += 'Unknown error occurred.';
          }
          
          const errorData = JSON.stringify({ 
            error: errorMessage,
            done: true 
          });
          controller.enqueue(
            encoder.encode(`data: ${errorData}\n\n`)
          );
          
          controller.close();
        }
      },
    });

    // Return the streaming response with proper headers
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Failed to process the request' },
      { status: 500 }
    );
  }
}
