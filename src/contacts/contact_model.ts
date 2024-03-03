import  { Schema, model } from 'mongoose';
import mongoose from "mongoose"
import { IContact } from '../types';


enum status {
    CALLED  = "Called",
    NOT_CALLED = "Not called",
    CALLING = "Calling",
    VOICEMAIL = "Voicemail"
}
const ContactSchema =new Schema<IContact>({
    firstname: {
        type: String
    },
    email: {
        type: String
    },
    lastname:{
        type: String
    },
    phone: {
        type: String
    },
    isusercalled:{
        type: Boolean,
        default: false
    },
    isDeleted: {
        type: Boolean,
        default: false
    },
    callId:{
        type: String
    },
    status:{
        type: String,
        enum: Object.values(status),
        default: status.NOT_CALLED
    }
}, {timestamps: true})

export const contactModel  = model<IContact>("Retell", ContactSchema)
const db = process.env.URL
export const connectDb = async (): Promise<void> => {
	try {
		const conn = await mongoose.connect(db);
		console.log('MongoDB Connected to ' + conn.connection.name);
	} catch (error) {
		console.log('Error: ' + (error as Error).message);
		process.exit(1);
	}
};
