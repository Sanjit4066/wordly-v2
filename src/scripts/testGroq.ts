import { reviewWithGroq } from "../agents/sentenceReview/providers/groq";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

async function main() {
  console.log("🚀 Testing Groq Provider directly...");
  try {
    const result = await reviewWithGroq(
      "ephemeral",
      "The meeting was ephemeral and didn't last long"
    );
    console.log("\n✅ Groq Review Success!");
    console.log(JSON.stringify(result, null, 2));
  } catch (err: any) {
    console.error("\n❌ Groq Review Failed:", err.message || err);
  }
}

main();
