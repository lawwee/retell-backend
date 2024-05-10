import OpenAI from "openai";


const client = new OpenAI({
    apiKey: process.env.OPENAI_APIKEY,
  });

  export const reviewTranscript = async (transcript: string) => {
    try {
      const completion = await client.chat.completions.create({
        messages: [
          {"role": "system", "content": "You are a helpful assistant."},
          {"role": "user", "content": `Please analyze the transcript and categorize it into one or two-word descriptors such as 'appointment scheduled,' 'not interested,' 'voicemail,' 'interested,' etc. Keep your responses brief. Transcript: ${transcript}`}
        ],
        model: "gpt-4-turbo-preview",
      });
  
      return completion.choices[0];
    } catch (error) {
      console.error("Error analyzing transcript:", error);
      throw new Error("Failed to analyze transcript");
    }
  };