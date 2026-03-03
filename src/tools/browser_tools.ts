import { ToolsBuilder } from "../utils/ToolsBuilder";

export const browserToolsPackage = () => {
    const builder = new ToolsBuilder();
    builder
        .addPackage({
            id: "browser-tools",
            title: "Браузерные инструменты",
            description: "Инструменты для взаимодействия модели с браузером",
        })
        .addTool({
            name: "open_url",
            description:
                "Открывает URL во встроенном браузерном контуре и возвращает итог навигации: финальный URL, редиректы, статус и возможные ошибки.",
            parameters: ToolsBuilder.objectSchema({
                properties: {
                    url: ToolsBuilder.stringParam("URL для открытия"),
                    timeoutMs: ToolsBuilder.numberParam(
                        "Таймаут загрузки страницы в миллисекундах (опционально, по умолчанию 30000)",
                    ),
                },
                required: ["url"],
            }),
            outputScheme: {
                type: "object",
                properties: {
                    success: { type: "boolean" },
                    requestedUrl: { type: "string" },
                    finalUrl: { type: "string" },
                    title: { type: "string" },
                    redirected: { type: "boolean" },
                    redirects: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                from: { type: "string" },
                                to: { type: "string" },
                            },
                        },
                    },
                    statusCode: { type: "number" },
                    loadTimeMs: { type: "number" },
                    error: { type: "string" },
                },
                required: ["success", "requestedUrl", "finalUrl"],
            },
            execute: async (args) => {
                const url = typeof args.url === "string" ? args.url : "";
                const timeoutMs =
                    typeof args.timeoutMs === "number" &&
                    Number.isFinite(args.timeoutMs)
                        ? args.timeoutMs
                        : undefined;

                if (!url) {
                    throw new Error("URL не указан");
                }

                const api = window.appApi;
                if (!api?.browser?.openUrl) {
                    throw new Error("Browser API недоступен");
                }

                return await api.browser.openUrl(url, timeoutMs);
            },
        })
        .addTool({
            name: "get_page_snapshot",
            description:
                "Возвращает структурированный снимок текущей страницы для ориентации ИИ: URL, заголовок, headings, список интерактивных элементов и текстовый preview.",
            parameters: ToolsBuilder.objectSchema({
                properties: {
                    maxElements: ToolsBuilder.numberParam(
                        "Максимум интерактивных элементов в ответе (10..200, по умолчанию 60)",
                    ),
                },
            }),
            outputScheme: {
                type: "object",
                properties: {
                    url: { type: "string" },
                    title: { type: "string" },
                    headings: {
                        type: "array",
                        items: { type: "string" },
                    },
                    elements: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                id: { type: "string" },
                                tag: { type: "string" },
                                role: { type: "string" },
                                text: { type: "string" },
                                href: { type: "string" },
                                type: { type: "string" },
                                placeholder: { type: "string" },
                                selector: { type: "string" },
                            },
                            required: ["id", "tag", "selector"],
                        },
                    },
                    textPreview: { type: "string" },
                    capturedAt: { type: "string" },
                },
                required: ["url", "title", "elements", "capturedAt"],
            },
            execute: async (args) => {
                const maxElements =
                    typeof args.maxElements === "number" &&
                    Number.isFinite(args.maxElements)
                        ? args.maxElements
                        : undefined;

                const api = window.appApi;
                if (!api?.browser?.getPageSnapshot) {
                    throw new Error("Browser API недоступен");
                }

                return await api.browser.getPageSnapshot(maxElements);
            },
        })
        .addTool({
            name: "interract_with",
            description:
                "Выполняет действие на странице: click (нажать) или type (ввести текст) по CSS selector.",
            parameters: ToolsBuilder.objectSchema({
                properties: {
                    action: ToolsBuilder.stringParam(
                        "Действие: click или type",
                        ["click", "type"],
                    ),
                    selector: ToolsBuilder.stringParam(
                        "CSS selector целевого элемента",
                    ),
                    text: ToolsBuilder.stringParam(
                        "Текст для ввода (обязательно для action=type)",
                    ),
                    submit: {
                        type: "boolean",
                        description:
                            "После ввода отправить Enter/requestSubmit (актуально для action=type)",
                    },
                    waitForNavigationMs: ToolsBuilder.numberParam(
                        "Сколько ждать после действия для возможной навигации (0..10000, по умолчанию 400)",
                    ),
                },
                required: ["action", "selector"],
            }),
            outputScheme: {
                type: "object",
                properties: {
                    success: { type: "boolean" },
                    action: { type: "string" },
                    selector: { type: "string" },
                    elementTag: { type: "string" },
                    url: { type: "string" },
                    title: { type: "string" },
                    waitedMs: { type: "number" },
                    error: { type: "string" },
                },
                required: ["success", "action", "selector", "url"],
            },
            execute: async (args) => {
                const action =
                    typeof args.action === "string" ? args.action : "";
                const selector =
                    typeof args.selector === "string" ? args.selector : "";
                const text =
                    typeof args.text === "string" ? args.text : undefined;
                const submit =
                    typeof args.submit === "boolean" ? args.submit : undefined;
                const waitForNavigationMs =
                    typeof args.waitForNavigationMs === "number" &&
                    Number.isFinite(args.waitForNavigationMs)
                        ? args.waitForNavigationMs
                        : undefined;

                if (action !== "click" && action !== "type") {
                    throw new Error(
                        "Необходимо указать action: click или type",
                    );
                }

                if (!selector) {
                    throw new Error("Необходимо указать selector");
                }

                if (action === "type" && !text) {
                    throw new Error("Для action=type необходимо указать text");
                }

                const api = window.appApi;
                if (!api?.browser?.interactWith) {
                    throw new Error("Browser API недоступен");
                }

                return await api.browser.interactWith({
                    action,
                    selector,
                    text,
                    submit,
                    waitForNavigationMs,
                });
            },
        })
        .addTool({
            name: "close_browser",
            description:
                "Закрывает текущую браузерную сессию и очищает состояние встроенного браузера.",
            parameters: ToolsBuilder.objectSchema({
                properties: {},
            }),
            outputScheme: {
                type: "object",
                properties: {
                    success: { type: "boolean" },
                    hadSession: { type: "boolean" },
                },
                required: ["success", "hadSession"],
            },
            execute: async () => {
                const api = window.appApi;
                if (!api?.browser?.closeSession) {
                    throw new Error("Browser API недоступен");
                }

                return await api.browser.closeSession();
            },
        });
    return builder.build();
};
