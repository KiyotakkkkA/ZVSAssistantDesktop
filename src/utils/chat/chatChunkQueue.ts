import type { AssistantStage, ChatMessage } from "../../types/Chat";
import { appendAssistantStageChunk } from "./chatStream";

type QueueStage = Extract<AssistantStage, "thinking" | "answering">;

type ChatChunkQueueManagerParams = {
    answeringAt: string;
    updateMessages: (updater: (prev: ChatMessage[]) => ChatMessage[]) => void;
    flushChunkLimitPerFrame?: number;
};

export const createChatChunkQueueManager = ({
    answeringAt,
    updateMessages,
    flushChunkLimitPerFrame = 6,
}: ChatChunkQueueManagerParams) => {
    const queue: Array<{ stage: QueueStage; chunkText: string }> = [];
    let queueDrainResolver: (() => void) | null = null;
    let flushFrameId: number | null = null;

    const resolveQueueDrain = () => {
        if (queue.length !== 0 || flushFrameId !== null) {
            return;
        }

        if (queueDrainResolver) {
            const resolve = queueDrainResolver;
            queueDrainResolver = null;
            resolve();
        }
    };

    const flushBatch = (
        items: Array<{ stage: QueueStage; chunkText: string }>,
    ) => {
        if (items.length === 0) {
            return;
        }

        updateMessages((prev) =>
            items.reduce(
                (accumulator, item) =>
                    appendAssistantStageChunk(
                        accumulator,
                        answeringAt,
                        item.stage,
                        item.chunkText,
                    ),
                prev,
            ),
        );
    };

    const flushChunkQueue = () => {
        flushFrameId = null;

        if (queue.length === 0) {
            resolveQueueDrain();
            return;
        }

        const frameBatch = queue.splice(0, flushChunkLimitPerFrame);
        flushBatch(frameBatch);

        if (queue.length > 0) {
            flushFrameId = window.requestAnimationFrame(flushChunkQueue);
            return;
        }

        resolveQueueDrain();
    };

    const scheduleFlush = () => {
        if (flushFrameId !== null) {
            return;
        }

        flushFrameId = window.requestAnimationFrame(flushChunkQueue);
    };

    const enqueue = (stage: QueueStage, chunkText: string) => {
        if (!chunkText) {
            return;
        }

        queue.push({ stage, chunkText });

        scheduleFlush();
    };

    const flushImmediate = () => {
        if (flushFrameId !== null) {
            window.cancelAnimationFrame(flushFrameId);
            flushFrameId = null;
        }

        if (queue.length === 0) {
            resolveQueueDrain();
            return;
        }

        const immediateBatch = queue.splice(0, queue.length);
        flushBatch(immediateBatch);
        resolveQueueDrain();
    };

    const waitForDrain = async () => {
        if (queue.length === 0 && flushFrameId === null) {
            return;
        }

        await new Promise<void>((resolve) => {
            queueDrainResolver = resolve;
        });
    };

    const reset = () => {
        queue.length = 0;

        if (flushFrameId !== null) {
            window.cancelAnimationFrame(flushFrameId);
            flushFrameId = null;
        }

        resolveQueueDrain();
    };

    return {
        enqueue,
        flushImmediate,
        waitForDrain,
        reset,
    };
};
