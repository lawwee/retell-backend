import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_APIKEY,
});

export const reviewTranscript = async (transcript: string) => {
  try {
    const completion = await client.chat.completions.create({
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        {
          role: "user",
          content: `You are an expert data analyst specializing in sentiment analysis of call transcripts between AI agents and leads. Your task is to accurately categorize each conversation based on the lead's responses. Please use one of the following categories:

Categories:
interested: The lead clearly expresses interest, agrees to book an appointment, or continues discussing next steps.
not-interested: The lead explicitly says they are no longer interested, have found a solution, or expresses disinterest.
scheduled: The lead confirms a specific time for an appointment or meeting.
call-back: The lead requests the agent to call back later or suggests following up in the future.
incomplete: The call ends abruptly, or the lead cannot be reached before answering any key questions.
voicemail: The call results in leaving a voicemail or the agent reaches the lead's voicemail system.
Instructions:

Analyze the transcript below and assign it the most fitting category based on the lead's responses.
If the transcript is empty or missing, respond with N/A.
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

export const reviewCallback = async (transcript: string) => {
  try {
    const currentDate = new Date();
    const options: Intl.DateTimeFormatOptions = {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    };
    const formattedCurrentDate = new Intl.DateTimeFormat(
      "en-US",
      options,
    ).format(currentDate);

    const completion = await client.chat.completions.create({
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        {
          role: "user",
          content: `Review this transcript and return only the time the client wishes to be called back at in this transcript.  If a callback date or time is mentioned. if no date or time is mentioned, return the next immediate Monday.Return only the call back date. Transcript: ${transcript}`,
        },
      ],
      // model: "gpt-4-turbo-preview",
      model: "gpt-4o-mini",
    });

    return completion.choices[0].message.content.trim();
  } catch (error) {
    console.error("Error analyzing transcript:", error);
    throw new Error("Failed to analyze transcript");
  }
};
