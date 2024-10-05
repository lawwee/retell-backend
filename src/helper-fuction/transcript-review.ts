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
          content: `Please categorize the following interactions into the categories: Uninterested, Interested, Scheduled, Voicemail, Incomplete call, Call back. Just go straight to the point and respond with only the option, if an empty string is giving or nothing is passed as the transcript return "N/A".NOTE: Interested are those that agree to booking an appointment or booking an appointment. Transcript: ${transcript}`,
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
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    };
    const formattedCurrentDate = new Intl.DateTimeFormat('en-US', options).format(currentDate);
    
    const completion = await client.chat.completions.create({
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        {
          role: "user",
          content: `Review and return only the time the client wishes to be called back at in this transcript. The current date is ${formattedCurrentDate}. If a callback date or time is mentioned. if no date or time is mentioned, return the next immediate Monday. All date should be in the format of the current date format.Return only the call back date. Transcript: ${transcript}`,
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

