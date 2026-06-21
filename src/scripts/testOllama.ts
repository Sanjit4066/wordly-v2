import { reviewWithOllama } from "../agents/sentenceReview/providers/ollama";

async function main() {
    const result = await reviewWithOllama(
        "ephemeral",
        "The meeting was ephemeral and didn't last long"
    );
    console.log(result);
}

main();