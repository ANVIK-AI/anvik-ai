import pino from "pino";


const logger = pino({
level: process.env.NODE_ENV === "production" ? "info" : "debug",
base: { service: "backend" }
});


export default logger;