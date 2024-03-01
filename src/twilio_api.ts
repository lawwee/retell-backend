import twilio, { Twilio } from "twilio";
import { RetellClient } from "retell-sdk";
export class TwilioClient {
  private twilio: Twilio;
  private retellClient: RetellClient;

  constructor() {
    this.twilio = twilio(
      process.env.TWILIO_ACCOUNT_ID,
      process.env.TWILIO_AUTH_TOKEN,
    );
    this.retellClient = new RetellClient({
      apiKey: process.env.RETELL_API_KEY,
    });
  }

  // Create a new phone number and route it to use this server.
  CreatePhoneNumber = async (areaCode: number, agentId: string) => {
    try {
      const localNumber = await this.twilio
        .availablePhoneNumbers("US")
        .local.list({ areaCode: areaCode, limit: 1 });
      if (!localNumber || localNumber[0] == null)
        throw "No phone numbers of this area code.";

      const phoneNumberObject = await this.twilio.incomingPhoneNumbers.create({
        phoneNumber: localNumber[0].phoneNumber,
        voiceUrl: `${process.env.NGROK_IP_ADDRESS}/twilio-voice-webhook/${agentId}`,
      });
      console.log("Getting phone number:", phoneNumberObject);
      return phoneNumberObject;
    } catch (err) {
      console.error("Create phone number API: ", err);
    }
  };

  // Update this phone number to use provided agent id. Also updates voice URL address.
  RegisterPhoneAgent = async (number: string, agentId: string) => {
    try {
      const phoneNumberObjects = await this.twilio.incomingPhoneNumbers.list();
      let numberSid;
      for (const phoneNumberObject of phoneNumberObjects) {
        if (phoneNumberObject.phoneNumber === number) {
          numberSid = phoneNumberObject.sid;
        }
      }
      if (numberSid == null) {
        return console.error(
          "Unable to locate this number in your Twilio account, is the number you used in BCP 47 format?",
        );
      }

      await this.twilio.incomingPhoneNumbers(numberSid).update({
        voiceUrl: `${process.env.NGROK_IP_ADDRESS}/twilio-voice-webhook/${agentId}`,
      });
    } catch (error: any) {
      console.error("failer to retrieve caller information: ", error);
    }
  };

  // Release a phone number
  DeletePhoneNumber = async (phoneNumberKey: string) => {
    await this.twilio.incomingPhoneNumbers(phoneNumberKey).remove();
  };

  // Create an outbound call
CreatePhoneCall = async (
    fromNumber: string,
    toNumber: string,
    agentId: string,
    userId: string,
  ) => {
    try {
      const result = await this.twilio.calls.create({
        machineDetection: "Enable", // detects if the other party is IVR
        machineDetectionTimeout: 8,
        asyncAmd: "true", // call webhook when determined whether it is machine
        asyncAmdStatusCallback: `${process.env.NGROK_IP_ADDRESS}/twilio-voice-webhook/${agentId}/${userId}`, // Webhook url for machine detection
        url: `${process.env.NGROK_IP_ADDRESS}/twilio-voice-webhook/${agentId}/${userId}`, // Webhook url for registering call
        to: toNumber,
        from: fromNumber,
      });
      console.log(`Call from: ${fromNumber} to: ${toNumber}`);
      return result;
    } catch (error: any) {
      console.error("failed to retrieve caller information: ", error);
    }
  };

  // Use LLM function calling or some kind of parsing to determine when to let AI end the call
  EndCall = async (sid: string) => {
    try {
      const call = await this.twilio.calls(sid).update({
        twiml: "<Response><Hangup></Hangup></Response>",
      });
      console.log("End phone call: ", call);
    } catch (error) {
      console.error("Twilio end error: ", error);
    }
  };

  // Use LLM function calling or some kind of parsing to determine when to transfer away this call
  TransferCall = async (sid: string, transferTo: string) => {
    try {
      const call = await this.twilio.calls(sid).update({
        twiml: `<Response><Dial>${transferTo}</Dial></Response>`,
      });
      console.log("Transfer phone call: ", call);
    } catch (error) {
      console.error("Twilio transfer error: ", error);
    }
  };

}