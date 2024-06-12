import { populate } from "dotenv";
import { reviewTranscript } from "../helper-fuction/transcript-review";
import { IContact, callstatusenum } from "../types";
import { contactModel } from "./contact_model";
import { Document } from "mongoose";
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

// export const getAllContact = async (agentId: string, page:number, limit:number): Promise<{
//   contacts: ContactDocument[],
//   totalContactForAgent: number,
//   totalCalledForAgent: number,
//   totalPages: number,
//   totalNotCalledForAgent: number ,
//   failedCalls: number,
//   vm:number,
//   totalTransferredCall: number

// } | string> => {
//   try {
//     const skip = (page - 1) * limit;
//     const foundContacts = await contactModel
//       .find({ agentId, isDeleted: { $ne: true } })
//       .sort({ createdAt: "desc" })
//       .populate("referenceToCallId")
//       .skip(skip)
//       .limit(limit);

//     // Count the total number of documents
//     const totalCount = await contactModel.countDocuments({ agentId, isDeleted: { $ne: true } });
//     const totalContactForAgent = await contactModel.countDocuments({agentId, isDeleted:false})
//     const totalCalledForAgent = await contactModel.countDocuments({agentId, isDeleted:false, status:callstatusenum.CALLED})
//     const totalNotCalledForAgent = await contactModel.countDocuments({agentId, isDeleted:false, status:callstatusenum.NOT_CALLED})
//     const totalFailedForAgent = await contactModel.countDocuments({agentId, isDeleted:false, status:callstatusenum.FAILED})
//     const answeredByVMForAgent = await contactModel.countDocuments({agentId, isDeleted:false, status:callstatusenum.VOICEMAIL})
//     const totalTransferredCall = await contactModel.aggregate([
//       {
//         $match: {
//           agentId,
//           isDeleted: { $ne: true }
//         }
//       },
//       {
//         $lookup: {
//           from: "otherCollection", // Replace "otherCollection" with the name of the collection containing call details
//           localField: "referenceToCallId",
//           foreignField: "_id",
//           as: "callDetails"
//         }
//       },
//       {
//         $match: {
//           "callDetails.disconnection_reason": "call_transfer"
//         }
//       },
//       {
//         $count: "totalTransferredCall"
//       }
//     ]);

//     // Calculate the total number of pages
//     const totalPages = Math.ceil(totalCount / limit);

//      // // Iterate over dailyStats to extract and analyze transcripts
//      const statsWithTranscripts = await Promise.all(foundContacts.map(async (stat) => {
//       const transcript = stat.referenceToCallId?.transcript
//       const analyzedTranscript = stat.referenceToCallId?.analyzedTranscript
//       return {
//         ...stat.toObject(),
//         originalTranscript: transcript,
//         analyzedTranscript
//       } as ContactDocument
//     }));
//     // Return the contacts and total pages
//     return {
//       totalContactForAgent,
//       totalCalledForAgent,
//       totalNotCalledForAgent,
//       totalPages,
//       failedCalls:totalFailedForAgent,
//       contacts: statsWithTranscripts,
//       vm: answeredByVMForAgent,
//       totalTransferredCall: totalTransferredCall.length > 0 ? totalTransferredCall[0].totalTransferredCall : 0 // Include totalTransferredCall here
//     };
//   } catch (error) {
//     console.error("Error fetching all contacts:", error);
//     return "error getting contact";
//   }
// };

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
      totalCallsFailed: number;
      totalAnsweredByVm: number;
      totalAppointment: any;
      totalCallsTransffered: any;
      totalCalls:number
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
    const totalCallsFailed = await contactModel.countDocuments({
      agentId,
      isDeleted: false,
      status: callstatusenum.FAILED,
    });
    const totalAnsweredByVm = await contactModel.countDocuments({
      agentId,
      isDeleted: false,
      status: callstatusenum.VOICEMAIL,
    });

    const totalCalls = await contactModel.countDocuments({
      agentId,
      isDeleted: false,
      status: { $in: [callstatusenum.CALLED, callstatusenum.VOICEMAIL, callstatusenum.FAILED] },
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
      totalAppointment: totalAppointment.length > 0 ? totalAppointment[0].result : 0,
      totalCallsTransffered: totalCallsTransffered.length > 0 ? totalCallsTransffered[0].result : 0,
      totalCallsFailed: totalCallsFailed,
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
