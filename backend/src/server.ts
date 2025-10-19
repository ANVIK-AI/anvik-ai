import "dotenv/config";
import app from "./app.js";
import logger from "./utils/logger.js";

const PORT = process.env.PORT || 4000;

const server = app.listen(PORT, () => {
    logger.info(`Server started on port ${PORT}`);
});

process.on("SIGINT", () => {
    logger.info("SIGINT received, shutting down");
    server.close(() => {
        logger.info("HTTP server closed");
        process.exit(0);
    });
});
