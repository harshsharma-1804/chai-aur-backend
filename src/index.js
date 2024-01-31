// require("dotenv").config();
import dotenv, { config } from "dotenv";
import connectDB from "./db/index.js";

dotenv.config({
    path: "./env"
})

connectDB()
.then(() => {

    application.on("error",(error) => {
        console.log("ERROR: ",error)
        throw error
    })

    application.listen(process.env.PORT || 8000, () => {
        console.log(`Server is running on port ${process.env.PORT}`)
    })
})
.catch((error) => {
    console.log("MongoDB Connection failed!!! ", error);
    throw error;
})

/*
( async () => {
    try{
        await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`)

        app.on("error", (error) => {
            console.log("ERROR: ", error);
            throw error;
        })

        app.listen(process.env.PORT || 8000, () => { 
            console.log(`Server is running on port ${process.env.PORT}`); 
        })
    }
    catch{
        console.log("ERROR: ", error);
        throw error;
    }
})()
*/