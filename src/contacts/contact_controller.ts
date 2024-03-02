import { IContact } from "../types";
import { contactModel } from "./contact_model";
import { Document } from "mongoose";

export const createContact = async (
  firstname: string,
  lastname: string,
  email: string,
  phone: string,
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
    });
    return createdContact;
  } catch (error) {
    console.log("Error creating contact:", error);
    return null;
  }
};

type ContactDocument = Omit<Document & IContact, "_id">;
export const getAllContact = async (): Promise<ContactDocument[] | null> => {
  try {
    const foundContacts = await contactModel
      .find({ isDeleted: { $ne: true } })
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
