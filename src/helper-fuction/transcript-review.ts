import OpenAI from "openai";


const client = new OpenAI({
    apiKey: process.env.OPENAI_APIKEY,
  });

  export const reviewTranscript = async (transcript: string) => {
    try {
      const completion = await client.chat.completions.create({
        messages: [
          {"role": "system", "content": "You are a helpful assistant."},
          {"role": "user", "content": `while keeping the result as short as possible, Analyze the transcript to determine or categorize the transcripts into the following: went to voicemail, interested, not interested, do not care, or appointment scheduled. Transcript: ${transcript}`}
        ],
        model: "gpt-3.5-turbo",
      });
  
      console.log(completion.choices[0])
      return completion.choices[0];
    } catch (error) {
      console.error("Error analyzing transcript:", error);
      throw new Error("Failed to analyze transcript");
    }
  };