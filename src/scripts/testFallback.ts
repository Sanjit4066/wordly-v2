import { reviewSentence } from "../agents/sentenceReview";

async function main() {
  console.log("🚀 Testing Sentence Review Fallback Chain...");
  try {
    const result = await reviewSentence(
      "ephemeral",
      "The meeting was ephemeral and didn't last long"
    );
    console.log("\n✅ Review Success!");
    console.log(JSON.stringify(result, null, 2));
  } catch (err: any) {
    console.error("\n❌ Review Failed:", err.message || err);
  }
}

main();
