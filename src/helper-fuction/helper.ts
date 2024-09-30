
// import { DateOption, IContact, callstatusenum } from "../types";
// import { contactModel, EventModel, jobModel } from "../contacts/contact_model";
// import { subDays, startOfMonth, startOfWeek } from "date-fns";
// import { format, toZonedTime } from "date-fns-tz";
// import { ContactDocument } from "../contacts/contact_controller";

// export async function getDateFilters(dateOption: DateOption) {
//     const timeZone = "America/Los_Angeles"; 
//     const now = new Date();
//     const zonedNow = toZonedTime(now, timeZone);
//     const today = format(zonedNow, "yyyy-MM-dd", { timeZone });
  
//     let dateFilter = {};
//     let dateFilter1 = {};
  
//     switch (dateOption) {
//       case DateOption.Today:
//         dateFilter = { datesCalled: today };
//         dateFilter1 = { day: today };
//         break;
//       case DateOption.Yesterday:
//         const zonedYesterday = toZonedTime(subDays(now, 1), timeZone);
//         const yesterday = format(zonedYesterday, "yyyy-MM-dd", { timeZone });
//         dateFilter = { datesCalled: yesterday };
//         dateFilter1 = { day: yesterday };
//         break;
//       case DateOption.ThisWeek:
//         const pastDays = [];
//         for (let i = 1; pastDays.length < 5; i++) {
//           const day = subDays(now, i);
//           if (day.getDay() !== 0 && day.getDay() !== 6) {
//             pastDays.push(format(toZonedTime(day, timeZone), "yyyy-MM-dd", { timeZone }));
//           }
//         }
//         dateFilter = { datesCalled: { $gte: pastDays[pastDays.length - 1], $lte: today } };
//         dateFilter1 = { day: { $gte: pastDays[pastDays.length - 1], $lte: today } };
//         break;
//       case DateOption.ThisMonth:
//         const startOfMonthDate = format(toZonedTime(startOfMonth(now), timeZone), "yyyy-MM-dd", { timeZone });
//         dateFilter = { datesCalled: { $gte: startOfMonthDate } };
//         dateFilter1 = { day: { $gte: startOfMonthDate } };
//         break;
//       case DateOption.Total:
//         dateFilter = {};
//         dateFilter1 = {};
//         break;
//       case DateOption.LAST_SCHEDULE:
//         const recentJob = await jobModel.findOne({}).sort({ createdAt: -1 }).lean();
//         if (!recentJob) throw new Error("No jobs found for today's filter.");
//         const dateToCheck = recentJob.scheduledTime.split("T")[0];
//         dateFilter = { datesCalled: { $gte: dateToCheck } };
//         dateFilter1 = { day: { $gte: dateToCheck } };
//         break;
//       default:
//         throw new Error("Invalid dateOption");
//     }
  
//     return { dateFilter, dateFilter1 };
//   }
  

//   async function getAnalyzedTranscript(contact: IContact): Promise<string | null> {
//     if (!contact.referenceToCallId) {
//       return null; // No reference to a callId, return null
//     }
  
//     try {
//       // Fetch the transcript using the referenceToCallId
//       const transcriptRecord = await EventModel.findById(contact.referenceToCallId);
  
//       // If a transcript is found, return its analyzedTranscript
//       if (transcriptRecord) {
//         return transcriptRecord.analyzedTranscript || null; // Return analyzedTranscript or null if not found
//       } else {
//         return null; // No transcript found for this referenceToCallId
//       }
//     } catch (error) {
//       console.error(`Error fetching transcript for contact ${contact.email}:`, error);
//       return null; // Return null if any error occurs
//     }
//   }
  

//   export async function enrichContacts(contacts: IContact[]): Promise<IContact[]> {
//     const enrichedContacts = await Promise.all(
//       contacts.map(async (contact) => {
//         const analyzedTranscript = await getAnalyzedTranscript(contact);
  
//         // Update the contact with the analyzed transcript
//         return {
//           ...contact, // Convert Mongoose document to plain object
//           analyzedTranscript, // Add the transcript to the contact
//         };
//       })
//     );
  
//     return enrichedContacts;
//   }
  