import mongoose from 'mongoose';
import { startPracticeExam } from './lib/mcq/practice-service';

const MONGODB_URI = "mongodb+srv://mostafij:6Mc7VjDDTAVTBoIg@cluster0.31sbm5t.mongodb.net/?appName=Cluster0/absp";
process.env.MONGODB_URI = MONGODB_URI;

async function run() {
  try {
    console.log("Connecting to DB...");
    await mongoose.connect(MONGODB_URI, { dbName: 'absp' });
    if (!mongoose.connection.db) {
      throw new Error("Database connection not established.");
    }
    const pqCollection = mongoose.connection.db.collection('practicequestions');

    // Run startPracticeExam 100 times and count how many questions from each chapter we get!
    const chapterDistribution: Record<string, number> = {
      "Chapter 2: Motion": 0,
      "Chapter 3: Force": 0,
      "Chapter 4: Work, Power and Energy": 0
    };

    console.log("Running 100 simulations of startPracticeExam...");
    for (let i = 0; i < 100; i++) {
      const examData = await startPracticeExam("পদার্থবিজ্ঞান", "class-9", [
        "Chapter 2: Motion",
        "Chapter 3: Force",
        "Chapter 4: Work, Power and Energy"
      ], 25);
      
      // Look up each question's chapter
      for (const q of examData.questions) {
        const qDoc = await pqCollection.findOne({ _id: new mongoose.Types.ObjectId(q.id) });
        if (qDoc && qDoc.chapter in chapterDistribution) {
          chapterDistribution[qDoc.chapter]++;
        }
      }
    }

    console.log("Chapter distribution across 100 runs (2500 total questions sampled):");
    console.log(JSON.stringify(chapterDistribution, null, 2));

  } catch (error) {
    console.error("Error:", error);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected.");
  }
}

run();
