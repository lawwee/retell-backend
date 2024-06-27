import { populate } from "dotenv";
import { reviewTranscript } from "../helper-fuction/transcript-review";
import { IContact, callstatusenum } from "../types";
import { contactModel } from "./contact_model";
import { Document } from "mongoose";
import axios from "axios";
import Retell from "retell-sdk";

const retell = new Retell({
  apiKey: process.env.RETELL_API_KEY,
});
interface totalAppointmentInterface {
  result: number;
}

export const createContact = async (
  firstname: string,
  lastname: string,
  email: string,
  phone: string,
  agentId: string,
): Promise<IContact | string> => {
  try {
    if (!firstname || !email || !phone) {
      return "Missing required fields";
    }
    const createdContact = await contactModel.create({
      firstname,
      lastname,
      email,
      phone,
      agentId,
    });
    return createdContact;
  } catch (error) {
    console.log("Error creating contact:", error);
    return null;
  }
};

type ContactDocument = Omit<Document & IContact, "_id">;

export const getAllContact = async (
  agentId: string,
  page: number,
  limit: number,
): Promise<
  | {
      contacts: ContactDocument[];
      totalContactForAgent: number;
      totalAnsweredCalls: number;
      totalPages: number;
      totalNotCalledForAgent: number;
      totalCallsFailed: any;
      totalAnsweredByVm: number;
      totalAppointment: any;
      totalCallsTransffered: any;
      totalCalls: number
      // usersEmailToPush: any,
      // usersIdToPush: any
    }
  | string
> => {
  try {
    const skip = (page - 1) * limit;
    const foundContacts = await contactModel
      .find({ agentId, isDeleted: { $ne: true } })
      .sort({ createdAt: "desc" })
      .populate("referenceToCallId")
      .skip(skip)
      .limit(limit);

    // Count the total number of documents
    const totalCount = await contactModel.countDocuments({
      agentId,
      isDeleted: { $ne: true },
    });
    const totalContactForAgent = await contactModel.countDocuments({
      agentId,
      isDeleted: false,
    });
    const totalAnsweredCalls = await contactModel.countDocuments({
      agentId,
      isDeleted: false,
      status: callstatusenum.CALLED,
    });
    const totalNotCalledForAgent = await contactModel.countDocuments({
      agentId,
      isDeleted: false,
      status: callstatusenum.NOT_CALLED,
    });

    let failed = 21;
    // const totalCallsFailed = await contactModel.countDocuments({
    //   agentId,
    //   isDeleted: false,
    //   status: callstatusenum.FAILED,
    // });

    // let usersEmailToPush = []
    // let usersIdToPush = []
    // let usersToPushs = 0
    // const contacts = await contactModel.find({ isDeleted: false, agentId:"214e92da684138edf44368d371da764c" });

    // try {
    //   for (const contact of contacts) {
    //     if (!contact.callId) {
    //       // Skip users without a callId
    //       continue;
    //     }

    //     const callId = contact.callId;
    //     const result = await axios.get(
    //       `https://api.retellai.com/get-call/${callId}`,
    //       {
    //         headers: {
    //           Authorization: `Bearer ${process.env.RETELL_API_KEY}`,
    //         },
    //       },
    //     );
    //     // Check if Retell returns an object and its disconnection reason is "dial_failed"
    //     if ( result.data.disconnection_reason === "dial_failed") {
    //       // If so, push the corresponding contact object to the array
    //       console.log(contact.email)
    //       console.log(contact._id)
    //       usersEmailToPush.push(contact.email)
    //       usersIdToPush.push(contact._id)
    //       usersToPushs++
    //     }
    //   }
    // } catch (error) {
    //   console.error("Error occurred while fetching data:", error);
    // }

    // let countForFailed = 397;
    // function getStartOfDayTimestamp() {
    //   const date = new Date(); // Get current date and time
    //   date.setHours(0, 0, 0, 0); // Set time to 00:00:00:000
    //   return date.getTime(); // Get timestamp
    // }

    // // Function to get the timestamp for the end of the day
    // function getEndOfDayTimestamp() {
    //   const date = new Date(); // Get current date and time
    //   date.setHours(23, 59, 59, 999); // Set time to 23:59:59:999
    //   return date.getTime(); // Get timestamp
    // }

    // // Example usage
    // const startOfDayTimestamp = getStartOfDayTimestamp();
    // const endOfDayTimestamp = getEndOfDayTimestamp();
    // const result = await axios.get(`https://api.retellai.com/list-call`, {
    //   headers: {
    //     Authorization: `Bearer ${process.env.RETELL_API_KEY}`,
    //   },
    //   params: {
    //     after_start_timestamp: startOfDayTimestamp,
    //     before_end_timestamp: endOfDayTimestamp,
    //   },
    // });

    const totalAnsweredByVm = await contactModel.countDocuments({
      agentId,
      isDeleted: false,
      status: callstatusenum.VOICEMAIL,
    });

    const totalCalls = await contactModel.countDocuments({
      agentId,
      isDeleted: false,
      status: {
        $in: [
          callstatusenum.CALLED,
          callstatusenum.VOICEMAIL,
          callstatusenum.FAILED,
        ],
      },
    });

    const totalCallsTransffered = await contactModel.aggregate([
      {
        $match: {
          agentId,
          isDeleted: { $ne: true },
        },
      },
      {
        $lookup: {
          from: "transcripts",
          localField: "referenceToCallId",
          foreignField: "_id",
          as: "callDetails",
        },
      },
      {
        $match: {
          "callDetails.disconnectionReason": "call_transfer",
        },
      },
      {
        $count: "result",
      },
    ]);

    const totalAppointment = await contactModel.aggregate([
      {
        $match: {
          agentId,
          isDeleted: { $ne: true },
        },
      },
      {
        $lookup: {
          from: "transcripts",
          localField: "referenceToCallId",
          foreignField: "_id",
          as: "callDetails",
        },
      },
      {
        $match: {
          "callDetails.analyzedTranscript": "Scheduled",
        },
      },
      {
        $count: "result",
      },
    ]);

    // Calculate the total number of pages
    const totalPages = Math.ceil(totalCount / limit);

    // Iterate over foundContacts to extract and analyze transcripts
    const statsWithTranscripts = await Promise.all(
      foundContacts.map(async (stat) => {
        const transcript = stat.referenceToCallId?.transcript;
        const analyzedTranscript = stat.referenceToCallId?.analyzedTranscript;
        return {
          ...stat.toObject(),
          originalTranscript: transcript,
          analyzedTranscript,
        } as ContactDocument;
      }),
    );

    const callListResponse = await retell.call.list({
      query: {
        agent_id: "214e92da684138edf44368d371da764c",
        after_start_timestamp: "1719356400",
        limit:1000000
      },
    });
    const countCallFailed = callListResponse.filter(
      (doc) => doc.disconnection_reason === "dial_failed",
    ).length;

    // Return the contacts, total pages, and other counts
    return {
      totalContactForAgent,
      totalAnsweredCalls,
      totalNotCalledForAgent,
      totalPages,
      totalAnsweredByVm,
      totalAppointment:
        totalAppointment.length > 0 ? totalAppointment[0].result : 0,
      totalCallsTransffered:
        totalCallsTransffered.length > 0 ? totalCallsTransffered[0].result : 0,
      totalCallsFailed: countCallFailed,
      totalCalls,
      contacts: statsWithTranscripts,
    };
  } catch (error) {
    console.error("Error fetching all contacts:", error);
    return "error getting contact";
  }
};

export const deleteOneContact = async (id: string) => {
  try {
    const deleteContact = await contactModel.findOneAndUpdate(
      { _id: id, isDeleted: { $ne: true } },
      { $set: { isDeleted: true } },
      { new: true },
    );
    return deleteContact;
  } catch (error) {
    console.error("Error deleting contact:", error);
    return "delete failed, something went wrong";
  }
};

export const updateOneContact = async (id: string, updateFields: object) => {
  try {
    const updatedContact = await contactModel.findOneAndUpdate(
      { _id: id, isDeleted: { $ne: true } },
      { $set: updateFields },
      { new: true },
    );
    return updatedContact;
  } catch (error) {
    console.error("Error updating contact:", error);
    return "could not update contact";
  }
};
