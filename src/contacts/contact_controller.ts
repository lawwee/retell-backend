
import { DateOption, IContact, Ijob, callstatusenum } from "../utils/types";
import { contactModel, EventModel, jobModel } from "./contact_model";
import mongoose, { Document } from "mongoose";
import axios from "axios";
import Retell from "retell-sdk";
import { subDays, startOfMonth, startOfWeek } from "date-fns";
import { format, toZonedTime } from "date-fns-tz";
import { DailyStatsModel } from "./call_log";

const retell = new Retell({
  apiKey: process.env.RETELL_API_KEY,
});
export const createContact = async (
  firstname: string,
  lastname: string,
  email: string,
  phone: string,
  agentId: string,
  lowerCaseTags: string,
  dayToBeProcessed?: string,
): Promise<IContact | string> => {
  try {
    if (!firstname || !email || !phone) {
      return "Missing required fields";
    }
    function formatPhoneNumber(phoneNumber: string) {
      let digitsOnly = phoneNumber.replace(/[^0-9]/g, "");

      if (phoneNumber.startsWith("+1")) {
        return `+${digitsOnly}`;
      }

      return `+1${digitsOnly}`;
    }
    const createdContact = await contactModel.create({
      firstname,
      lastname,
      email,
      phone: formatPhoneNumber(phone),
      agentId,
      tags: lowerCaseTags,
      dayToBeProcessed,
    });
    return createdContact;
  } catch (error) {
    console.log("Error creating contact:", error);
    return null;
  }
};

export type ContactDocument = Omit<Document & IContact, "_id">;

export const getAllContact = async (
  agentId: string,
  page: number,
  limit: number,
  jobId?: string,
  dateOption?: DateOption,
) => {
  try {
    const skip = (page - 1) * limit;
    let dateFilter = {};
    let dateFilter1 = {};
    let tag = {};

    const timeZone = "America/Los_Angeles";
    const now = new Date();
    const zonedNow = toZonedTime(now, timeZone);
    const today = format(zonedNow, "yyyy-MM-dd", { timeZone });

    if (jobId) {
      const job = await jobModel.findOne({ jobId, agentId }).lean<any>();
      if (job && job.createdAt) {
        const createdAtDate = new Date(job.createdAt)
          .toISOString()
          .split("T")[0]; 
        dateFilter = { datesCalled: createdAtDate };
        dateFilter1 = { day: createdAtDate };
        tag = { tag: job.tagProcessedFor };
      }
    } else if (dateOption) {
      
      switch (dateOption) {
        case DateOption.Today:
          dateFilter = { datesCalled: today };
          dateFilter1 = { day: today };
          break;
        case DateOption.Yesterday:
          const zonedYesterday = toZonedTime(subDays(now, 1), timeZone);
          const yesterday = format(zonedYesterday, "yyyy-MM-dd", { timeZone });
          dateFilter = { datesCalled: yesterday };
          dateFilter1 = { day: yesterday };
          break;
        case DateOption.ThisWeek:
          const weekdays: string[] = [];
          for (let i = 0; i < 7; i++) {
            const day = subDays(zonedNow, i);
            const dayOfWeek = day.getDay();
            if (dayOfWeek !== 0 && dayOfWeek !== 6) {
              weekdays.push(format(day, "yyyy-MM-dd", { timeZone }));
            }
          }
          dateFilter = { datesCalled: { $in: weekdays } };
          dateFilter1 = { day: { $in: weekdays } };
          break;
        case DateOption.ThisMonth:
          const monthDates: string[] = [];
          for (let i = 0; i < now.getDate(); i++) {
            const day = subDays(now, i);
            monthDates.unshift(format(day, "yyyy-MM-dd", { timeZone }));
          }
          dateFilter = { datesCalled: { $in: monthDates } };
          dateFilter1 = { day: { $in: monthDates } };
          break;
        default:
          const recentJob = await jobModel
            .findOne({ agentId })
            .sort({ createdAt: -1 })
            .lean();

          if (recentJob) {
            const dateToCheck = recentJob.scheduledTime.split("T")[0];
            
            dateFilter = { datesCalled: dateToCheck };
            dateFilter1 = { day: dateToCheck };
          } else {
            dateFilter = {};
            dateFilter1 = {};
          }
          break;
        case DateOption.Total:
          dateFilter = {};
          dateFilter1 = {};
          break;
      }
    } 
    const foundContacts = await contactModel
      .find({ agentId, isDeleted: false, ...dateFilter, ...tag })
      .sort({ createdAt: "desc" })
      .populate("referenceToCallId")
      .skip(skip)
      .limit(limit);

      console.log({agentId, dateFilter, tag})
   
    const totalCount = await contactModel
      .countDocuments({ agentId, isDeleted: false, ...dateFilter, ...tag })

    const totalContactForAgent = await contactModel.countDocuments({
      agentId,
      isDeleted: false,
    });
    const totalNotCalledForAgent = await contactModel.countDocuments({
      agentId,
      isDeleted: false,
      status: callstatusenum.NOT_CALLED,
    });

    const stats = await DailyStatsModel.aggregate([
      { $match: { agentId, ...dateFilter1 } },
      {
        $group: {
          _id: null,
          totalCalls: { $sum: "$totalCalls" },
          totalAnsweredByVm: { $sum: "$totalAnsweredByVm" },
          totalAppointment: { $sum: "$totalAppointment" },
          totalCallsTransffered: { $sum: "$totalTransffered" },
          totalFailedCalls: { $sum: "$totalFailed" },
          totalAnsweredCalls: { $sum: "$totalCallAnswered" },
          totalDialNoAnswer: { $sum: "$totalDialNoAnswer" },
          totalAnsweredByIVR: { $sum: "$totalAnsweredByIVR" },
          totalCallInactivity: { $sum: "$totalCallInactivity" },
          totalCallDuration: { $sum: "$totalCallDuration" },
        },
      },
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    const statsWithTranscripts = await Promise.all(
      foundContacts.map(async (stat) => {
        const transcript = stat.referenceToCallId?.transcript;
        const analyzedTranscript = stat.referenceToCallId?.analyzedTranscript;
        return {
          ...stat.toObject(),
          originalTranscript: transcript,
          analyzedTranscript,
        };
      }),
    );

    function convertMsToHourMinSec(ms: number): string {
      const totalSeconds = Math.floor(ms / 1000);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;

      return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
        2,
        "0",
      )}:${String(seconds).padStart(2, "0")}`;
    }

    const combinedCallDuration = convertMsToHourMinSec(
      stats[0]?.totalCallDuration || 0,
    );

    return {
      totalContactForAgent,
      totalAnsweredCalls: stats[0]?.totalAnsweredCalls || 0,
      totalAnsweredByVm: stats[0]?.totalAnsweredByVm || 0,
      totalAppointment: stats[0]?.totalAppointment || 0,
      totalCallsTransffered: stats[0]?.totalCallsTransffered || 0,
      totalNotCalledForAgent,
      totalCalls: stats[0]?.totalCalls || 0,
      totalFailedCalls: stats[0]?.totalFailedCalls || 0,
      totalAnsweredByIVR: stats[0]?.totalAnsweredByIVR || 0,
      totalDialNoAnswer: stats[0]?.totalDialNoAnswer || 0,
      totalCallInactivity: stats[0]?.totalCallInactivity || 0,
      callDuration: combinedCallDuration,
      totalPages,
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

export const updateContactAndTranscript = async (
  updates: any,
): Promise<any> => {
  try {
    for (const update of updates) {
      if (update.id) {
        await contactModel.findOneAndUpdate(
          {
            _id: new mongoose.Types.ObjectId(update.id),
            isDeleted: { $ne: true },
          },
          { $set: update.updateFields },
          { new: true },
        );
      }

      if (
        update.updateFields.referencetocallid &&
        update.updateFields.referencetocallid.id
      ) {
        await EventModel.findOneAndUpdate(
          {
            _id: new mongoose.Types.ObjectId(
              update.updateFields.referencetocallid.id,
            ),
          },
          { $set: update.updateFields.referencetocallid.updateFields },
          { new: true },
        );
      }
    }

    return "Update successful";
  } catch (error) {
    console.error("Error updating contact and transcript:", error);
    return "Could not update contact and transcript";
  }
};
