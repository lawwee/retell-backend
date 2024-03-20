import  { Schema, model } from 'mongoose';
import mongoose from "mongoose"
import { IContact, Ijob, callstatusenum, jobstatus } from '../types';

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
    agentId: {
        type: String
    },
    status:{
        type: String,
        enum: Object.values(callstatusenum),
        default: callstatusenum.NOT_CALLED
    }
}, {timestamps: true})

const jobschema = new Schema<Ijob>({
    callstatus:{
        type: String,
        enum:Object.values(jobstatus)
    },
    jobId: {
        type:String,
        required: true
    },
    
},{timestamps: true})

export const contactModel  = model<IContact>("Retell", ContactSchema)
export const jobModel = model<Ijob>("RetellJOb", jobschema);
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

