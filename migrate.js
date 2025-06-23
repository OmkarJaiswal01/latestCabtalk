import mongoose from "mongoose";
import Asset from "./src/models/assetModel.js";

const MONGO_URI =
  "mongodb+srv://hariomtri27:12341234@cdb.3a41aii.mongodb.net/CDB";

async function migrate() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB");

    const assets = await Asset.find({}, "passengers").lean();
    console.log(`🔎 Found ${assets.length} assets to migrate`);

    for (const doc of assets) {
      if (
        doc.passengers.length > 0 &&
        typeof doc.passengers[0] === "object" &&
        doc.passengers[0].passenger
      ) {
        console.log(`– Asset ${doc._id} already migrated, skipping`);
        continue;
      }

      const newPassengers = doc.passengers.map((pid, idx) => ({
        passenger: pid,
        order: idx + 1,
        requiresTransport: true,
      }));

      await Asset.updateOne(
        { _id: doc._id },
        { $set: { passengers: newPassengers } }
      );
      console.log(`✔ Migrated Asset ${doc._id}`);
    }

    console.log("🎉 Migration complete");
  } catch (err) {
    console.error("❌ Migration failed:", err);
  } finally {
    await mongoose.disconnect();
    console.log("🛑 Disconnected from MongoDB");
  }
}

migrate();