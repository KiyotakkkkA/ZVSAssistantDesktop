import { ChatGenService } from "../electron/services/ChatGenService.ts";

const chatGenService = new ChatGenService("");

const result = chatGenService.streamResponseGeneration({
    prompt: "Write a haiku.",
    model: "gpt-oss:120b",
});

for await (const chunk of result.fullStream) {
    process.stdout.write(JSON.stringify(chunk));
}
console.log("\nTotal Usage:", await result.getTotalUsage());
