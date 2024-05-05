import OpenAI from "openai";


const client = new OpenAI({
    apiKey: process.env.OPENAI_APIKEY,
  });

  export const reviewTranscript = async (transcript: string) => {
    try {
      const completion = await client.chat.completions.create({
        messages: [
          {"role": "system", "content": "You are a helpful assistant."},
          {"role": "user", "content": `Analyze the transcript in one or 2 words into either of these categories: appointment scheduled, not interested, can't decide, voicemail, interested etc. Strictly reply with a word or two. Transcript: ${transcript}`}
        ],
        model: "gpt-3.5-turbo",
      });
  
      return completion.choices[0];
    } catch (error) {
      console.error("Error analyzing transcript:", error);
      throw new Error("Failed to analyze transcript");
    }
  };