import dotenv from 'dotenv';
import connectDB from "./db/index.js";

dotenv.config(
    {
        path: './env'
    }
)


connectDB().then(() => { app.listen( process.env.PORT || 8000 ,(req,res) => {
                            console.log(`Server listening on port ${process.env.PORT}...`);
                        });
                        app.on("error",(error) => {
                            console.log("Server Err: ", error);
                            throw error;
                            })
                        })
            .catch((err) => {"MongoDB connection failed !!!", err});







/*
import express from 'express'
const app = express()
(async () => {
    try{
        mongoose.connect(`${process.env.MONGOOSE_URI}/${DB_NAME}`)
        app.on("error", (error) => {
            console.log(`Not able to talk to the ${DB_NAME} database!`);
            throw error;
        })
        app.listen(process.env.PORT,() => {
            console.log(`Server is listening on port ${process.env.PORT}`);
        })

    }catch(error){
        console.error("Error: ", error);
        throw error;
    }
}) */

