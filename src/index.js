// require("dotenv").config();
import dotenv, { config } from "dotenv";
import connectDB from "./db/index.js";

dotenv.config({
    path: "./env"
})

connectDB();

/*
( async () => {
    try{
        await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`)
    }
    catch{
        console.log("ERROR: ", error);
        throw error;
    }
})()
*/