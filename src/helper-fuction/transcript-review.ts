import { format } from "date-fns";
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_APIKEY,
});

export const reviewTranscriptForSentiment = async (transcript: string) => {
  try {
    const completion = await client.chat.completions.create({
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        {
          role: "user",
          content: `You are an expert data analyst specializing in sentiment analysis of call transcripts between AI agents and leads. Your task is to accurately categorize each conversation based on the lead's responses. Please use one of the following categories:

Categories:
scheduled: The lead confirms a specific time for an appointment or meeting.
call-back: The lead specifies they want to be called back at a later time
Instructions
Analyze the transcript below and assign it the most fitting category based on the lead's responses.
If the transcript is empty or missing or does not fit any of the above categories, respond with N/A.
Respond only with the appropriate category without any additional explanation.
Transcript: ${transcript}`,
        },
      ],
      // model: "gpt-4-turbo-preview",
      model: "gpt-4o-mini", 
    });

    return completion.choices[0];
  } catch (error) {
    console.error("Error analyzing transcript:", error);
    throw new Error("Failed to analyze transcript");
  }
};

export const reviewTranscriptForStatus = async (transcript: string) => {
  try {
    const completion = await client.chat.completions.create({
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        {
          role: "user",
          content: `You are an expert data analyst specializing in sentiment analysis of call transcripts between AI agents and leads. Your task is to accurately categorize each conversation based on the lead's responses. Please use one of the following categories:

Categories:
voicemail: Based on the content of this call transcript, identify whether this is an AM/VM (Answering Machine/Voice Mail)
ivr: Based on the content of this call transcript, identify whether this is an IVR (Interactive Voice Response) system.
scheduled: The lead confirms a specific time for an appointment or meeting.
Instructions
Analyze the transcript below and assign it the most fitting category based on the lead's responses.
If the transcript is empty or missing or does not fit any of the above categories, respond with N/A.
Respond only with the appropriate category without any additional explanation.
Transcript: ${transcript}`,
        },
      ],
      // model: "gpt-4-turbo-preview",
      model: "gpt-4o-mini", 
    });

    return completion.choices[0];
  } catch (error) {
    console.error("Error analyzing transcript:", error);
    throw new Error("Failed to analyze transcript");
  }
};



export const reviewCallback = async (transcript: string): Promise<string> => {
  try {
    const completion = await client.chat.completions.create({
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        {
          role: "user",
          content: `Extract only the callback date mentioned in this transcript. If the client explicitly mentions a callback date or time, return it in the format YYYY-MM-DD. If no callback date or time is mentioned, return the date of the Monday two weeks from today, in the same format YYYY-MM-DD. Transcript: ${transcript}`,
        },
      ],
      model: "gpt-4o-mini",
    });

    const extractedDate = completion.choices[0].message.content.trim();

    // If no date is found, calculate the Monday two weeks from today
    if (!extractedDate) {
      const currentDate = new Date();
      const nextMonday = new Date(
        currentDate.setDate(
          currentDate.getDate() + ((1 - currentDate.getDay() + 7) % 7 || 7) + 14
        )
      );
      return format(nextMonday, "yyyy-MM-dd");
    }

    // Ensure the date is in the correct format and return it
    return extractedDate;
  } catch (error) {
    console.error("Error analyzing transcript:", error);
    throw new Error("Failed to analyze transcript");
  }
};

