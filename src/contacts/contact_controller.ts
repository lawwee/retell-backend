import { populate } from "dotenv";
import { reviewTranscript } from "../helper-fuction/transcript-review";
import { IContact, callstatusenum } from "../types";
import { contactModel } from "./contact_model";
import { Document } from "mongoose";
import axios from "axios";
import Retell from "retell-sdk";

const retell = new Retell({
  apiKey: process.env.RETELL_API_KEY,
})
export const createContact = async (
  firstname: string,
  lastname: string,
  email: string,
  phone: string,
  agentId: string,
  lowerCaseTags: string,
  dayToBeProcessed?: string
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
      tags: lowerCaseTags,
      dayToBeProcessed
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

export const failedContacts = async () =>{
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
  return  { totalCallsFailed: countCallFailed}
}