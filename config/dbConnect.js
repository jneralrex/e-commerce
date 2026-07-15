const moongose = require("mongoose");
const { config } = require("./config");

const connectDataBase = async() => {
try {
    await moongose.connect(config.mongo_uri)
    console.log("MongoDb connected");
} catch (error) {
  if (error.code === "ENOTFOUND" || error.message.includes("ECONNRESET")) {
    console.error(
      "Unable to connect to MongoDB. Check your internet connection and try again."
    );
    process.exit(1);
  } else {
    console.error("MongoDB connection error:", error.message);
    process.exit(1);
  };
};
};
module.exports=connectDataBase;