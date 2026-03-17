import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@iconify/react";
import { observer } from "mobx-react-lite";
import { useToasts } from "../../../hooks";
import { useChatParams } from "../../../hooks/useChatParams";
import { useScenario, useScenarioConvert } from "../../../hooks/agents";
import { useFileUpload } from "../../../hooks/files";
import { chatsStore } from "../../../stores/chatsStore";
import type {
    UploadedFileData,
    VoiceTranscriptionEvent,
} from "../../../types/ElectronApi";
import { encodeScenarioLaunchPayload } from "../../../utils/scenario/scenarioLaunchEnvelope";
import { Button, Dropdown, Floating, InputBig, Modal } from "../atoms";
import { RequiredToolsPickForm } from "../organisms/forms";

const MISTRAL_SAMPLE_RATE = 16000;
const VOICE_EQUALIZER_BARS_COUNT = 12;
const VOICE_SILENCE_TIMEOUT_MS = 1000;
const VOICE_EQUALIZER_BAR_IDS = Array.from(
    { length: VOICE_EQUALIZER_BARS_COUNT },
    (_, index) => `voice-eq-${index}`,
);

type PcmRealtimeCapture = {
    audioStream: AsyncGenerator<Uint8Array, void, unknown>;
    stop: () => Promise<void>;
    readEqualizerBars: () => number[];
};

const createPcmRealtimeCapture = async (): Promise<PcmRealtimeCapture> => {
    const mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
            channelCount: 1,
            sampleRate: MISTRAL_SAMPLE_RATE,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
        },
    });

    const audioContext = new AudioContext({ sampleRate: MISTRAL_SAMPLE_RATE });
    const sourceNode = audioContext.createMediaStreamSource(mediaStream);
    const analyserNode = audioContext.createAnalyser();
    const processorNode = audioContext.createScriptProcessor(4096, 1, 1);

    analyserNode.fftSize = 1024;
    analyserNode.smoothingTimeConstant = 0.75;

    const frequencyData = new Uint8Array(analyserNode.frequencyBinCount);

    const chunkQueue: Uint8Array[] = [];
    const waiters: Array<() => void> = [];

    let ended = false;
    let stopPromise: Promise<void> | null = null;

    const notify = () => {
        while (waiters.length > 0) {
            const resolve = waiters.shift();
            resolve?.();
        }
    };

    const enqueueChunk = (chunk: Uint8Array) => {
        if (ended) {
            return;
        }

        chunkQueue.push(chunk);
        notify();
    };

    processorNode.onaudioprocess = (event) => {
        const inputData = event.inputBuffer.getChannelData(0);
        const pcm = new Int16Array(inputData.length);

        for (let index = 0; index < inputData.length; index += 1) {
            const sample = Math.max(-1, Math.min(1, inputData[index]));
            pcm[index] =
                sample < 0
                    ? Math.round(sample * 0x8000)
                    : Math.round(sample * 0x7fff);
        }

        enqueueChunk(new Uint8Array(pcm.buffer));
    };

    sourceNode.connect(analyserNode);
    sourceNode.connect(processorNode);
    processorNode.connect(audioContext.destination);

    const readEqualizerBars = () => {
        analyserNode.getByteFrequencyData(frequencyData);

        const bars = new Array<number>(VOICE_EQUALIZER_BARS_COUNT).fill(0);
        const binsPerBar = Math.max(
            1,
            Math.floor(frequencyData.length / VOICE_EQUALIZER_BARS_COUNT),
        );

        for (
            let barIndex = 0;
            barIndex < VOICE_EQUALIZER_BARS_COUNT;
            barIndex += 1
        ) {
            const start = barIndex * binsPerBar;
            const end = Math.min(frequencyData.length, start + binsPerBar);

            if (start >= end) {
                bars[barIndex] = 6;
                continue;
            }

            let sum = 0;
            for (let index = start; index < end; index += 1) {
                sum += frequencyData[index];
            }

            const avg = sum / (end - start);
            bars[barIndex] = Math.max(6, Math.min(100, (avg / 255) * 100));
        }

        return bars;
    };

    const stop = async () => {
        if (stopPromise) {
            return stopPromise;
        }

        stopPromise = (async () => {
            if (ended) {
                return;
            }

            ended = true;
            analyserNode.disconnect();
            processorNode.disconnect();
            sourceNode.disconnect();

            mediaStream.getTracks().forEach((track) => track.stop());

            if (audioContext.state !== "closed") {
                await audioContext.close();
            }

            notify();
        })();

        return stopPromise;
    };

    async function* streamGenerator(): AsyncGenerator<
        Uint8Array,
        void,
        unknown
    > {
        try {
            while (true) {
                if (chunkQueue.length > 0) {
                    const nextChunk = chunkQueue.shift();

                    if (nextChunk) {
                        yield nextChunk;
                        continue;
                    }
                }

                if (ended) {
                    break;
                }

                await new Promise<void>((resolve) => {
                    waiters.push(resolve);
                });
            }
        } finally {
            await stop();
        }
    }

    return {
        audioStream: streamGenerator(),
        stop,
        readEqualizerBars,
    };
};

interface MessageComposerProps {
    onMessageSend: (content: string) => void;
    onCancelGeneration: () => void;
    isStreaming?: boolean;
}

type VoiceListeningResult = "sent" | "empty" | "error";

export const MessageComposer = observer(function MessageComposer({
    onMessageSend,
    onCancelGeneration,
    isStreaming = false,
}: MessageComposerProps) {
    const toasts = useToasts();
    const { userProfile } = useChatParams();
    const {
        chatDriver,
        ollamaModel,
        mistralVoiceRecModel,
        mistralToken,
        useSpeechSynthesis,
        voiceRecognitionDriver,
    } = userProfile;
    const { scenarios, switchScenario } = useScenario();
    const { scenarioToFlow } = useScenarioConvert();

    const [msgContent, setMsgContent] = useState("");
    const [isToolsModalOpen, setIsToolsModalOpen] = useState(false);
    const [isScenarioModalOpen, setIsScenarioModalOpen] = useState(false);
    const [toolsQuery, setToolsQuery] = useState("");
    const [startingScenarioId, setStartingScenarioId] = useState<string | null>(
        null,
    );
    const [attachedImages, setAttachedImages] = useState<UploadedFileData[]>(
        [],
    );
    const [isVoiceListening, setIsVoiceListening] = useState(false);
    const [isVoiceChatMode, setIsVoiceChatMode] = useState(false);
    const [isAssistantSpeaking, setIsAssistantSpeaking] = useState(false);
    const [voiceTranscriptPreview, setVoiceTranscriptPreview] = useState("");
    const [voiceEqualizerBars, setVoiceEqualizerBars] = useState<number[]>(() =>
        new Array<number>(VOICE_EQUALIZER_BARS_COUNT).fill(6),
    );
    const areaRef = useRef<HTMLTextAreaElement>(null);
    const stopVoiceCaptureRef = useRef<(() => Promise<void>) | null>(null);
    const stopEqualizerAnimationRef = useRef<(() => void) | null>(null);
    const voiceSessionIdRef = useRef<string | null>(null);
    const unsubscribeVoiceEventsRef = useRef<(() => void) | null>(null);
    const resolveVoiceDoneRef = useRef<(() => void) | null>(null);
    const rejectVoiceDoneRef = useRef<((error: Error) => void) | null>(null);
    const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isVoiceChatModeRef = useRef(false);
    const isVoiceListeningRef = useRef(false);
    const isStreamingRef = useRef(isStreaming);
    const voiceChatLoopTokenRef = useRef(0);
    const isVoiceChatLoopRunningRef = useRef(false);
    const streamingWaitersRef = useRef<Array<() => void>>([]);
    const voiceChatStopWaitersRef = useRef<Array<() => void>>([]);
    const previousIsStreamingRef = useRef(isStreaming);
    const speechRequestTokenRef = useRef(0);
    const speechAudioRef = useRef<HTMLAudioElement | null>(null);
    const speechObjectUrlRef = useRef<string | null>(null);
    const speechBusyRef = useRef(false);
    const speechBusyWaitersRef = useRef<Array<() => void>>([]);
    const lastSpokenAssistantMessageIdRef = useRef<string | null>(null);
    const voiceTranscriptPreviewFrameRef = useRef<number | null>(null);
    const pendingVoiceTranscriptPreviewRef = useRef("");
    const { isUploading, pickFiles } = useFileUpload();

    const dialogTokenUsage = chatsStore.activeDialog?.tokenUsage;
    const activeDialogId = chatsStore.activeDialog?.id ?? null;
    const dialogMessagesCount = chatsStore.activeDialog?.messages.length ?? 0;

    const contextWindow = dialogTokenUsage?.contextWindow;

    const contextWindowRows = [
        {
            key: "system",
            label: "Системный промпт",
            value: contextWindow?.system ?? 0,
        },
        {
            key: "systemInstructions",
            label: "Системные инструкции",
            value: contextWindow?.systemInstructions ?? 0,
        },
        {
            key: "toolDefinitions",
            label: "Определения инструментов",
            value: contextWindow?.toolDefinitions ?? 0,
        },
        {
            key: "reservedOutput",
            label: "Резерв вывода",
            value: contextWindow?.reservedOutput ?? 0,
        },
        {
            key: "userContext",
            label: "Пользовательский контекст",
            value: contextWindow?.userContext ?? 0,
        },
        {
            key: "messages",
            label: "Сообщения",
            value: contextWindow?.messages ?? 0,
        },
        {
            key: "toolResults",
            label: "Результаты инструментов",
            value: contextWindow?.toolResults ?? 0,
        },
    ];
    const accountedContextRows = contextWindowRows.filter(
        (row) => row.value > 0,
    );
    const contextWindowTotal = accountedContextRows.reduce(
        (sum, row) => sum + row.value,
        0,
    );
    const contextWindowPercent = (value: number) => {
        if (contextWindowTotal <= 0) {
            return 0;
        }

        return Math.max(0, (value / contextWindowTotal) * 100);
    };

    useEffect(() => {
        isVoiceChatModeRef.current = isVoiceChatMode;
    }, [isVoiceChatMode]);

    useEffect(() => {
        isVoiceListeningRef.current = isVoiceListening;
    }, [isVoiceListening]);

    useEffect(() => {
        isStreamingRef.current = isStreaming;

        if (!isStreaming && streamingWaitersRef.current.length > 0) {
            const waiters = streamingWaitersRef.current;
            streamingWaitersRef.current = [];
            voiceChatStopWaitersRef.current = [];
            waiters.forEach((resolve) => resolve());
        }
    }, [isStreaming]);

    const setSpeechBusy = useCallback((nextBusy: boolean) => {
        if (speechBusyRef.current === nextBusy) {
            return;
        }

        speechBusyRef.current = nextBusy;
        setIsAssistantSpeaking(nextBusy);

        if (!nextBusy && speechBusyWaitersRef.current.length > 0) {
            const waiters = speechBusyWaitersRef.current;
            speechBusyWaitersRef.current = [];
            waiters.forEach((resolve) => resolve());
        }
    }, []);

    const waitForSpeechIdle = useCallback(async () => {
        if (!speechBusyRef.current) {
            return;
        }

        await new Promise<void>((resolve) => {
            speechBusyWaitersRef.current.push(resolve);
        });
    }, []);

    const resetVoiceTranscriptPreview = useCallback(() => {
        pendingVoiceTranscriptPreviewRef.current = "";

        if (voiceTranscriptPreviewFrameRef.current !== null) {
            window.cancelAnimationFrame(voiceTranscriptPreviewFrameRef.current);
            voiceTranscriptPreviewFrameRef.current = null;
        }

        setVoiceTranscriptPreview("");
    }, []);

    const scheduleVoiceTranscriptPreview = useCallback((nextText: string) => {
        pendingVoiceTranscriptPreviewRef.current = nextText;

        if (voiceTranscriptPreviewFrameRef.current !== null) {
            return;
        }

        voiceTranscriptPreviewFrameRef.current = window.requestAnimationFrame(
            () => {
                voiceTranscriptPreviewFrameRef.current = null;
                setVoiceTranscriptPreview(
                    pendingVoiceTranscriptPreviewRef.current,
                );
            },
        );
    }, []);

    const clearSpeechPlayback = useCallback(() => {
        const activeAudio = speechAudioRef.current;
        if (activeAudio) {
            activeAudio.pause();
            activeAudio.src = "";
            activeAudio.onended = null;
            activeAudio.onerror = null;
            speechAudioRef.current = null;
        }

        const activeObjectUrl = speechObjectUrlRef.current;
        if (activeObjectUrl) {
            URL.revokeObjectURL(activeObjectUrl);
            speechObjectUrlRef.current = null;
        }
    }, []);

    const stopSpeechPlayback = useCallback(
        (invalidatePending: boolean) => {
            if (invalidatePending) {
                speechRequestTokenRef.current += 1;
            }

            clearSpeechPlayback();
            setSpeechBusy(false);
        },
        [clearSpeechPlayback, setSpeechBusy],
    );

    const synthesizeAndPlaySpeech = useCallback(
        async (text: string) => {
            const voiceApi = window.appApi?.voice;
            const synthesize = voiceApi?.synthesizeSpeechWithPiper;
            const normalizedText = text.trim();

            if (!synthesize || !normalizedText) {
                return;
            }

            const requestToken = speechRequestTokenRef.current + 1;
            speechRequestTokenRef.current = requestToken;
            setSpeechBusy(true);
            clearSpeechPlayback();

            try {
                const wavBytes = await synthesize(normalizedText);

                if (
                    speechRequestTokenRef.current !== requestToken ||
                    !isVoiceChatModeRef.current ||
                    !useSpeechSynthesis ||
                    !wavBytes.length
                ) {
                    if (speechRequestTokenRef.current === requestToken) {
                        setSpeechBusy(false);
                    }
                    return;
                }

                const wavBufferCopy = new Uint8Array(wavBytes.byteLength);
                wavBufferCopy.set(wavBytes);
                const wavBlob = new Blob([wavBufferCopy.buffer], {
                    type: "audio/wav",
                });
                const objectUrl = URL.createObjectURL(wavBlob);
                const audio = new Audio(objectUrl);

                speechObjectUrlRef.current = objectUrl;
                speechAudioRef.current = audio;

                audio.onended = () => {
                    if (speechAudioRef.current === audio) {
                        clearSpeechPlayback();
                        setSpeechBusy(false);
                    }
                };

                audio.onerror = () => {
                    if (speechAudioRef.current === audio) {
                        clearSpeechPlayback();
                        setSpeechBusy(false);
                    }
                };

                await audio.play();
            } catch {
                if (speechRequestTokenRef.current === requestToken) {
                    clearSpeechPlayback();
                    setSpeechBusy(false);
                }
            }
        },
        [clearSpeechPlayback, setSpeechBusy, useSpeechSynthesis],
    );

    useEffect(() => {
        return () => {
            resetVoiceTranscriptPreview();
            stopSpeechPlayback(true);
        };
    }, [resetVoiceTranscriptPreview, stopSpeechPlayback]);

    useEffect(() => {
        if (!useSpeechSynthesis) {
            stopSpeechPlayback(true);
        }
    }, [stopSpeechPlayback, useSpeechSynthesis]);

    useEffect(() => {
        lastSpokenAssistantMessageIdRef.current = null;
    }, [activeDialogId]);

    useEffect(() => {
        const wasStreaming = previousIsStreamingRef.current;
        previousIsStreamingRef.current = isStreaming;

        if (!wasStreaming && isStreaming) {
            stopSpeechPlayback(true);
            return;
        }

        if (
            !wasStreaming ||
            isStreaming ||
            !isVoiceChatModeRef.current ||
            !useSpeechSynthesis
        ) {
            return;
        }

        const activeDialogMessages = chatsStore.activeDialog?.messages ?? [];
        let lastAssistantMessage:
            | (typeof activeDialogMessages)[number]
            | undefined;

        for (
            let index = activeDialogMessages.length - 1;
            index >= 0;
            index -= 1
        ) {
            const currentMessage = activeDialogMessages[index];

            if (
                currentMessage.author === "assistant" &&
                !currentMessage.hidden &&
                !currentMessage.toolTrace &&
                currentMessage.content.trim().length > 0
            ) {
                lastAssistantMessage = currentMessage;
                break;
            }
        }

        if (!lastAssistantMessage) {
            return;
        }

        if (
            lastSpokenAssistantMessageIdRef.current === lastAssistantMessage.id
        ) {
            return;
        }

        lastSpokenAssistantMessageIdRef.current = lastAssistantMessage.id;
        void synthesizeAndPlaySpeech(lastAssistantMessage.content);
    }, [
        activeDialogId,
        dialogMessagesCount,
        isStreaming,
        stopSpeechPlayback,
        synthesizeAndPlaySpeech,
        useSpeechSynthesis,
    ]);

    const formatFileSize = (bytes: number) => {
        if (bytes < 1024) {
            return `${bytes} B`;
        }

        const kb = bytes / 1024;

        if (kb < 1024) {
            return `${kb.toFixed(1)} KB`;
        }

        return `${(kb / 1024).toFixed(1)} MB`;
    };

    const formatScenarioSavedAt = (savedAt: string) => {
        if (!savedAt) {
            return "Дата неизвестна";
        }

        const parsedDate = new Date(savedAt);

        if (Number.isNaN(parsedDate.getTime())) {
            return "Дата неизвестна";
        }

        return parsedDate.toLocaleString("ru-RU", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    const attachImages = useCallback(async () => {
        const selectedFiles = await pickFiles({
            accept: ["image/*"],
            multiple: true,
        });

        if (!selectedFiles.length) {
            return;
        }

        const onlyImages = selectedFiles.filter((file) =>
            file.mimeType.startsWith("image/"),
        );

        setAttachedImages((prev) => [...prev, ...onlyImages]);
    }, [pickFiles]);

    const removeAttachedImage = (index: number) => {
        setAttachedImages((prev) =>
            prev.filter((_, current) => current !== index),
        );
    };

    const attachOptions = useMemo(
        () => [
            {
                value: "attach-image",
                label: "Прикрепить изображение",
                icon: <Icon icon="mdi:image-outline" width="16" height="16" />,
                onClick: () => {
                    void attachImages();
                },
            },
        ],
        [attachImages],
    );

    const handleSend = () => {
        const payload = msgContent.trim();

        if (!payload || isStreaming) {
            return;
        }

        stopSpeechPlayback(true);
        onMessageSend(payload);
        setMsgContent("");
        setAttachedImages([]);
        requestAnimationFrame(() => {
            areaRef.current?.focus();
        });
    };

    const stopVoiceListening = useCallback(async () => {
        isVoiceListeningRef.current = false;
        setIsVoiceListening(false);
        resetVoiceTranscriptPreview();
        setVoiceEqualizerBars(
            new Array<number>(VOICE_EQUALIZER_BARS_COUNT).fill(6),
        );

        resolveVoiceDoneRef.current?.();

        const stopCapture = stopVoiceCaptureRef.current;
        const stopEqualizerAnimation = stopEqualizerAnimationRef.current;
        const sessionId = voiceSessionIdRef.current;
        const unsubscribe = unsubscribeVoiceEventsRef.current;
        const silenceTimer = silenceTimerRef.current;

        stopVoiceCaptureRef.current = null;
        stopEqualizerAnimationRef.current = null;
        voiceSessionIdRef.current = null;
        unsubscribeVoiceEventsRef.current = null;
        resolveVoiceDoneRef.current = null;
        rejectVoiceDoneRef.current = null;
        silenceTimerRef.current = null;

        unsubscribe?.();
        stopEqualizerAnimation?.();

        if (silenceTimer) {
            clearTimeout(silenceTimer);
        }

        if (!stopCapture) {
            return;
        }

        try {
            await stopCapture();
        } catch {
            // noop
        }

        if (sessionId && window.appApi?.voice?.stopRealtimeTranscription) {
            try {
                await window.appApi.voice.stopRealtimeTranscription(sessionId);
            } catch {
                // noop
            }
        }
    }, [resetVoiceTranscriptPreview]);

    useEffect(() => {
        return () => {
            void stopVoiceListening();
        };
    }, [stopVoiceListening]);

    const startVoiceListening =
        useCallback(async (): Promise<VoiceListeningResult> => {
            if (isStreaming) {
                toasts.warning({
                    title: "Дождитесь завершения ответа",
                    description: "Во время генерации ответа запись недоступна.",
                });
                return "error";
            }

            if (voiceRecognitionDriver !== "mistral") {
                toasts.warning({
                    title: "Голосовой провайдер не выбран",
                    description:
                        "Включите «Использовать для распознавания голоса» для Mistral в настройках чата.",
                });
                return "error";
            }

            const token = mistralToken.trim();
            const voiceModel = mistralVoiceRecModel.trim();

            if (!token) {
                toasts.warning({
                    title: "Mistral token не задан",
                    description:
                        "Укажите Mistral API key в настройках чата, чтобы использовать голосовой ввод.",
                });
                return "error";
            }

            if (!voiceModel) {
                toasts.warning({
                    title: "Модель распознавания не задана",
                    description:
                        "Укажите mistralVoiceRecModel в настройках чата, чтобы использовать голосовой ввод.",
                });
                return "error";
            }

            const voiceApi = window.appApi?.voice;

            if (!voiceApi) {
                toasts.danger({
                    title: "Voice API недоступен",
                    description:
                        "Не удалось подключиться к Electron API для распознавания речи.",
                });
                return "error";
            }

            resetVoiceTranscriptPreview();
            setIsVoiceListening(true);

            let transcriptText = "";
            let hasVoiceError = false;
            let hasInterruptedSpeechOnPhraseStart = false;
            let capture: PcmRealtimeCapture | null = null;
            let pushAudioPromise: Promise<void> | null = null;
            let stopEqualizerAnimation: (() => void) | null = null;

            try {
                capture = await createPcmRealtimeCapture();
                const activeCapture = capture;
                stopVoiceCaptureRef.current = capture.stop;

                let rafId: number | null = null;
                const runEqualizerFrame = () => {
                    setVoiceEqualizerBars(activeCapture.readEqualizerBars());
                    rafId = window.requestAnimationFrame(runEqualizerFrame);
                };
                runEqualizerFrame();

                stopEqualizerAnimation = () => {
                    if (rafId !== null) {
                        window.cancelAnimationFrame(rafId);
                    }
                };
                stopEqualizerAnimationRef.current = stopEqualizerAnimation;

                const { sessionId } =
                    await voiceApi.startMistralRealtimeTranscription({
                        apiKey: token,
                        model: voiceModel,
                        sampleRate: MISTRAL_SAMPLE_RATE,
                    });

                voiceSessionIdRef.current = sessionId;

                const waitForCompletion = new Promise<void>(
                    (resolve, reject) => {
                        resolveVoiceDoneRef.current = resolve;
                        rejectVoiceDoneRef.current = reject;
                    },
                );

                unsubscribeVoiceEventsRef.current =
                    voiceApi.onRealtimeTranscriptionEvent(
                        (event: VoiceTranscriptionEvent) => {
                            if (event.sessionId !== sessionId) {
                                return;
                            }

                            if (event.type === "transcription.text.delta") {
                                transcriptText += event.text;

                                if (
                                    !hasInterruptedSpeechOnPhraseStart &&
                                    transcriptText.trim().length > 0
                                ) {
                                    hasInterruptedSpeechOnPhraseStart = true;
                                    stopSpeechPlayback(true);
                                }

                                scheduleVoiceTranscriptPreview(transcriptText);

                                if (silenceTimerRef.current) {
                                    clearTimeout(silenceTimerRef.current);
                                }

                                silenceTimerRef.current = setTimeout(() => {
                                    resolveVoiceDoneRef.current?.();
                                }, VOICE_SILENCE_TIMEOUT_MS);
                                return;
                            }

                            if (event.type === "transcription.done") {
                                if (silenceTimerRef.current) {
                                    clearTimeout(silenceTimerRef.current);
                                    silenceTimerRef.current = null;
                                }
                                resolveVoiceDoneRef.current?.();
                                return;
                            }

                            if (event.type === "error") {
                                if (silenceTimerRef.current) {
                                    clearTimeout(silenceTimerRef.current);
                                    silenceTimerRef.current = null;
                                }
                                rejectVoiceDoneRef.current?.(
                                    new Error(event.message),
                                );
                            }
                        },
                    );

                pushAudioPromise = (async () => {
                    for await (const chunk of capture.audioStream) {
                        await voiceApi.pushRealtimeTranscriptionChunk(
                            sessionId,
                            chunk,
                        );
                    }
                })();

                await waitForCompletion;
                await Promise.all([
                    capture.stop(),
                    pushAudioPromise,
                    voiceApi.stopRealtimeTranscription(sessionId),
                ]);
            } catch (error) {
                hasVoiceError = true;
                toasts.danger({
                    title: "Ошибка голосового ввода",
                    description:
                        error instanceof Error
                            ? error.message
                            : "Не удалось распознать речь",
                });
            } finally {
                if (silenceTimerRef.current) {
                    clearTimeout(silenceTimerRef.current);
                    silenceTimerRef.current = null;
                }

                resolveVoiceDoneRef.current = null;
                rejectVoiceDoneRef.current = null;

                const unsubscribe = unsubscribeVoiceEventsRef.current;
                unsubscribeVoiceEventsRef.current = null;
                unsubscribe?.();

                stopEqualizerAnimationRef.current = null;
                stopEqualizerAnimation?.();

                if (capture) {
                    await capture.audioStream.return?.();
                }

                if (pushAudioPromise) {
                    try {
                        await pushAudioPromise;
                    } catch {
                        // noop
                    }
                }

                voiceSessionIdRef.current = null;
                stopVoiceCaptureRef.current = null;
                setVoiceEqualizerBars(
                    new Array<number>(VOICE_EQUALIZER_BARS_COUNT).fill(6),
                );
                setIsVoiceListening(false);
            }

            const trimmedTranscript = transcriptText.trim();

            if (hasVoiceError) {
                resetVoiceTranscriptPreview();
                return "error";
            }

            if (!trimmedTranscript) {
                resetVoiceTranscriptPreview();
                return "empty";
            }

            onMessageSend(trimmedTranscript);
            resetVoiceTranscriptPreview();
            setMsgContent("");
            setAttachedImages([]);
            requestAnimationFrame(() => {
                areaRef.current?.focus();
            });
            return "sent";
        }, [
            isStreaming,
            mistralVoiceRecModel,
            mistralToken,
            onMessageSend,
            resetVoiceTranscriptPreview,
            scheduleVoiceTranscriptPreview,
            stopSpeechPlayback,
            toasts,
            voiceRecognitionDriver,
        ]);

    const waitForVoiceChatContinue = useCallback(async () => {
        if (!isStreamingRef.current || !isVoiceChatModeRef.current) {
            return;
        }

        await new Promise<void>((resolve) => {
            const done = () => resolve();
            streamingWaitersRef.current.push(done);
            voiceChatStopWaitersRef.current.push(done);
        });
    }, []);

    const stopVoiceChatMode = useCallback(() => {
        isVoiceChatModeRef.current = false;
        isVoiceChatLoopRunningRef.current = false;
        setIsVoiceChatMode(false);
        stopSpeechPlayback(true);

        const stopWaiters = [
            ...voiceChatStopWaitersRef.current,
            ...streamingWaitersRef.current,
        ];
        voiceChatStopWaitersRef.current = [];
        streamingWaitersRef.current = [];
        stopWaiters.forEach((resolve) => resolve());
    }, [stopSpeechPlayback]);

    const toggleVoiceChatMode = useCallback(() => {
        if (isVoiceChatModeRef.current) {
            stopVoiceChatMode();

            if (isVoiceListeningRef.current) {
                void stopVoiceListening();
            }

            return;
        }

        if (isVoiceChatLoopRunningRef.current) {
            return;
        }

        const nextToken = voiceChatLoopTokenRef.current + 1;
        voiceChatLoopTokenRef.current = nextToken;
        isVoiceChatLoopRunningRef.current = true;
        isVoiceChatModeRef.current = true;
        setIsVoiceChatMode(true);

        void (async () => {
            try {
                while (isVoiceChatModeRef.current) {
                    await waitForVoiceChatContinue();

                    if (!isVoiceChatModeRef.current) {
                        break;
                    }

                    await waitForSpeechIdle();

                    if (!isVoiceChatModeRef.current) {
                        break;
                    }

                    const listeningResult = await startVoiceListening();

                    if (listeningResult === "error") {
                        stopVoiceChatMode();
                        break;
                    }

                    if (listeningResult === "empty") {
                        continue;
                    }
                }
            } finally {
                const activeToken = voiceChatLoopTokenRef.current;

                if (activeToken === nextToken) {
                    isVoiceChatLoopRunningRef.current = false;
                    stopVoiceChatMode();
                }
            }
        })();
    }, [
        startVoiceListening,
        stopVoiceChatMode,
        stopVoiceListening,
        waitForSpeechIdle,
        waitForVoiceChatContinue,
    ]);

    const toggleVoiceListening = useCallback(() => {
        if (isVoiceListeningRef.current) {
            stopVoiceChatMode();
            void stopVoiceListening();
            return;
        }

        stopVoiceChatMode();
        void startVoiceListening();
    }, [startVoiceListening, stopVoiceChatMode, stopVoiceListening]);

    const startScenario = useCallback(
        async (scenarioId: string) => {
            if (isStreaming) {
                toasts.warning({
                    title: "Дождитесь завершения ответа",
                    description:
                        "Нельзя запустить сценарий, пока модель формирует ответ.",
                });
                return;
            }

            setStartingScenarioId(scenarioId);

            try {
                const scenario = await switchScenario(scenarioId);

                if (!scenario) {
                    toasts.warning({
                        title: "Сценарий не найден",
                        description: "Не удалось загрузить выбранный сценарий.",
                    });
                    return;
                }

                const scenarioFlow = await scenarioToFlow(scenario);
                const displayMessage = [
                    "Сценарий запущен",
                    `Название: ${scenario.name}`,
                    `Описание: ${scenario.description.trim() || "Без описания"}`,
                    "Статус: ассистент выполняет шаги сценария",
                ].join("\n");

                const launchPayload = encodeScenarioLaunchPayload({
                    scenarioName: scenario.name,
                    displayMessage,
                    scenarioFlow,
                });

                onMessageSend(launchPayload);

                stopSpeechPlayback(true);
                setMsgContent("");
                setAttachedImages([]);
                setIsScenarioModalOpen(false);
                requestAnimationFrame(() => {
                    areaRef.current?.focus();
                });
            } finally {
                setStartingScenarioId(null);
            }
        },
        [
            isStreaming,
            onMessageSend,
            scenarioToFlow,
            stopSpeechPlayback,
            switchScenario,
            toasts,
        ],
    );

    const handleCancelStreaming = useCallback(() => {
        stopSpeechPlayback(true);
        onCancelGeneration();
    }, [onCancelGeneration, stopSpeechPlayback]);

    return (
        <>
            <footer className="rounded-2xl bg-main-900/90 ring-main-300/20">
                <div className="mx-auto w-full max-w-5xl rounded-[1.75rem] border border-main-700/70 bg-main-800/65 p-3">
                    {attachedImages.length > 0 ? (
                        <div className="mb-3 flex max-w-full items-center gap-2 overflow-x-auto pb-1">
                            {attachedImages.map((file, index) => (
                                <div
                                    key={`${file.name}-${file.size}-${file.dataUrl}`}
                                    className="flex min-w-56 items-center gap-2 rounded-2xl border border-main-700/70 bg-main-900/70 p-2"
                                >
                                    <div className="h-10 w-10 overflow-hidden rounded-md bg-main-700/70">
                                        <img
                                            src={file.dataUrl}
                                            alt={file.name}
                                            className="h-full w-full object-cover"
                                        />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm text-main-100">
                                            {file.name}
                                        </p>
                                        <p className="text-xs text-main-400">
                                            {formatFileSize(file.size)}
                                        </p>
                                    </div>
                                    <Button
                                        variant="secondary"
                                        className="h-7 w-7 p-0"
                                        shape="rounded-full"
                                        onClick={() =>
                                            removeAttachedImage(index)
                                        }
                                        label={`Удалить ${file.name}`}
                                    >
                                        <Icon
                                            icon="mdi:close"
                                            width="14"
                                            height="14"
                                        />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    ) : null}

                    <div className="relative rounded-2xl bg-main-900/55 px-3 py-2">
                        <InputBig
                            ref={areaRef}
                            value={msgContent}
                            onChange={(value) =>
                                setMsgContent(value.target.value)
                            }
                            placeholder="Напишите сообщение модели..."
                            className="h-auto! min-h-9 w-full rounded-lg border-0 bg-transparent p-2 text-main-100 placeholder:text-main-400"
                            onKeyDown={(event) => {
                                if (
                                    event.key === "Enter" &&
                                    !event.shiftKey &&
                                    !isStreaming
                                ) {
                                    event.preventDefault();
                                    handleSend();
                                }
                            }}
                        />

                        {isVoiceListening && voiceTranscriptPreview ? (
                            <p className="mt-1 truncate text-xs text-main-400">
                                {voiceTranscriptPreview}
                            </p>
                        ) : null}

                        {!isVoiceListening && isAssistantSpeaking ? (
                            <p className="mt-1 truncate text-xs text-main-400">
                                Ассистент озвучивает ответ...
                            </p>
                        ) : null}

                        <div className="mt-2 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                                <Button
                                    label="Tools"
                                    className="h-9 w-9 p-0"
                                    shape="rounded-l-full"
                                    variant="primary"
                                    onClick={() => setIsToolsModalOpen(true)}
                                >
                                    <Icon icon="mdi:tools" />
                                </Button>

                                <Button
                                    label="Tools"
                                    className="h-9 w-9 p-0"
                                    shape="rounded-sm"
                                    variant="secondary"
                                    onClick={() => setIsScenarioModalOpen(true)}
                                >
                                    <Icon icon="mdi:script" />
                                </Button>

                                <div className="z-20">
                                    <Dropdown
                                        options={attachOptions}
                                        menuPlacement="top"
                                        menuClassName="w-66"
                                        matchTriggerWidth={false}
                                        renderTrigger={({
                                            toggleOpen,
                                            triggerRef,
                                            disabled,
                                            ariaProps,
                                        }) => (
                                            <Button
                                                label="Attach"
                                                variant="primary"
                                                className="h-9 w-9 p-0"
                                                shape="rounded-r-full"
                                                ref={triggerRef}
                                                disabled={
                                                    disabled || isUploading
                                                }
                                                onClick={toggleOpen}
                                                {...ariaProps}
                                            >
                                                <Icon
                                                    icon={
                                                        isUploading
                                                            ? "mdi:loading"
                                                            : "mdi:paperclip"
                                                    }
                                                    className={
                                                        isUploading
                                                            ? "animate-spin"
                                                            : ""
                                                    }
                                                />
                                            </Button>
                                        )}
                                    />
                                </div>

                                <Floating
                                    anchor="top-left"
                                    className="z-20"
                                    panelClassName="w-72 shadow-lg"
                                    content={
                                        <>
                                            <p className="text-xs font-semibold text-main-200">
                                                Информация о чате
                                            </p>

                                            <div className="mt-2 space-y-2 text-xs text-main-400">
                                                <div className="rounded-lg border border-main-700/70 bg-main-900/60 p-2">
                                                    <div className="mb-1 flex items-center justify-between gap-2">
                                                        <span className="text-main-300">
                                                            Контекст диалога
                                                        </span>
                                                        <span className="text-main-200">
                                                            {contextWindowTotal.toLocaleString(
                                                                "ru-RU",
                                                            )}
                                                        </span>
                                                    </div>
                                                    <div className="space-y-1">
                                                        {accountedContextRows.length >
                                                        0 ? (
                                                            accountedContextRows.map(
                                                                (row) => (
                                                                    <div
                                                                        key={
                                                                            row.key
                                                                        }
                                                                        className="flex items-center justify-between gap-2"
                                                                    >
                                                                        <span>
                                                                            {
                                                                                row.label
                                                                            }
                                                                        </span>
                                                                        <span className="text-main-300">
                                                                            {contextWindowPercent(
                                                                                row.value,
                                                                            ).toFixed(
                                                                                1,
                                                                            )}
                                                                            %
                                                                        </span>
                                                                    </div>
                                                                ),
                                                            )
                                                        ) : (
                                                            <div className="flex items-center justify-between gap-2">
                                                                <span>
                                                                    Нет
                                                                    учитываемых
                                                                    данных
                                                                </span>
                                                                <span className="text-main-300">
                                                                    0.0%
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="flex items-center justify-between gap-2">
                                                    <span>
                                                        Сообщений в диалоге
                                                    </span>
                                                    <span className="text-main-300">
                                                        {dialogMessagesCount}
                                                    </span>
                                                </div>
                                                <div className="flex items-center justify-between gap-2">
                                                    <span>Модель</span>
                                                    <span className="truncate text-main-300">
                                                        {chatDriver === "ollama"
                                                            ? ollamaModel ||
                                                              "ollama"
                                                            : "не выбрана"}
                                                    </span>
                                                </div>
                                                <div className="flex items-center justify-between gap-2">
                                                    <span>Поток</span>
                                                    <span
                                                        className={
                                                            isStreaming
                                                                ? "text-amber-300"
                                                                : "text-lime-300"
                                                        }
                                                    >
                                                        {isStreaming
                                                            ? "генерация"
                                                            : "ожидание"}
                                                    </span>
                                                </div>
                                            </div>
                                        </>
                                    }
                                >
                                    <button
                                        type="button"
                                        className="flex h-9 w-9 items-center justify-center rounded-full border border-main-600/70 bg-main-900/90 text-main-400 transition-colors hover:text-main-200"
                                        aria-label="Показать информацию о диалоге"
                                    >
                                        <Icon
                                            icon="mdi:information-outline"
                                            width={14}
                                        />
                                    </button>
                                </Floating>
                            </div>

                            <div className="flex items-center gap-2">
                                <Button
                                    onClick={toggleVoiceChatMode}
                                    label={
                                        isVoiceListening && isVoiceChatMode
                                            ? "Stop voice chat mode"
                                            : "Start voice chat mode"
                                    }
                                    className="h-9 w-9 p-0"
                                    variant={
                                        isVoiceListening && isVoiceChatMode
                                            ? "secondary"
                                            : "primary"
                                    }
                                    disabled={
                                        isStreaming ||
                                        !mistralVoiceRecModel.trim()
                                    }
                                >
                                    <Icon
                                        icon={
                                            isVoiceListening && isVoiceChatMode
                                                ? "mdi:headset"
                                                : "mdi:headset-off"
                                        }
                                    />
                                </Button>

                                <Button
                                    onClick={toggleVoiceListening}
                                    label={
                                        isVoiceListening
                                            ? "Stop voice input"
                                            : "Start voice input"
                                    }
                                    className="h-9 w-9 p-0"
                                    variant={
                                        isVoiceListening
                                            ? "secondary"
                                            : "primary"
                                    }
                                    disabled={
                                        isStreaming ||
                                        !mistralVoiceRecModel.trim()
                                    }
                                >
                                    <Icon
                                        icon={
                                            isVoiceListening
                                                ? "mdi:microphone"
                                                : "mdi:microphone-outline"
                                        }
                                    />
                                </Button>

                                <Button
                                    onClick={
                                        isStreaming
                                            ? handleCancelStreaming
                                            : handleSend
                                    }
                                    label={isStreaming ? "Cancel" : "Send"}
                                    className="h-9 w-9 p-0"
                                    variant="primary"
                                    disabled={
                                        !isStreaming && !msgContent.trim()
                                    }
                                >
                                    <Icon
                                        icon={
                                            isStreaming
                                                ? "mdi:stop"
                                                : "mdi:send"
                                        }
                                    />
                                </Button>
                            </div>
                        </div>

                        {isVoiceListening ? (
                            <div className="mt-2 flex h-12 w-full items-end gap-1 rounded-xl border border-main-700/70 bg-main-900/70 px-2 py-1">
                                {VOICE_EQUALIZER_BAR_IDS.map((barId, index) => (
                                    <span
                                        key={barId}
                                        className="w-full rounded-sm bg-main-300 transition-all duration-75"
                                        style={{
                                            height: `${Math.max(8, Math.round(voiceEqualizerBars[index] ?? 0))}%`,
                                            opacity: Math.max(
                                                0.35,
                                                Math.min(
                                                    1,
                                                    (voiceEqualizerBars[
                                                        index
                                                    ] ?? 0) / 100,
                                                ),
                                            ),
                                        }}
                                    />
                                ))}
                            </div>
                        ) : null}
                    </div>
                </div>
            </footer>

            <Modal
                open={isToolsModalOpen}
                onClose={() => setIsToolsModalOpen(false)}
                title="Настройка инструментов"
                className="max-w-6xl min-h-144"
            >
                <RequiredToolsPickForm
                    toolsQuery={toolsQuery}
                    onToolsQueryChange={setToolsQuery}
                />
            </Modal>

            <Modal
                open={isScenarioModalOpen}
                onClose={() => setIsScenarioModalOpen(false)}
                title="Запуск сценария"
                className="max-w-2xl"
            >
                {scenarios.length > 0 ? (
                    <div className="space-y-2">
                        {scenarios.map((scenario) => {
                            const isStarting =
                                startingScenarioId === scenario.id;

                            return (
                                <button
                                    key={scenario.id}
                                    type="button"
                                    className="group flex w-full items-center justify-between gap-3 rounded-xl border border-main-700/70 bg-main-900/55 px-3 py-2.5 text-left transition-colors hover:bg-main-800/70 disabled:opacity-60"
                                    onClick={() => {
                                        void startScenario(scenario.id);
                                    }}
                                    disabled={Boolean(startingScenarioId)}
                                >
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                            <Icon
                                                icon="mdi:script-text-outline"
                                                className="text-main-300"
                                                width={18}
                                                height={18}
                                            />
                                            <p className="truncate text-sm font-medium text-main-100">
                                                {scenario.title}
                                            </p>
                                        </div>
                                        <p className="mt-1 truncate text-xs text-main-400">
                                            {scenario.preview}
                                        </p>
                                        <p className="mt-1 truncate text-xs text-main-500">
                                            Обновлён:{" "}
                                            {formatScenarioSavedAt(
                                                scenario.updatedAt,
                                            )}
                                        </p>
                                    </div>
                                    <div className="flex shrink-0 items-center gap-2 text-xs text-main-400">
                                        {isStarting ? (
                                            <Icon
                                                icon="mdi:loading"
                                                className="animate-spin text-main-300"
                                                width={16}
                                                height={16}
                                            />
                                        ) : (
                                            <Icon
                                                icon="mdi:play-circle-outline"
                                                className="text-main-500 transition-colors group-hover:text-main-300"
                                                width={18}
                                                height={18}
                                            />
                                        )}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                ) : (
                    <p className="rounded-xl border border-dashed border-main-700/70 bg-main-900/40 px-3 py-4 text-center text-sm text-main-400">
                        Сценарии отсутствуют.
                    </p>
                )}
            </Modal>
        </>
    );
});
