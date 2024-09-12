import { populate } from "dotenv";
import { reviewTranscript } from "../helper-fuction/transcript-review";
import { DateOption, IContact, callstatusenum } from "../types";
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

type ContactDocument = Omit<Document & IContact, "_id">;

export const getAllContact = async (
  agentId: string,
  page: number,
  limit: number,
  dateOption: DateOption = DateOption.LAST_SCHEDULE,
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
      totalCalls: number;
      totalFailedCalls: number;
    }
  | string
> => {
  try {
    const skip = (page - 1) * limit;

    let dateFilter = {};
    let dateFilter1 = {};

    const timeZone = "America/Los_Angeles"; // PST time zone
    const now = new Date();
    const zonedNow = toZonedTime(now, timeZone);
    const today = format(zonedNow, "yyyy-MM-dd", { timeZone });

    switch (dateOption) {
      case DateOption.Today:
        dateFilter = { datesCalled: today };
        break;
      case DateOption.Yesterday:
        const zonedYesterday = toZonedTime(subDays(now, 1), timeZone);
        const yesterday = format(zonedYesterday, "yyyy-MM-dd", { timeZone });
        dateFilter = { datesCalled: yesterday };
        break;
      case DateOption.ThisWeek:
        const pastDays = [];
        for (let i = 1; pastDays.length < 5; i++) {
          const day = subDays(now, i);
          const dayOfWeek = day.getDay();
          if (dayOfWeek !== 0 && dayOfWeek !== 6) {
            // Exclude weekends
            pastDays.push(
              format(toZonedTime(day, timeZone), "yyyy-MM-dd", { timeZone }),
            );
          }
        }
        dateFilter = {
          datesCalled: { $gte: pastDays[pastDays.length - 1], $lte: today },
        };
        break;

      case DateOption.ThisMonth:
        const zonedStartOfMonth = toZonedTime(startOfMonth(now), timeZone);
        const startOfMonthDate = format(zonedStartOfMonth, "yyyy-MM-dd", {
          timeZone,
        });
        dateFilter = { datesCalled: { $gte: startOfMonthDate } };
        break;
      case DateOption.Total:
        dateFilter = {};
        break;
      case DateOption.LAST_SCHEDULE:
        const recentJob = await jobModel
          .findOne({})
          .sort({ createdAt: -1 })
          .lean();
        if (!recentJob) {
          return "No jobs found for today's filter.";
        }
        const dateToCheck = recentJob.scheduledTime.split("T")[0];
        dateFilter = { datesCalled: { $gte: dateToCheck } };
        break;
      default:
        const recentJob1 = await jobModel
          .findOne({})
          .sort({ createdAt: -1 })
          .lean();
        if (!recentJob1) {
          return "No jobs found for today's filter.";
        }
        const dateToCheck1 = recentJob1.scheduledTime.split("T")[0];
        dateFilter = { datesCalled: { $gte: dateToCheck1 } };
        break;
    }

    switch (dateOption) {
      case DateOption.Today:
        dateFilter1 = { day: today };
        break;
      case DateOption.Yesterday:
        const zonedYesterday = toZonedTime(subDays(now, 1), timeZone);
        const yesterday = format(zonedYesterday, "yyyy-MM-dd", { timeZone });
        dateFilter1 = { day: yesterday };
        break;
      case DateOption.ThisWeek:
        const pastDays = [];
        for (let i = 1; pastDays.length < 5; i++) {
          const day = subDays(now, i);
          const dayOfWeek = day.getDay();
          if (dayOfWeek !== 0 && dayOfWeek !== 6) {
            // Exclude weekends
            pastDays.push(
              format(toZonedTime(day, timeZone), "yyyy-MM-dd", { timeZone }),
            );
          }
        }
        dateFilter1 = {
          day: { $gte: pastDays[pastDays.length - 1], $lte: today },
        };
        break;

      case DateOption.ThisMonth:
        const zonedStartOfMonth = toZonedTime(startOfMonth(now), timeZone);
        const startOfMonthDate = format(zonedStartOfMonth, "yyyy-MM-dd", {
          timeZone,
        });
        dateFilter1 = { day: { $gte: startOfMonthDate } };
        break;
      case DateOption.Total:
        dateFilter1 = {};
        break;
      case DateOption.LAST_SCHEDULE:
        const recentJob = await jobModel
          .findOne({})
          .sort({ createdAt: -1 })
          .lean();
        if (!recentJob) {
          return "No jobs found for today's filter.";
        }
        const dateToCheck = recentJob.scheduledTime.split("T")[0];
        dateFilter1 = { day: { $gte: dateToCheck } };
        break;
      default:
        const recentJob1 = await jobModel
          .findOne({})
          .sort({ createdAt: -1 })
          .lean();
        if (!recentJob1) {
          return "No jobs found for today's filter.";
        }
        const dateToCheck1 = recentJob1.scheduledTime.split("T")[0];
        dateFilter1 = { day: { $gte: dateToCheck1 } };
        break;
    }

    const foundContacts = await contactModel
      .find({ agentId, isDeleted: false, ...dateFilter })
      .sort({ createdAt: "desc" })
      .populate("referenceToCallId")
      .skip(skip)
      .limit(limit);

    const totalCount = await contactModel.countDocuments({
      agentId,
      isDeleted: { $ne: true },
    });
    const totalContactForAgent = await contactModel.countDocuments({
      agentId,
      isDeleted: false,
    });
    const totalNotCalledForAgent = await contactModel.countDocuments({
      agentId,
      isDeleted: false,
      status: callstatusenum.NOT_CALLED,
    });
    const totalAnsweredCalls = await contactModel.countDocuments({
      agentId,
      isDeleted: false,
      status: callstatusenum.CALLED,
      ...dateFilter,
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
        } as ContactDocument;
      }),
    );

    return {
      totalContactForAgent,
      totalAnsweredCalls,
      totalAnsweredByVm: stats[0]?.totalAnsweredByVm || 0,
      totalAppointment: stats[0]?.totalAppointment || 0,
      totalCallsTransffered: stats[0]?.totalCallsTransffered || 0,
      totalNotCalledForAgent,
      totalCalls: stats[0]?.totalCalls || 0,
      totalFailedCalls: stats[0]?.totalFailedCalls || 0,
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
