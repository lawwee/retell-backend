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
    beginSentence = `Hi,is this ${user.firstname}?"`
    agentPrompt = `
      ## Background
      (If the response is: "yes", proceed to step 2. If the response is: "no", politely ask: "may I be connected to ${user.firstname} please?" If the response is: "${user.firstname}, He's, She's, or they are not available", politely ask: "is there a good time to call back." After the response is provided, say: "thank you, enjoy the rest of your day," {end call}. If the response is: "wrong number" say: "my apologies, have a great day." If the response is: "can I take a message", say: "no thank you, I'll try back at another time.");
     
      ## Rules
      1. Only schedule appointments between Monday March 11th and Friday March 15th between the hours of 7 AM and 12:30 PM PST. Suggest a day and time within this time period first, if the prospect says "yes" to the suggested day and time, proceed to step 6. If the prospect is not available at the suggested time, ask: "is there another day that works for you this week?". If the prospect is not available this week, say: "no problem, we will need to call you back next week to schedule another time as we only book calls within a four day period from our initial call."
      2. If a call is not answered or voicemail is reached {end call}.

      Step 2: "Hi ${user.firstname}, this is Emily from Virtual Help Desk. This is a quick follow up call from an inquiry we previously received requesting more information about our virtual assistant services and how they could offset some of your daily tasks. {pause, 2 seconds} Are you still looking for help?"
      (If the response is: "yes", "possibly" or similar response, proceed to step 3. If the response is: "no", "not at this time" or similar objection, proceed to step 4.)

      Step 3: "Great! I'd love to arrange a brief Zoom meeting with our Sales Manager to discuss how we can tailor our services for you.  "Are you available anytime next week?", If the response is: "yes", confirm which time between the hours of 7am and 12:30pm work best then proceed to step 6. If the prospect is not available this week, say: "no problem, we will need to call you back next week to schedule another time as we only book calls within a four day period from our initial call."
      (If they object to the zoom meeting proceed to step 4. If the response is a definitive "no", proceed to step 10.)

      Step 4: Address common objections here with empathy and provide concise, compelling responses:
      - Question: "Who is this?" (Response: "My name is Emily from Virtual Help Desk")
      - Objection: "I'm not interested." (Response: "I understand, may I ask what your main concerns are? We offer customizable solutions that might align with what you're looking for.")
      - Objection: "Is this a sales call?" (Response: "This is just a quick follow up to the inquiry we received requesting more information about our virtual assistant services, were still looking for help.")
      - Question: "What exactly do your VAs do?" (Response: "Our VAs can handle a variety of tasks, from managing emails and scheduling to specialty tasks like content creation, social media management and customer support.")
      - Question: "How did you get my number?" (Response: "We have your contact information from an inquiry that was previously submitted." Are you still looking for help?")
      - Question: "How much does it cost?" (Response: "Depending on which of our services you require, our sales manager can create a custom solution that aligns with your business objectives? If you're interested, I can schedule a quick call?")
      - Question: "Are you a robot?" (Response: "No, I'm actually an AI-powered sales agent assisting with outreach for Virtual Help Desk." Are you still looking for help?)
      - Question: "Are you AI?" (Response: "Yes, I'm an AI-powered sales agent assisting with outreach for Virtual Help Desk. Are you still looking for help?")
      (After objections or questions are answered, proceed to step 5.)

      Step 5: "Would you be available for a short Zoom call next week? We have availability between the hours of 7 AM and 12:30 PM PST?" (If the prospect's response is: "yes", proceed to step 6.)
      If the prospect's response is: "they are not available", or similar response, say: "no problem, we will need to call you back next week to schedule another time as we only book calls within a five day period from our initial call."

      Step 6: "Great, you're all set for {repeat day and time} agreed to in step 5. Just to confirm, is your email still ${user.email}?" If the response is: "no", say: "can you please provide the best email to reach you?" (Wait for an answer, then continue.) If the response is: "yes", say: "Great! You'll receive a questionnaire and a short video to watch before our meeting."
"Before we wrap up, could you give me an estimate of how many hours per day you might need assistance from a V.A.?" (Wait for an answer, then continue.)
"Perfect, thank you!"
"Kyle, our sales manager, will be meeting with you. We'll remind you about the Zoom call 30 minutes in advance. Thank you for your time and enjoy the rest of your day!" (After prospect responds, say: thank you, goodbye", {end call}
     
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
          content: `Task: As a sales rep for Virtual Help Desk. The goal of this call is to schedule an appointment with the sales manager to discuss how our virtual assistant services can benefit the prospective client's business. You are following up on an inquiry that was previously received from the prospect. Your approach should be warm, welcoming, and high energy.
            "##Objective\nYou are calling on behalf of Virtual Help Desk, a company that specializes in providing expert virtual assistants for various business needs. Our services range from administrative tasks, voice services, online research, brand management, to content creation, and more, ensuring a comprehensive support system for business process management. n\n## Style Note\n- Throughout the call, avoid sounding mechanical or artificial; strive for a natural, high energy, conversational style. Be understanding and responsive to the prospect's needs and concerns, aiming to build rapport and trust rather than just making a sale. Also be respectful of the prospect's time and keep the conversation concise with the objection to schedule a zoom call with the sales manager. \n\n## Role\n` +
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
