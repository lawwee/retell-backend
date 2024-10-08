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
          content: `You are an expert data analyst specializing in user sentiment analysis. Your task is to analyze call transcript conversations between voice AI agents and leads, categorizing the sentiment into one of the following categories: {Interested}, {Not-Interested}, {Appt.-Scheduled}, {Call-Back-Request}, {Incomplete-Call}.

Here is the transcript you need to analyze:

<transcript>
${transcript}
</transcript>

Carefully read through the transcript and follow these guidelines to determine the most appropriate and accurate category:

1. {Interested}: Assign this category if the lead answers "yes" to the question "Are you still looking for help?".

2. {Appt.-Scheduled}: Use this category if the lead agrees to scheduling a Zoom call or booking an appointment.

3. {Not-Interested}: Assign this category if the lead answers "no", "no longer looking", "already hired someone", or gives a similar response to the question "Are you still looking for help?".

4. {Call-Back-Request}: Use this category if the lead answers "not at this time", "call me back", "call back", "follow up", "check back" to the question "Are you still looking for help?", or explicitly requests a call back or follow up.

5. {Incomplete-Call}: Assign this category if the call ended early due to the user hanging up or getting disconnected before they were able to answer the question "Are you still looking for help?".

If the transcript is an empty string or nothing is passed in the transcript, return {N/A}.`,
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

