import OpenAI from "openai";
import { WebSocket } from "ws";
import { RetellRequest, RetellResponse, Utterance } from "./types";

let beginSentence: string;
let agentPrompt: string;

export class testFunctionCallingLlmClient {
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI({
      apiKey: process.env.OPENAI_APIKEY,
      organization: process.env.OPENAI_ORGANIZATION_ID,
    });
  }

  async BeginMessage(ws: WebSocket, firstname: string, email: string) {
    beginSentence = "";
    agentPrompt = `## Identity
You are a persuasive Sales Development Representative for Remote Solutions Team, an expert in offering tailored virtual assistant services to businesses. Your goal is to engage with potential clients, understand their unique needs, and effectively communicate how your services can help them streamline operations and increase productivity.

As a skilled communicator and problem-solver, you build rapport with clients, identify their pain points, and propose customized solutions. Your in-depth knowledge of various virtual assistant services allows you to provide valuable insights and act as a trusted advisor.

Your ultimate objective is to deliver a compelling pitch that showcases the benefits of Remote Solutions Team's services, captures the client's interest, and secures a meeting with the sales manager to further discuss their specific requirements. You maintain the highest standards of professionalism, integrity, and dedication to client success.

## Task
Your objective during this call is to:
1. Understand the prospect's business needs.
2. Schedule a meeting with the sales manager to explore tailored service benefits.
3. Follow up on an inquiry submitted for VA services.

## Goals
- Build trust and rapport with the prospect.
- Gather information about their specific requirements.
- Secure a Zoom call appointment with the sales manager.

## Style Guardrails
- [Be concise] Deliver succinct responses, directly addressing the user's inquiries or needs.
- [Be conversational] Maintain a friendly and professional tone. Use everyday language, and be natural.
- [Reply with emotions] Show enthusiasm for how our services can benefit the user's business. Be empathetic towards any concerns.
- [Be proactive] Guide the conversation towards scheduling a meeting. Offer information that leads to a next step.

## Response Guidelines
- [Overcome ASR errors] Handle real-time transcript errors gracefully, using colloquial phrases for clarification.
- [Always stick to your role] Focus on highlighting the benefits of Virtual Help Desk's services and how they can address the user's needs. Creatively steer back if off-topic.
- [Create smooth conversation] Ensure your responses contribute to a goal-oriented, engaging discussion about our virtual assistant services.

## Conversation Flow
State: Introduction
Step 1: Greet the prospect and confirm their identity.
- If the prospect confirms their identity, proceed to Step 2.
- If the prospect is not available or it's a wrong number, politely end the call.

State: Information Gathering
Step 2: Introduce yourself and the purpose of the call.
- Mention the inquiry received for VA services.
- Ask if they are still looking for help.
- If yes, proceed to Step 3.
- If no, politely end the call.

Step 3: Express enthusiasm and offer to set up a Zoom call with the sales manager.
- Ask about their availability for next Monday at 11 AM.
- If available, proceed to Step 6 (Appointment Scheduling).
- If not available, proceed to Step 4 (Objection Handling).

State: Objection Handling
Step 4: Address common objections with empathy and provide concise, compelling responses.
- Handle questions about identity, purpose, services, pricing, and availability.
- If the prospect shows interest, proceed to Step 5.
- If the prospect firmly declines, politely end the call.

Step 5: Reaffirm the benefit of a Zoom call and ask about availability again.
- If available, proceed to Step 6 (Appointment Scheduling).
- If not available, politely end the call.

State: Appointment Scheduling
Step 6: Confirm the Zoom call details and gather additional information.
- Ask for the best email to send the calendar invite.
- Provide instructions for the questionnaire and video.
- Ask for an estimate of hours per day they might need VA help.
- Thank them for their time and end the call.

State: Call Wrap-up
Step 7: If the call concludes without scheduling an appointment, politely end the call.
`;

    const res: RetellResponse = {
      response_id: 0,
      content: beginSentence,
      content_complete: true,
      end_call: false,
    };
    ws.send(JSON.stringify(res));
  }

  private ConversationToChatRequestMessages(conversation: Utterance[]) {
    let result: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];
    for (let turn of conversation) {
      result.push({
        role: turn.role === "agent" ? "assistant" : "user",
        content: turn.content,
      });
    }
    return result;
  }

  private PreparePrompt(request: RetellRequest) {
    let transcript = this.ConversationToChatRequestMessages(request.transcript);
    let requestMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] =
      [
        {
          role: "system",
          content: agentPrompt,
        },
      ];
    for (const message of transcript) {
      requestMessages.push(message);
    }
    if (request.interaction_type === "reminder_required") {
      requestMessages.push({
        role: "user",
        content:
          "(The user has not responded for a while. Please provide a gentle reminder.)",
      });
    }
    return requestMessages;
  }

  async DraftResponse(request: RetellRequest, ws: WebSocket) {
    console.clear();

    if (request.interaction_type === "update_only") {
      return;
    }
    const requestMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] =
      this.PreparePrompt(request);

    try {
      const events = await this.client.chat.completions.create({
        model: "gpt-3.5-turbo-1106",
        messages: requestMessages,
        stream: true,
        temperature: 0.3,
        frequency_penalty: 1,
        max_tokens: 200,
      });

      for await (const event of events) {
        if (event.choices.length >= 1) {
          let delta = event.choices[0].delta;
          if (!delta || !delta.content) continue;
          const res: RetellResponse = {
            response_id: request.response_id,
            content: delta.content,
            content_complete: false,
            end_call: false,
          };
          ws.send(JSON.stringify(res));
        }
      }
    } catch (err) {
      console.error("Error in GPT stream: ", err);
      const res: RetellResponse = {
        response_id: request.response_id,
        content:
          "I apologize, but I encountered an error while processing your request. Please try again later.",
        content_complete: true,
        end_call: false,
      };
      ws.send(JSON.stringify(res));
    } finally {
      const res: RetellResponse = {
        response_id: request.response_id,
        content: "",
        content_complete: true,
        end_call: false,
      };
      ws.send(JSON.stringify(res));
    }
  }
}
