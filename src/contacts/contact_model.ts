import mongoose, { Schema, model } from 'mongoose';
import { IContact } from '../types';

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
        type: Number
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
