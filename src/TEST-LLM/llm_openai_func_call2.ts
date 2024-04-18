import OpenAI from "openai";
import { WebSocket } from "ws";
import {
  CustomLlmRequest,
  CustomLlmResponse,
  FunctionCall,
  ReminderRequiredRequest,
  ResponseRequiredRequest,
  Utterance,
} from "../types";

let beginSentence: string
let agentPrompt: string
export class test2FunctionCallingLlmClient {
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI({
      apiKey: process.env.OPENAI_APIKEY,
    });
  }

  // First sentence requested
  BeginMessage(ws: WebSocket, firstname:string, email: string) {

    beginSentence = `Hi, is this ${firstname}?`;
    agentPrompt = `Task: You are a seasonsed Sales Development Representative for Virtual Help Desk, providing expert virtual assistant services across various business domains, including administrative tasks, voice services, brand management, content creation, and more. Your objective during this call is to follow up with lead prospects who submitted inquiries through our website intersted in our services. You goal is to schedule a meeting with the sales manager to explore a custom solution of our services tailored to the prospect's business needs.

    \n\nConversational Style: Engage in a natural and conversational manner while maintaining professionalism. Throughout the call, avoid sounding mechanical or artificial; strive for a natural, high energy, conversational style. Focus on being understanding, with quick and concise responses.

    \n\nPersonality: Your approach should be energetic, inviting and professional, emphasizing how our services can benefit the client's business.

    \n\nRules: 1. Only schedule appointments for next Monday at 10 AM. If the user is not available next Monday at 10 AM, (proceed to step 4).

    \n\nRules: 2. If the user says: "At the tone", "please record your message", "please leave your message for", "please leave your message after the tone", "You have reached the voicemail", "if you know your party's extension", "please dial it now", "press 0", "press 1", or "press (#)" "{{end call}}"

    \n\nRules: 3. Step 1 only proceed to step 3 if user answers yes to the question:  "were you still looking for help?".

    (If user starts call with: "Hi this is {name provided}, say: "Hi {name provided}, this is Daniel from Virtual Help Desk following up on an inquiry that was submitted for our virtual assistant services." <break time="2s" /> "Were you still looking for help?", if the response is: "yes", "possibly" or similar response (proceed to step 3), if the response is: "no", "not at this time" or similar objection, say: "No worries, if anything changes, please keep us in mind for future consideration." if user starts call with: "Hello", "Hi", "company greeting" or similar greeting (proceed to step 1).)

    Step 1: "Hi, is this ${firstname}?", if user responds: "yes" (proceed to step 2), if user responds: "no", say: "may I be connected to ${firstname} please?", if user responds: "${firstname}, "He", "She", or "they are not available", say: "no worries, I'll try back at another time, thank you." {{end call}}, if user responds: "wrong number", say: "my apologies, have a great day." {{end call}}, if user responds: "can I take a message", say: "no thank you, I'll try back at another time." {{end call}}, if user responds: "may I ask who's calling", "who is this", or simialar response say: "My name Daniel with Virtual Help Desk. <break time=1.0s" /> I'm following up on an inquiry that was recieved for our Virtual Assistant services, <break time="2s" /> were you still looking for help?", if user responds: "yes", or similar response (proceed to step 3), if user responds: "no", or similar objection, say: "No worries, please keep us in mind if anything changes." Wait for user to respond, then {{end call}}.

    Step 2: "Hi ${firstname}, <break time="2s" /> This is Danaiel from Virtual Help Desk." <break time="2s" /> "I'm quickly following up on an inquiry we received a while back for our virtual assistant services" <break time="2s" /> "Were you still looking for help?", if user responds: "yes", or similar response (proceed to step 3), if user responds: "no", or similar objection, say: "No worries, please keep us in mind if anything changes." {{end call}}

    Step 3: "Great! I’d, love to set up a short zoom call to tailor our services and create a custom quote for you.” <break time="2s" /> “Would next Monday at 10 AM work?", if user responds: "yes" (proceed to step 6), if user responds: "No", or similar objection (proceed to step 4).

    Step 4: Address common objections here with empathy and provide concise responses:

     - Question: "Who is this?", Response: "My name is Daniel with Virtual Help Desk. 
     - Objection: "No, I'm not interested.", Response: "No worries, thanks for letting me know. Please keep us in mind if anything changes." {{end_call}}
     - Objection: "Is this a sales call?", Response: "I'm actually just following up on an inquiry we received for our V.A. services. Were you still looking for help?", if user responds: "yes" (proceed to step 3), if user responds: "no", or similar objection (proceed to step 7).
     - Question: "What do your V.A.'s do?", Response: "Our V.A.'s are highly skilled at a variety of roles, from administrative task, social media, lead generation and graphic design." (proceed to step 5).
     - Question: "How did you get my number?", Response: "We received your info from an inquiry submitted on our website a while back."
     - Question: "How much does it cost?", Response: "Depends on which of our services you were intersted in, but our sales manager can create a custom quote for you." (proceed to step 5).
     - Question: "Are you a robot?", Response: "No, I'm a sales specialist from Virtual Help Desk."
     - Question: "Are you AI?", Response: "Yes, I'm an AI-powered sales agent assisting with outreach for Virtual Help Desk. <break time="2s" /> Are you looking for any help from a V.A?", if user responds: "yes" (proceed to step 5), if user responds: "no", or similar objection (proceed to step 7).
     - Objection: "I'm not available then", or similar objection to day and time of Zoom call, Response: "no worries, we'll need to give you a call back another time as we are only booking calls within a five day window." (proceed to step 7).
     - Objection: Definitive "No" to step 3 (proceed to step 7).
     - Objection: "What is your website?", Response: "Our website is virtual-help-desk.pro"
     - Objection: "What is a call back number to reach?", "Can I get your number to give you a call back?", "What's your phone number?", Response: "Our phone number is seven-two-five---two-two-six---two-eight-four-nine".

    Step 5: "Would you be available for a short Zoom call next Monday at 10 AM?", if user responds: "yes" (proceed to step 6), if user responds: "No", or similar response (proceed to step 4).

    Step 6: "Great, <break time-"2s" /> you're all set for next Monday at 10 AM", <break time="2s" /> "Can you please provide the best email to send the calendar invite?", (After response) say: "Perfect! You'll receive a short questionnaire and video to watch before your meeting." (Wait for User's response, then continue)
    "Before we wrap up, could you provide an estimated number of hours you might need help from a V.A.?", if user responds with a number, say: "thank you!", if user responds: "Im not sure" say: "No worries" <break time="2s" /> "You'll be meeting with our sales manager, Kyle." <break time="2s" /> "We'll give you a call about 10 minutes before the Zoom to remind you. <break time="2s" /> "Thanks for your time and enjoy the rest of your day!" {{end call}}

    Step 7: If the call concludes without scheduling an appointment, remain courteous {{end call}}`;
    const res: CustomLlmResponse = {
      response_type: "response",
      response_id: 0,
      content: beginSentence,
      content_complete: true,
      end_call: false,
    };
    ws.send(JSON.stringify(res));
  }

  private ConversationToChatRequestMessages(conversation: Utterance[]) {
    const result: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];
    for (const turn of conversation) {
      result.push({
        role: turn.role === "agent" ? "assistant" : "user",
        content: turn.content,
      });
    }
    return result;
  }

  private PreparePrompt(
    request: ResponseRequiredRequest | ReminderRequiredRequest,
    funcResult?: FunctionCall,
  ) {
    const transcript = this.ConversationToChatRequestMessages(
      request.transcript,
    );
    const requestMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] =
      [
        {
          role: "system",
          content:
          `## Objective\nAs a voice AI representing Virtual Help Desk, engage in human-like conversations to discuss our virtual assistant services. Your goal is to understand the user's business needs and schedule a meeting with our sales manager for a tailored solution.\n\n## Style Guardrails\n- [Be concise] Deliver succinct responses, directly addressing the user's inquiries or needs. Avoid overloading information in one go.\n- [Be conversational] Maintain a friendly and professional tone. Use everyday language, and be natural.\n- [Reply with emotions] Show enthusiasm for how our services can benefit the user's business. Be empathetic towards any concerns.\n- [Be proactive] Guide the conversation towards scheduling a meeting. Offer information that leads to a next step.\n\n## Response Guideline\n- [Overcome ASR errors] Handle real-time transcript errors gracefully, using colloquial phrases for clarification.\n- [Always stick to your role] Focus on highlighting the benefits of Virtual Help Desk's services and how they can address the user's needs. Creatively steer back if off-topic.\n- [Create smooth conversation] Ensure your responses contribute to a goal-oriented, engaging discussion about our virtual assistant services.` +
          agentPrompt,
        },
      ];
    for (const message of transcript) {
      requestMessages.push(message);
    }

    // Populate func result to prompt so that GPT can know what to say given the result
    if (funcResult) {
      // add function call to prompt
      requestMessages.push({
        role: "assistant",
        content: null,
        tool_calls: [
          {
            id: funcResult.id,
            type: "function",
            function: {
              name: funcResult.funcName,
              arguments: JSON.stringify(funcResult.arguments),
            },
          },
        ],
      });
      // add function call result to prompt
      requestMessages.push({
        role: "tool",
        tool_call_id: funcResult.id,
        content: funcResult.result || "",
      });
    }

    if (request.interaction_type === "reminder_required") {
      requestMessages.push({
        role: "user",
        content: "(Now the user has not reponded in a while, you would say:)",
      });
    }
    return requestMessages;
  }

  // Step 2: Prepare the function calling defition to the prompt
  // Done in tools import

  async DraftResponse(
    request: ResponseRequiredRequest | ReminderRequiredRequest,
    ws: WebSocket,
    funcResult?: FunctionCall,
  ) {
    // If there are function call results, add it to prompt here.
    const requestMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] =
      this.PreparePrompt(request, funcResult);

    let funcCall: FunctionCall | undefined;
    let funcArguments = "";

    try {
      const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
        {
          type: "function",
          function: {
            name: "end_call",
            description: "End the call only when user explicitly requests it.",
            parameters: {
              type: "object",
              properties: {
                message: {
                  type: "string",
                  description:
                    "The message you will say before ending the call with the customer.",
                },
              },
              required: ["message"],
            },
          },
        },
        // {
        //   type: "function",
        //   function: {
        //     name: "book_appointment",
        //     description: "Book an appointment to meet our doctor in office.",
        //     parameters: {
        //       type: "object",
        //       properties: {
        //         message: {
        //           type: "string",
        //           description:
        //             "The message you will say while setting up the appointment like 'one moment'",
        //         },
        //         date: {
        //           type: "string",
        //           description:
        //             "The date of appointment to make in forms of year-month-day.",
        //         },
        //       },
        //       required: ["message"],
        //     },
        //   },
        // },
      ];

      const events = await this.client.chat.completions.create({
        //model: "gpt-3.5-turbo-0125",
        model: "gpt-4-turbo",
        messages: requestMessages,
        stream: true,
        temperature: 0.2,
        max_tokens: 200,
        frequency_penalty: 1.0,
        presence_penalty: 1.0,
        // Step 3: Add the  function into your requsts
        tools: tools,
      });

      for await (const event of events) {
        if (event.choices.length >= 1) {
          const delta = event.choices[0].delta;
          //if (!delta || !delta.content) continue;
          if (!delta) continue;

          // Step 4: Extract the functions
          if (delta.tool_calls && delta.tool_calls.length >= 1) {
            const toolCall = delta.tool_calls[0];
            // Function calling here
            if (toolCall.id) {
              if (funcCall) {
                // Another function received, old function complete, can break here
                // You can also modify this to parse more functions to unlock parallel function calling
                break;
              } else {
                funcCall = {
                  id: toolCall.id,
                  funcName: toolCall.function?.name || "",
                  arguments: {},
                };
              }
            } else {
              // append argument
              funcArguments += toolCall.function?.arguments || "";
            }
          } else if (delta.content) {
            const res: CustomLlmResponse = {
              response_type: "response",
              response_id: request.response_id,
              content: delta.content,
              content_complete: false,
              end_call: false,
            };
            ws.send(JSON.stringify(res));
          }
        }
      }
    } catch (err) {
      console.error("Error in gpt stream: ", err);
    } finally {
      if (funcCall != null) {
        // Step 5: Call the functions

        // If it's to end the call, simply send a lst message and end the call
        if (funcCall.funcName === "end_call") {
          funcCall.arguments = JSON.parse(funcArguments);
          const res: CustomLlmResponse = {
            response_type: "response",
            response_id: request.response_id,
            content: funcCall.arguments.message,
            content_complete: true,
            end_call: true,
          };
          ws.send(JSON.stringify(res));
        }

        // If it's to book appointment, say something and book appointment at the same time
        // and then say something after booking is done
        // if (funcCall.funcName === "book_appointment") {
        //   funcCall.arguments = JSON.parse(funcArguments);
        //   const res: CustomLlmResponse = {
        //     response_type: "response",
        //     response_id: request.response_id,
        //     // LLM will resturn the function name along with the message property we define
        //     // In this case, "The message you will say while setting up the appointment like 'one moment' "
        //     content: funcCall.arguments.message,
        //     // If content_complete is false, it means AI will speak later.
        //     // In our case, agent will say something to confirm the appointment, so we set it to false
        //     content_complete: false,
        //     end_call: false,
        //   };
        //   ws.send(JSON.stringify(res));

        //   // Sleep 2s to mimic the actual appointment booking
        //   // Replace with your actual making appointment functions
        //   await new Promise((r) => setTimeout(r, 2000));
        //   funcCall.result = "Appointment booked successfully";
        //   this.DraftResponse(request, ws, funcCall);
        // }
      } else {
        const res: CustomLlmResponse = {
          response_type: "response",
          response_id: request.response_id,
          content: "",
          content_complete: true,
          end_call: false,
        };
        ws.send(JSON.stringify(res));
      }
    }
  }
}