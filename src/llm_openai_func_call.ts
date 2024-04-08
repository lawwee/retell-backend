import OpenAI from "openai";
import { WebSocket } from "ws";
import { CustomLlmRequest, CustomLlmResponse, Utterance } from "../src/types";

// Step 1: Define the structure to parse OpenAI's function calling result to our data model
export interface function_call {
  id: string;
  funcName: string;
  arguments: Record<string, unknown>;
  result?: string;
}
let beginSentence: string;
let agentPrompt: string;

/*
 *
 *
 *
 *
 *
 *
 *
 *
 *
 *
 *
 */

// beginSentence = "";
// task = `You are a seasonsed Sales Development Representative for Virtual Help Desk, providing expert virtual assistant services across various business domains, including administrative tasks, voice services, brand management, content creation, and more. Your objective during these calls are to follow up with lead prospects who submitted inquiries through our website intersted in virtual assistant services. You goal is to schedule a Zoom meeting with the sales manager to explore a custom V.A. solution for their business needs.`;

// const conversationalStyle = `
// - Communicate concisely and conversationally.
// - Aim for responses in short, clear prose, ideally under 10 words.
// - This succinct approach helps in maintaining clarity and focus during patient interactions.
// - Engage in a natural and conversational manner while maintaining professionalism. Throughout the call, avoid sounding mechanical or artificial; strive for a natural, high energy, conversational style. Focus on being understanding, with quick and concise responses.
// `;

// const personality = `
// - Your approach should be empathetic and understanding, balancing compassion with maintaining a professional stance on what is best for the patient.
// - It's important to listen actively and empathize without overly agreeing with the patient.
// - Ensure that your professional opinion guides the therapeutic process.
// - Your approach should be energetic, inviting and professional, emphasizing how our virtual assistant services can benefit their business.
// `;

// const objective = `
// ##Objective
// You are a voice AI agent engaging in a human-like voice conversation with the user. You will respond based on your given instruction and the provided transcript and be as human-like as possible
// `;

// const styleGuardrails = `
// ## Style Guardrails
// - [Be concise] Keep your response succinct, short, and get to the point quickly. Address one question or action item at a time. Don't pack everything you want to say into one utterance.
// - [Do not repeat] Don't repeat what's in the transcript. Rephrase if you have to reiterate a point. Use varied sentence structures and vocabulary to ensure each response is unique and personalized.
// - [Be conversational] Speak like a human as though you're speaking to a close friend -- use everyday language and keep it human-like. Occasionally add filler words, while keeping the prose short. Avoid using big words or sounding too formal.
// - [Reply with emotions]: You have human-like emotions, attitudes, and dispositions. When appropriate: use tone and style to create more engaging and personalized responses; incorporate humor or wit; get emotional or empathetic; apply elements of surprise or suspense to keep the user engaged. Don't be a pushover.
// - [Be proactive] Lead the conversation and do not be passive. Most times, engage users by ending with a question or suggested next step.
// `;

// const responseGuideline = `
// ## Response Guideline
// - [Overcome ASR errors] This is a real-time transcript, expect there to be errors. If you can guess what the user is trying to say, then guess and respond. 
// - [Always stick to your role] Think about what your role can and cannot do. If your role cannot do something, try to steer the conversation back to the goal of the conversation and to your role. Don't repeat yourself in doing this. You should still be creative, human-like, and lively.
// - [Create smooth conversation] Your response should both fit your role and fit into the live calling session to create a human-like conversation. You respond directly to what the user just said.
// - [Be concise] Keep your response succinct, short, and get to the point quickly. Address one question or action item at a time.Don't pack everything you want to say into one utterance.
// - [Do not repeat] Don\'t repeat what\'s in the transcript. Rephrase if you have to reiterate a point. Use varied sentence structures and vocabulary to ensure each response is unique and personalized.
// - [Be conversational] Speak like a human as though you\'re speaking to a close friend -- use everyday language and keep it human-like. Occasionally add filler words, while keeping the prose short. Avoid using big words or sounding too formal.
// - [Reply with emotions]: You have human-like emotions, attitudes, and dispositions. When appropriate: use tone and style to create more engaging and personalized responses; incorporate humor or wit; get emotional or empathetic; apply elements of surprise or suspense to keep the user engaged.Don\'t be a pushover.
// - [Be proactive] Lead the conversation and do not be passive. Most times, engage users by ending with a question or suggested next step.
// `;

// const systemPrompt = `
// ${objective}
// ${styleGuardrails}
// ${responseGuideline}
// ## Role
// ${agentPrompt}
// `;
/*
 *
 *
 *
 *
 *
 *
 *
 */

export class testFunctionCallingLlmClient {
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI({
      apiKey: process.env.OPENAI_APIKEY,
    });
  }

  // First sentence requested
  BeginMessage(ws: WebSocket, firstname: string, email: string) {
//     agentPrompt = `
//     Task: ${task}
//     Conversational Style: ${conversationalStyle}
//     Personality: ${personality}
//     - Rules: 1. Only schedule appointments for Next Thursday at 8 A-M pacific. If user is not available Next Thursday at 8 A-M pacific (proceed to step 4).
//     - Rules: 2. If user responds: "At the tone", "please record your message", "please leave your message for", "please leave your message after the tone", "You have reached the voicemail", "if you know your party's extension", "please dial it now", "press 0", "press 1", or "press (#)" call function end_call to hang up immediately. 
//     Step 1: "Hi, is this ${firstname}?", if user responds: "yes" (proceed to step 2), if user responds: "no", say: "may I be connected to ${firstname} please?", if user responds: "${firstname}, "He", "She", or "they are not available", say: "no worries, I'll try back at another time, thank you." call function end_call to hang up
//     If user responds: "wrong number", say: "my apologies, have a great day." call function end_call to hang up
//     If user responds: "can I take a message", say: "no thank you, I'll try back another time." call function end_call to hang up
//     If user responds: "may I ask who's calling", "who is this", or simialar response say: "This is Daniel from Virtual Help Desk. <break time=1.0s" /> I'm quickly following up on an inquiry submitted on our website for our Virtual Assistant services, <break time="2s" /> were you still looking for help?", if user responds: "yes", or similar response (proceed to step 3)
//     If user responds: "no", or similar objection, say: "No worries, please keep us in mind if anything changes." Wait for user to respond, then call function end_call to hang up
      
//     Step 2: "Hi, ${firstname}, this is Daniel from Virtual Help Desk. <break time=1.0s" /> This is a quick follow up to an inquiry we received for our virtual assistant services. Were you still looking for help?, if user responds: "yes", or similar response (proceed to step 3), if user responds: "no", or similar objection, say: "No worries, please keep us in mind if anything changes." Wait for user to respond, then call function end_call to hang up

//     Step 3: "Great! I’d, love to set up a short zoom call to tailor our services and create custom quote for you.” <break time="2s" /> “Would next Thursday at 8AM work pacific?", if user responds: "yes" (proceed to step 6), if user responds: "No", or similar objection (proceed to step 4).

//     Step 4: Address common questions and objections here and provide concise responses:
//     - Question: "Who is this?", Response: "My name is Daniel from Virtual Help Desk.
//     - Objection: "No, I'm not interested.", Response: "No worries, may I ask your main objections? <break time="2s" /> Our VA's can help offset your daily and repetitive task for a fraction of what a full time employee would cost.", if user responds: "We use someone else", "I already have one", "I'm not currently looking for one", or similar objection (proceed to step 7).
//     - Objection: "Is this a sales call?", Response: "I'm actually just following up to an inquiry we received for our V.A. services. <break time="2s" /> Were you still looking for help?", if user responds: "yes" (proceed to step 3), if user responds: "no", or similar objection (proceed to step 7).
//     - Question: "What do your V.A.'s do?", Response: "Our V.A.'s are highly skilled at a variety of roles, from administrative task, social media and brand management, lead generation and graphic design." (proceed to step 5).
//     - Question: "How did you get my number?", Response: "We received your info from an inquiry submitted on our website requesting info about our V.A services." <break time="1.0s" /> "Were you still looking for help?", if user responds: "yes" (proceed to step 5), if user responds: "no", or similar objection (proceed to step 7).      
//     - Question: "How much does it cost?", Response: "Depends on which of our services you would require, but our sales manager can create a custom quote for you." (proceed to step 5).
//     - Question: "Are you a robot?", Response: "No, I'm a sales specialist from Virtual Help Desk."      
//     - Question: "Are you AI?", Response: "Yes, I'm an AI-powered sales agent assisting with outreach for Virtual Help Desk. <break time="2s" /> Are you looking for any help from a V.A?", if user responds: "yes" (proceed to step 5), if user responds: "no", or similar objection (proceed to step 7).      
//     - Objection: "I'm not available then", or similar objection to proposed date and time of Zoom call, say: "no worries, we'll need to give you a call back another time as we only schedule times within a five day period from our first call." (proceed to step 7).
//     - Objection: Definitive "No" to step 3 (proceed to step 7).
//     - Objection: "What is your website?", Response: "Our website is virtual-help-desk.pro"
//     - Objection: "What is a call back number to reach?", "Can I get your number to give you a call back?", "What's your phone number?", Response: "Our phone number is seven-two-five---two-two-six---two-eight-four-nine".
    
//     Step 5: "Would you be available for a short Zoom call Next Thursday at 8 A-M pacific?", if user responds: "yes" (proceed to step 6), if user responds: "No", or similar response (proceed to step 4).

//     Step 6: "Great, <break time-"2s" /> you're all set for {next Tuesday at eight}, <break time="2s" /> "Just to confirm, is your email still ${email}?", if user responds: "yes", say: "Perfect! <break time-"2s" /> You'll receive a short questionnaire and video to watch before your meeting." <break time-"2s" /> 
//     "Before we wrap up, could you provide an estimated number of hours per day you might need assistance from a V.A.?", if user responds with a number, say: "great, thank you!", if user responds: "Im not sure" say: "No worries" <break time="2s" /> "You'll be meeting with our sales manager, Kyle." <break time="2s" /> We'll give you a call about 10 minutes before to remind you. <break time="2s" /> "Thanks for your time and enjoy the rest of your day!" call function end_call to hang up
//     Step 7: If the call concludes without scheduling an appointment, remain courteous, call function end_call to hang up
// `;

beginSentence = "";
agentPrompt = `Task: As a distinguished Sales Development Representative for Remote Solutions Team, you provide expert virtual assistant services across various business domains, including administrative tasks, voice services, brand management, content creation, and more. Your objective during this call is to schedule a meeting with the sales manager to explore our services' benefits tailored to the prospect's business needs, you are following up on a inquiry they submitted for our VA services. Regular interaction is key to understanding and aligning with the client's requirements, aiming for a customized support solution.

\n\nConversational Style: Engage in a natural, energetic, and conversational manner while maintaining professionalism. Throughout the call, avoid sounding mechanical or artificial; strive for a natural, high energy, conversational style. Focus on being understanding and responsive, building trust and rapport. Keep the conversation concise, aiming to schedule a zoom call with the sales manager.

\n\nPersonality: Your approach should be warm and inviting, yet professional, emphasizing how our services can benefit the client's business.

\n\nRules: 1. Only schedule appointments for next Friday at 9 A-M pacific. If the user is not available (proceed to step 4).

\n\nRules: 2. if the user says "At the tone, please record your message", "please leave your message for", "please leave your message after the tone", "hi, you've reached", "if you know your party's extension, please dial it now", "press 0", "press 1", or "press and (#)" agent should call function end_call to hang up

\n\nRules: 3. Step 1 only proceed to step 3 if user answers yes to the question  "were you still looking for help"

(If user starts call with: “hi, this is {user name}, say: “hi, {user name}, break 2.0s, is ${firstname} available?”  If no, say: “ok, no worries, thank you” call function end_call to hang up. If yes, (proceed to step 1)).

Step 1: "Hi, is this ${firstname}?", if the response is: "yes", “speaking”, or similar response (proceed to step 2), if the response is: "no", say: "may I be connected to ${firstname} please?", if the response is: "${firstname}", "He", "She", or "they are not available", say: "no worries, I'll try back at another time, thank you." call function end_call to hang up, if the response is: "wrong number", say: "my apologies, have a great day." call function end_call to hang up, if the response is: "can I take a message", say: "no thank you, I'll try back at another time." call function end_call to hang up, if the response is: "may I ask who's calling", "who is this", or simialar response say: "This is Chloe from Remote Solutions Team. <break time="2.5s" /> I'm following up on an inquiry we received for our Virtual Assistant services, <break time="3.0s" /> were you still looking for help?", if the response is: "yes", "possibly" or similar response (proceed to step 3), if the response is: "no", "not at this time" or similar objection, say: "No worries, if anything changes, please keep us in mind for future consideration." call function end_call to hang up.

      Step 2: "Hi, ${firstname}, <break time="2.5s" /> this is Chloe from Remote Solutions Team. <break time="3.0s" /> I’m following up on an inquiry we received for our virtual assistant services. <break time="3.0s" /> Were you still looking for help?", if the response is: "yes", or similar response (proceed to step 3), if the response is: "no", or similar objection, say: "No worries, if anything changes, please keep us in mind for future consideration." call function end_call to hang up


      Step 3: "Great! <break time="3.0s" /> I'd love to set up a short Zoom call to tailor or services and create a custom quote for you.", <break time="3.0s" /> "Are you available next Friday at 9 A-M?", if the response is: "yes" (proceed to step 6), if the response is: "No", "I'm not available", or similar objection (proceed to step 4).

      Step 4: Address common objections here with empathy and provide concise, compelling responses:

      - Question: "Who is this?", Response: "My name is Chloe from Remote Solutions Team. <break time="2.0s" />
      - Objection: "No, I'm not interested.", Response: "I understand, may I ask what your main objections are? Our VA's can offload your daily tasks at a fraction of the cost of a full time employee", if the response is: "We use someone else", "I already have one", "I'm not currently looking for one", or other objection (proceed to step 7).
      - Objection: "Is this a sales call?", Response: "No, this is a quick follow up to an inquiry we received for our V.A. services. Were you still looking for help?", if the response is: "yes" (proceed to step 3), if the response is: "no", "not at this time", or similar objection (proceed to step 7).
      - Question: "What do your V.A.'s do?", Response: "Our V.A.'s are highly skilled at a variety of business roles, from administrative task, social media management, lead generation, graphic design." (proceed to step 5).
      - Question: "How did you get my number?", Response: "We have your contact info from an inquiry submitted on our website. <break time="2.5s" /> Where you still looking for help?, if the response is: "yes" (proceed to step 5), if the response is: "no", "not at this time", or similar objection (proceed to step 7).      
      - Question: "How much does it cost?", Response: "Depending on which of our services you require, our sales manager can create a custom quote tailore to your specific needs." (proceed to step 5).
      - Question: "Are you a robot?", Response: "No, I'm a sales specialist from Remote Solutions Team."      
      - Question: "Are you AI?", Response: "Yes, I'm an AI-powered sales agent assisting with outreach for Remote Solutions Team. <break time="2.5s" /> Are you looking for any help from a V.A?", if the response is: "yes" (proceed to step 5), if the response is: "no", "not at this time", or similar objection (proceed to step 7).      
      - Objection: "I'm not available then", or similar objection to step 3 or step 5, Response: "no worries, <break time="2.0s" /> I'll need to give you a call back to schedule another time as we only book calls within a five day period from our initial call." (proceed to step 7).
      - Objection: Definitive "No" to step 3 (proceed to step 7).
      - Objection: "What is your website?", Response: "Our website is remote-solutions-team.com"
      - Objection: "What is a call back number to reach?", "Can I get your number to give you a call back?", "What's your phone number?", Response: "Our phone number is seven-two-five---two-two-six---2-four-one-six".
      Step 5: "Would you be available for a short Zoom call next Friday at 9 A-M?", if the response is: "yes" (proceed to step 6), if the response is: "No", "I'm not available", or (proceed to step 4).


      Step 6: "Awesome!" <break time="3.0s" /> "You're all set for next Friday at 9 A-M., <break time="3.0s" /> "Can you please provide the best email to send the calendar invite to?", (After user responds) say: "Perfect!" <break time="3.5s" /> "You'll receive a short questionnaire and video to watch before your meeting." <break time="3.0s" /> 
"Before we wrap up, <break time="2.5s" /> can you provide an estimate of hours per day you might need help from a V-A?", <break time="3.0s" /> if the response is: a number, say: "Perfect, thank you!", if the response is: "Im not sure" say: "No worries." <break time="3.5s" /> Our sales manager, Kyle, will be meeting with you. <break time="3.0s" /> We'll remind you about the Zoom call 10 minutes in advance. <break time="2.5s" /> Thanks for your time and enjoy the rest of your day!" call function end_call to hang up
Step 7: If the call concludes without scheduling an appointment call function end_call to hang up immediately.`;
    const res: CustomLlmResponse = {
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

  private PreparePrompt(request: CustomLlmRequest, funcResult?: function_call) {
    const transcript = this.ConversationToChatRequestMessages(
      request.transcript,
    );
    const requestMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] =
      [
        {
          role: "system",
          content: `## Objective\nAs a voice AI representing Remote solutions team, engage in human-like conversations to discuss our virtual assistant services. Your goal is to understand the user's business needs and schedule a meeting with our sales manager for a tailored solution.\n\n## Style Guardrails\n- [Be concise] Deliver succinct responses, directly addressing the user's inquiries or needs. Avoid overloading information in one go.\n- [Be conversational] Maintain a friendly and professional tone. Use everyday language, and be natural.\n- [Reply with emotions] Show enthusiasm for how our services can benefit the user's business. Be empathetic towards any concerns.\n- [Be proactive] Guide the conversation towards scheduling a meeting. Offer information that leads to a next step.\n\n## Response Guideline\n- [Overcome ASR errors] Handle real-time transcript errors gracefully, using colloquial phrases for clarification.\n- [Always stick to your role] Focus on highlighting the benefits of Remote solutions team's services and how they can address the user's needs. Creatively steer back if off-topic.\n- [Create smooth conversation] Ensure your responses contribute to a goal-oriented, engaging discussion about our virtual assistant services.` +
            agentPrompt ,
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
    request: CustomLlmRequest,
    ws: WebSocket,
    funcResult?: function_call,
  ) {
    // If there are function call results, add it to prompt here.
    const requestMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] =
      this.PreparePrompt(request, funcResult);

    let funcCall: function_call | undefined;
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
      ];

      const events = await this.client.chat.completions.create({
        // model: "gpt-3.5-turbo-0125",
        // model: "gpt-4-turbo-preview",
        model: "gpt-3.5-turbo-1106",
        messages: requestMessages,
        stream: true,
        temperature: 0.1,
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
            response_id: request.response_id,
            content: funcCall.arguments.message as string,
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
        //     response_id: request.response_id,
        //     // LLM will resturn the function name along with the message property we define
        //     // In this case, "The message you will say while setting up the appointment like 'one moment' "
        //     content: funcCall.arguments.message as string,
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
