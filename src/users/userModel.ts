import {model,Schema} from "mongoose";

const userSchema = new Schema({
    email:{
        type: String,
        unique: true
    },
    password:{
        type: String
    },
    group:{
        type: String,
        enum:["BE+WELL", "TVAG"]
    }

})

export const userModel = model("User", userSchema)