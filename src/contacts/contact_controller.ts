import { IContact } from "../types";
import { contactModel } from "./contact_model";
import { Document } from "mongoose";

export const createContact = async (
  firstname: string,
  lastname: string,
  email: string,
  phone: string,
  agentId: string
): Promise<IContact | string> => {
  try {
    if (!firstname || !email || !phone) {
      return "Missing required fields"
    }
    const createdContact = await contactModel.create({
      firstname,
      lastname,
      email,
      phone,
      agentId
    });
    return createdContact;
  } catch (error) {
    console.log("Error creating contact:", error);
    return null;
  }
};

type ContactDocument = Omit<Document & IContact, "_id">;

// export const getAllContact = async (agentId: string, limit:number, page:number): Promise<ContactDocument[] | string>  => {
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

//     // Calculate the total number of pages
//     const totalPages = Math.ceil(totalCount / limit);

//     // Return the contacts and total pages
//     return  {} 
//   } catch (error) {
//     console.error("Error fetching all contacts:", error);
//     return "error getting contact";
//   }
// };
export const getAllContact = async (agentId: string, limit: number, page: number): Promise<{ contacts: ContactDocument[], totalPages: number } | string> => {
  try {
    const skip = (page - 1) * limit;
    const foundContacts = await contactModel
      .find({ agentId, isDeleted: { $ne: true } })
      .sort({ createdAt: "desc" })
      .populate("referenceToCallId")
      .skip(skip)
      .limit(limit);

    // Count the total number of documents
    const totalCount = await contactModel.countDocuments({ agentId, isDeleted: { $ne: true } });

    // Calculate the total number of pages
    const totalPages = Math.ceil(totalCount / limit);

    // Return the contacts and total pages
    return { totalPages, contacts: foundContacts };
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
    return "delete failed, something went wrong"
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