import { BrowserWindow } from "electron";
import type {
    BrowserCloseResult,
    BrowserInteractAction,
    BrowserInteractParams,
    BrowserInteractResult,
    BrowserNavigateResult,
    BrowserPageSnapshot,
    BrowserRedirect,
} from "../../src/types/ElectronApi";

const SUPPORTED_PROTOCOLS = new Set(["http:", "https:"]);
const BROWSER_ACTIONS = new Set<BrowserInteractAction>(["click", "type"]);

export class BrowserService {
    private browserWindow: BrowserWindow | null = null;

    closeSession(): BrowserCloseResult {
        const hadSession =
            this.browserWindow !== null && !this.browserWindow.isDestroyed();

        if (hadSession && this.browserWindow) {
            this.browserWindow.destroy();
        }

        this.browserWindow = null;

        return {
            success: true,
            hadSession,
        };
    }

    private ensureWindow(): BrowserWindow {
        if (this.browserWindow && !this.browserWindow.isDestroyed()) {
            return this.browserWindow;
        }

        this.browserWindow = new BrowserWindow({
            show: false,
            webPreferences: {
                sandbox: true,
                contextIsolation: true,
                nodeIntegration: false,
            },
        });

        this.browserWindow.webContents.setWindowOpenHandler(() => ({
            action: "deny",
        }));

        return this.browserWindow;
    }

    private normalizeHttpUrl(rawUrl: string): string {
        const url = typeof rawUrl === "string" ? rawUrl.trim() : "";

        if (!url) {
            throw new Error("URL не указан");
        }

        if (!URL.canParse(url)) {
            throw new Error("Некорректный URL");
        }

        const parsed = new URL(url);

        const protocol = parsed.protocol.toLowerCase();
        if (!SUPPORTED_PROTOCOLS.has(protocol)) {
            throw new Error("Поддерживаются только http и https URL");
        }

        return parsed.toString();
    }

    async openUrl(
        rawUrl: string,
        timeoutMs = 30000,
    ): Promise<BrowserNavigateResult> {
        const requestedUrl = this.normalizeHttpUrl(rawUrl);
        const browserWindow = this.ensureWindow();
        const webContents = browserWindow.webContents;
        const webContentsAny = webContents as {
            on: (event: string, listener: (...args: unknown[]) => void) => void;
            removeListener: (
                event: string,
                listener: (...args: unknown[]) => void,
            ) => void;
        };

        const startedAt = Date.now();
        const redirects: BrowserRedirect[] = [];
        let statusCode: number | null = null;
        let currentUrl = requestedUrl;
        let navigationError = "";
        let didFinishLoad = false;

        const onRedirect = (...args: unknown[]) => {
            const targetUrl =
                typeof args[1] === "string" ? (args[1] as string) : "";
            const isMainFrame = args[3] === true;

            if (!isMainFrame) {
                return;
            }

            redirects.push({
                from: currentUrl,
                to: targetUrl,
            });
            currentUrl = targetUrl;
        };

        const onFailLoad = (...args: unknown[]) => {
            const errorCode =
                typeof args[1] === "number" ? (args[1] as number) : -1;
            const errorDescription =
                typeof args[2] === "string"
                    ? (args[2] as string)
                    : "Navigation failed";
            const validatedURL =
                typeof args[3] === "string" ? (args[3] as string) : "";
            const isMainFrame = args[4] === true;

            if (!isMainFrame) {
                return;
            }

            currentUrl = validatedURL || currentUrl;

            if (errorCode === -3) {
                return;
            }

            navigationError = `[${errorCode}] ${errorDescription}`;
        };

        const onDidFinishLoad = () => {
            didFinishLoad = true;
        };

        const onCompleted = (details: {
            webContentsId?: number;
            resourceType: string;
            statusCode?: number;
            url: string;
        }) => {
            if (
                details.webContentsId === webContents.id &&
                details.resourceType === "mainFrame"
            ) {
                statusCode =
                    typeof details.statusCode === "number"
                        ? details.statusCode
                        : null;
                currentUrl = details.url || currentUrl;
            }
        };

        webContentsAny.on("did-redirect-navigation", onRedirect);
        webContentsAny.on("did-fail-load", onFailLoad);
        webContentsAny.on("did-finish-load", onDidFinishLoad);
        webContents.session.webRequest.onCompleted(
            { urls: ["*://*/*"] },
            onCompleted,
        );

        const loadResult = await Promise.race([
            webContents
                .loadURL(requestedUrl)
                .then(() => ({ ok: true as const })),
            new Promise<{ ok: false; error: Error }>((resolve) => {
                setTimeout(
                    () =>
                        resolve({
                            ok: false,
                            error: new Error(
                                `Таймаут загрузки страницы (${timeoutMs}ms)`,
                            ),
                        }),
                    timeoutMs,
                );
            }),
        ]).catch((error) => ({
            ok: false as const,
            error: error instanceof Error ? error : new Error(String(error)),
        }));

        const finalUrl = webContents.getURL() || currentUrl || requestedUrl;
        const title = webContents.getTitle();

        webContentsAny.removeListener("did-redirect-navigation", onRedirect);
        webContentsAny.removeListener("did-fail-load", onFailLoad);
        webContentsAny.removeListener("did-finish-load", onDidFinishLoad);
        webContents.session.webRequest.onCompleted(
            { urls: ["*://*/*"] },
            null as unknown as (details: unknown) => void,
        );

        if (loadResult.ok) {
            return {
                success: true,
                requestedUrl,
                finalUrl,
                title,
                redirected:
                    redirects.length > 0 ||
                    finalUrl.replace(/\/$/, "") !==
                        requestedUrl.replace(/\/$/, ""),
                redirects,
                statusCode,
                loadTimeMs: Date.now() - startedAt,
            };
        }

        {
            const finalUrl = webContents.getURL() || currentUrl || requestedUrl;
            const title = webContents.getTitle();
            const errorMessage =
                navigationError ||
                (loadResult.error instanceof Error
                    ? loadResult.error.message
                    : String(loadResult.error));
            const isAbortedError =
                errorMessage.includes("ERR_ABORTED") ||
                errorMessage.includes("[-3]");
            const hasLoadedPage =
                didFinishLoad ||
                Boolean((webContents.getURL() || currentUrl) && title);

            if (isAbortedError && hasLoadedPage) {
                return {
                    success: true,
                    requestedUrl,
                    finalUrl,
                    title,
                    redirected:
                        redirects.length > 0 ||
                        finalUrl.replace(/\/$/, "") !==
                            requestedUrl.replace(/\/$/, ""),
                    redirects,
                    statusCode,
                    loadTimeMs: Date.now() - startedAt,
                };
            }

            return {
                success: false,
                requestedUrl,
                finalUrl,
                title,
                redirected:
                    redirects.length > 0 ||
                    finalUrl.replace(/\/$/, "") !==
                        requestedUrl.replace(/\/$/, ""),
                redirects,
                statusCode,
                loadTimeMs: Date.now() - startedAt,
                error: errorMessage,
            };
        }
    }

    async getPageSnapshot(maxElements = 60): Promise<BrowserPageSnapshot> {
        const browserWindow = this.ensureWindow();
        const webContents = browserWindow.webContents;

        const normalizedMaxElements = Number.isFinite(maxElements)
            ? Math.max(10, Math.min(200, Math.floor(maxElements)))
            : 60;

        const snapshot = await webContents.executeJavaScript(
            `(() => {
                const toText = (value) =>
                    typeof value === "string"
                        ? value.replace(/\\s+/g, " ").trim()
                        : "";

                const buildSelector = (element) => {
                    if (!element || !(element instanceof Element)) {
                        return "";
                    }

                    if (element.id) {
                        return "#" + CSS.escape(element.id);
                    }

                    const parts = [];
                    let cursor = element;

                    while (cursor && cursor.nodeType === Node.ELEMENT_NODE && parts.length < 4) {
                        const tag = cursor.tagName.toLowerCase();
                        const parent = cursor.parentElement;
                        if (!parent) {
                            parts.unshift(tag);
                            break;
                        }

                        const siblings = Array.from(parent.children).filter((child) => child.tagName === cursor.tagName);
                        const index = siblings.indexOf(cursor) + 1;
                        parts.unshift(tag + ":nth-of-type(" + index + ")");
                        cursor = parent;
                    }

                    return parts.join(" > ");
                };

                const headingNodes = Array.from(document.querySelectorAll("h1, h2, h3"));
                const headings = headingNodes
                    .map((node) => toText(node.textContent || ""))
                    .filter(Boolean)
                    .slice(0, 20);

                const candidates = Array.from(
                    document.querySelectorAll(
                        "a, button, input, textarea, select, [role='button'], [role='link'], [tabindex]",
                    ),
                );

                const unique = [];
                const seen = new Set();

                for (const element of candidates) {
                    const selector = buildSelector(element);
                    const key = element.tagName + "::" + selector;

                    if (!selector || seen.has(key)) {
                        continue;
                    }

                    seen.add(key);

                    unique.push({
                        tag: element.tagName.toLowerCase(),
                        role: toText(element.getAttribute("role") || ""),
                        text: toText(
                            element.textContent ||
                                element.getAttribute("aria-label") ||
                                element.getAttribute("title") ||
                                "",
                        ),
                        href: toText(
                            element instanceof HTMLAnchorElement
                                ? element.href
                                : element.getAttribute("href") || "",
                        ),
                        type: toText(
                            "type" in element && typeof element.type === "string"
                                ? element.type
                                : element.getAttribute("type") || "",
                        ),
                        placeholder: toText(element.getAttribute("placeholder") || ""),
                        selector,
                    });

                    if (unique.length >= ${normalizedMaxElements}) {
                        break;
                    }
                }

                const elements = unique.map((item, index) => ({
                    id: "el_" + (index + 1),
                    ...item,
                }));

                return {
                    url: location.href,
                    title: document.title || "",
                    headings,
                    elements,
                    textPreview: toText(document.body?.innerText || "").slice(0, 4000),
                    capturedAt: new Date().toISOString(),
                };
            })();`,
            true,
        );

        return snapshot as BrowserPageSnapshot;
    }

    async interactWith(
        params: BrowserInteractParams,
    ): Promise<BrowserInteractResult> {
        const browserWindow = this.ensureWindow();
        const webContents = browserWindow.webContents;

        const action = params.action;
        const selector =
            typeof params.selector === "string" ? params.selector.trim() : "";
        const text = typeof params.text === "string" ? params.text : "";
        const submit = params.submit === true;
        const waitedMs = Number.isFinite(params.waitForNavigationMs)
            ? Math.max(
                  0,
                  Math.min(10000, Math.floor(params.waitForNavigationMs!)),
              )
            : 400;

        if (!BROWSER_ACTIONS.has(action as BrowserInteractAction)) {
            throw new Error("Поддерживаются только действия click и type");
        }

        if (!selector) {
            throw new Error("Не указан selector");
        }

        if (action === "type" && !text) {
            throw new Error("Для действия type необходимо указать text");
        }

        const scriptPayload = {
            action,
            selector,
            text,
            submit,
        };

        const interaction = await webContents.executeJavaScript(
            `(() => {
                const payload = ${JSON.stringify(scriptPayload)};
                let element;

                try {
                    element = document.querySelector(payload.selector);
                } catch {
                    return {
                        success: false,
                        error: "Некорректный CSS selector",
                    };
                }

                if (!element) {
                    return {
                        success: false,
                        error: "Элемент не найден",
                    };
                }

                if (payload.action === "click") {
                    if (element instanceof HTMLElement) {
                        element.focus();
                        element.click();
                    } else {
                        return {
                            success: false,
                            error: "Элемент не поддерживает click",
                        };
                    }
                }

                if (payload.action === "type") {
                    const value = typeof payload.text === "string" ? payload.text : "";

                    if (
                        element instanceof HTMLInputElement ||
                        element instanceof HTMLTextAreaElement
                    ) {
                        element.focus();
                        element.value = value;
                        element.dispatchEvent(new Event("input", { bubbles: true }));
                        element.dispatchEvent(new Event("change", { bubbles: true }));

                        if (payload.submit) {
                            element.dispatchEvent(
                                new KeyboardEvent("keydown", {
                                    key: "Enter",
                                    code: "Enter",
                                    bubbles: true,
                                }),
                            );
                            element.dispatchEvent(
                                new KeyboardEvent("keyup", {
                                    key: "Enter",
                                    code: "Enter",
                                    bubbles: true,
                                }),
                            );
                            if (element.form && typeof element.form.requestSubmit === "function") {
                                element.form.requestSubmit();
                            }
                        }
                    } else if (element instanceof HTMLElement && element.isContentEditable) {
                        element.focus();
                        element.textContent = value;
                        element.dispatchEvent(new Event("input", { bubbles: true }));
                    } else {
                        return {
                            success: false,
                            error: "Элемент не поддерживает ввод текста",
                        };
                    }
                }

                return {
                    success: true,
                    elementTag:
                        element instanceof Element
                            ? element.tagName.toLowerCase()
                            : "",
                };
            })();`,
            true,
        );

        if (waitedMs > 0) {
            await new Promise((resolve) => {
                setTimeout(resolve, waitedMs);
            });
        }

        const finalUrl = webContents.getURL() || "";
        const title = webContents.getTitle() || "";
        const success = Boolean(interaction?.success);

        return {
            success,
            action,
            selector,
            elementTag:
                typeof interaction?.elementTag === "string"
                    ? interaction.elementTag
                    : undefined,
            url: finalUrl,
            title,
            waitedMs,
            ...(success
                ? {}
                : {
                      error:
                          typeof interaction?.error === "string"
                              ? interaction.error
                              : "Не удалось выполнить действие",
                  }),
        };
    }
}
