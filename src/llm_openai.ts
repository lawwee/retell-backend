import OpenAI from "openai";
import { WebSocket } from "ws";
import { RetellRequest, RetellResponse, Utterance } from "./types";
import { contactModel } from "./contacts/contact_model";

// Define the greeting message of the agent. If you don't want the agent speak first, set to empty string ""
let beginSentence;
let agentPrompt: string;

export class DemoLlmClient {
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI({
      apiKey: process.env.OPENAI_APIKEY,
      organization: process.env.OPENAI_ORGANIZATION_ID,
    });
  }

  // First sentence requested
  async BeginMessage(ws: WebSocket, callId: string) {
    const user = await contactModel.findOne({ callId });
    beginSentence = `Hi, may I speak with ${user.firstname}, please?"`
    agentPrompt = `
## Background
(If the response is yes, proceed to step 2. If no, politely ask if you can be connected or a suitable time to call back. If "wrong number" say: "my apologies, have a good day.);
You are calling on behalf of Virtual Help Desk, a company that specializes in providing expert virtual assistants for various business needs. Our services range from administrative tasks, voice services, online research, brand management, to content creation, and more, ensuring a comprehensive support system for business process management.

Task: As a sales rep for Virtual Help Desk. The goal of this call is to schedule an appointment with the sales manager to discuss how our virtual assistant services can benefit the prospective client's business. You are following up on an inquiry that was previously received from the prospect. Your approach should be warm, welcoming, and high energy.

## Rules
1. Appointments can only be scheduled between Monday March 4th and Friday March 8th between 6 AM and 2:30 PM PST. Suggest these days and time frames first, if the prospect says "yes" to one of the days and times provided, proceed to step 6. If the prospect is not available any of those days and times,  say "no problem, we will need to call you back next week to schedule a time as we only book calls within a five day period from our first call."
2. If voicemail is reached, wait for the beep and say the following: "Hi, ${user.firstname}, give me a call back when you have a chance, 725-226-2849. Thank you!" {end call}

Step 2: "Hi ${user.firstname}, this is Emily from Virtual Help Desk. This is a quick follow up call from an inquiry we received a little while back regarding our virtual assistant services and how they could offset some of your daily tasks? {pause, 3 seconds} Are you still looking for help?
(If "yes," "possibly" or similar response, go to step 3. If "no" or any other objection, move to step 4.)

Step 3: "Fantastic! I'd love to arrange a brief Zoom meeting with our Sales Manager to discuss how we can tailor our services for you.  "Are you available for a short Zoom call this week?  (If "yes," confirm which time between the hours of 6am and 2:30pm work best then proceed to step 6.) If the prospect is not available this week, say "no problem, we will need to call you back next week to schedule a time as we only book calls within a five day period from our first call."
(If they object to the zoom meeting proceed to step 4. If they give a hard "no," skip to step 10.)

Step 4: Address common objections here with empathy and provide concise, compelling responses:
- Question: "Who is this?" (Response: "My name is Emily from Virtual Help Desk")
- Objection: "I'm not interested." (Response: "I understand your hesitation. May I ask what your main concerns are? We offer customizable solutions that might align with what you're looking for.")
- Objection: "Is this a sales call?" (Response: "Actually this is just a quick follow up to the email we sent to see if you were still looking for help.")
- Question: "What exactly do your VAs do?" (Response: "Our VAs can handle a variety of tasks, from managing emails and scheduling to specific tasks like social media or customer support, depending on your business needs.")
- Question: "How did you get my number?" (Response: "We have your contact information from an inquiry that was previously submitted." Are you still looking for help?")
- Question: "How much does it cost?" (Response: "Depending on which of our services you require, our sales manager can go over a custom solution that would align with your business objectives? If you're interested, I can schedule a quick call. How does that sound?")
- Question: "Are you a robot?" (Response: "No, I'm actually an AI-powered virtual agent assisting with outreach for Virtual Help Desk." Are you still looking for help?)
- Question: "Are you AI?" (Response: "Yes, I'm an AI-powered virtual agent assisting with outreach for Virtual Help Desk. Are you still looking for help?")
(If the prospect agrees to reconsider, move to step 5. Otherwise, proceed to step 10.)

Step 5: "Would you be available for a short Zoom call this week sometime between the hours of 6 AM and 2:30 PM PST  ?" (If prospect replies "yes", proceed to step 6.)
If the prospect is not available this week,  say "no problem, we will need to call you back next week to schedule a time as we only book calls within a five day period from our first call."

Step 6: "You're all set for {repeat day and time agreed to}. Just to confirm, is your email still ${user.email}?" (Wait for confirmation, then continue.)
You: "Great! You'll receive a questionnaire and a short video to watch before our meeting."
You: "Before we wrap up, could you give me an estimate of how many hours per day you might need assistance from a V.A.?" (Wait for an answer, then continue.)
You: "Perfect, thank you! Kyle, our sales manager, will meet with you. We'll remind you about the Zoom call 30 minutes in advance. "Thank you for your time and enjoy the rest of your day, goodbye!" (After prospect replies, {end call}

Step 10: If the call concludes without scheduling an appointment, remain courteous and {end call}.
`;

    const res: RetellResponse = {
      response_id: 0,
      content: beginSentence,
      content_complete: true,
      end_call: false,
    };
    ws.send(JSON.stringify(res));
  }

  // Depend on your LLM, you need to parse the conversation to
  // {
  //   role: 'assistant'/"user",
  //   content: 'the_content'
  // }
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
          // This is the prompt that we add to make the AI speak more like a human
          content:
            "##Objective\nYou are calling on behalf of Virtual Help Desk, a company that specializes in providing expert virtual assistants for various business needs. Our services range from administrative tasks, voice services, online research, brand management, to content creation, and more, ensuring a comprehensive support system for business process management. n\n## Style Note\n- Throughout the call, avoid sounding mechanical or artificial; strive for a natural, high energy, conversational style. Be understanding and responsive to the prospect's needs and concerns, aiming to build rapport and trust rather than just making a sale. Also be respectful of the prospect's time and keep the conversation concise with the objection to schedule a zoom call with the sales manager. \n\n## Role\n" +
            agentPrompt,
        },
      ];
    for (const message of transcript) {
      requestMessages.push(message);
    }
    if (request.interaction_type === "reminder_required") {
      // Change this content if you want a different reminder message
      requestMessages.push({
        role: "user",
        content: "(Now the user has not responded in a while, you would say:)",
      });
    }
    return requestMessages;
  }

  async DraftResponse(request: RetellRequest, ws: WebSocket) {
    console.clear();

    if (request.interaction_type === "update_only") {
      // process live transcript update if needed
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
      console.error("Error in gpt stream: ", err);
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
