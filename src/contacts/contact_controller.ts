import { IContact } from "../types";
import { contactModel } from "./contact_model";
import { Document } from "mongoose";

export const createContact = async (
  firstname: string,
  lastname: string,
  email: string,
  phone: string,
  agentId: string
): Promise<IContact | null> => {
  try {
    if (!firstname || !lastname || !email || !phone) {
      throw new Error("Missing required fields");
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
export const getAllContact = async (agentId: string): Promise<ContactDocument[] | null> => {
  try {
    const foundContacts = await contactModel
      .find({ agentId, isDeleted: { $ne: true } })
      .sort({ createdAt: "desc" });
    return foundContacts;
  } catch (error) {
    console.error("Error fetching all contacts:", error);
    return null;
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
    return null
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
    return null;
  }
};

// export const update = async (agentId: string) =>{ 


//    try {
//     // Find users who don't have an agentId field
//     const usersToUpdate = await contactModel.find({ agentId: { $exists: false } });

//     // Update users with the provided agentId
//     for (const user of usersToUpdate) {
//       await contactModel.updateOne({ _id: user._id }, { $set: { agentId: agentId } });
//     }

//     console.log("Users updated successfully.");
//   } catch (error) {
//     console.error("Error updating users:", error);
//   }
// };
