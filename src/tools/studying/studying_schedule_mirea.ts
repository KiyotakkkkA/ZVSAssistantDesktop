import type { AppCacheEntry } from "../../types/ElectronApi";

type ScheduleLesson = {
    time: string;
    subject: string;
    type: string;
    teacher: string;
    location: string;
    uid: string;
};

type ScheduleDay = {
    weekday: string;
    lessons: ScheduleLesson[];
};

export type ScheduleResponse = Record<string, ScheduleDay> | { error: string };

type ParsedProperty = {
    name: string;
    params: Record<string, string>;
    value: string;
};

type ParsedEvent = Record<string, ParsedProperty[]>;

type CachedEntry = AppCacheEntry & {
    data: ScheduleResponse;
};

const CACHE_PREFIX = "zvs::mirea_schedule::";
const MOSCOW_TZ = "Europe/Moscow";
const DEFAULT_TTL_SECONDS = 1800;

const WEEKDAYS_RU: Record<number, string> = {
    0: "понедельник",
    1: "вторник",
    2: "среда",
    3: "четверг",
    4: "пятница",
    5: "суббота",
    6: "воскресенье",
};

export const fetchMireaScheduleByDate = async (
    url: string,
    targetDate?: string,
): Promise<ScheduleResponse> => {
    const key = buildCacheKey(url, targetDate);
    const cached = await getCachedEntry(key);

    if (cached && isCacheValid(cached, DEFAULT_TTL_SECONDS)) {
        return cached.data;
    }

    try {
        const html = await fetchHtml(url);
        const icalContent = extractIcalFromHtml(html);
        const grouped = parseSchedule(
            icalContent,
            targetDate,
            DEFAULT_TTL_SECONDS,
        );

        setCachedEntry(key, grouped.entry);
        return grouped.data;
    } catch (error) {
        if (cached && isCacheValid(cached, DEFAULT_TTL_SECONDS)) {
            return cached.data;
        }

        const message =
            error instanceof Error ? error.message : "unknown_error";
        return {
            error: `schedule_fetch_failed with exception: ${message}`,
        };
    }
};

const buildCacheKey = (url: string, targetDate?: string): string => {
    return `${CACHE_PREFIX}${url}::${targetDate || "all"}`;
};

const getCachedEntry = async (
    key: string,
): Promise<CachedEntry | undefined> => {
    if (typeof window === "undefined" || !window.appApi?.cache) {
        return undefined;
    }

    const parsed = await window.appApi.cache.getCacheEntry(key);
    if (!parsed) {
        return undefined;
    }

    try {
        if (
            typeof parsed !== "object" ||
            parsed === null ||
            typeof parsed.ttlSeconds !== "number" ||
            typeof parsed.expiresAt !== "number" ||
            typeof parsed.collectedAt !== "number"
        ) {
            return undefined;
        }

        return parsed as CachedEntry;
    } catch {
        return undefined;
    }
};

const setCachedEntry = (key: string, entry: CachedEntry): void => {
    if (typeof window === "undefined" || !window.appApi?.cache) {
        return;
    }

    void window.appApi.cache.setCacheEntry(key, entry);
};

const isCacheValid = (cached: CachedEntry, ttlSeconds: number): boolean => {
    if (cached.ttlSeconds !== ttlSeconds) {
        return false;
    }

    return Date.now() / 1000 < cached.expiresAt;
};

const buildCacheEntry = (
    data: ScheduleResponse,
    ttlSeconds: number,
): CachedEntry => {
    const collectedAt = Math.floor(Date.now() / 1000);
    return {
        collectedAt,
        ttlSeconds,
        expiresAt: collectedAt + ttlSeconds,
        data,
    };
};

const fetchHtml = async (url: string): Promise<string> => {
    if (typeof window !== "undefined" && window.appApi?.network) {
        const response = await window.appApi.network.proxyHttpRequest({
            url,
            method: "GET",
            headers: {
                "User-Agent": "Mozilla/5.0",
            },
        });

        if (!response.ok) {
            throw new Error(`request_failed_${response.status}`);
        }

        return response.bodyText;
    }

    const response = await fetch(url, {
        method: "GET",
        headers: {
            "User-Agent": "Mozilla/5.0",
        },
    });

    if (!response.ok) {
        throw new Error(`request_failed_${response.status}`);
    }

    return response.text();
};

const extractIcalFromHtml = (htmlContent: string): string => {
    const match = htmlContent.match(
        /<script id="__NEXT_DATA__".*?>(.*?)<\/script>/s,
    );

    if (!match || !match[1]) {
        throw new Error("next_data_not_found");
    }

    const data = JSON.parse(match[1]) as {
        props?: {
            pageProps?: {
                scheduleLoadInfo?: Array<{ iCalContent?: string }>;
            };
        };
    };

    const icalContent =
        data.props?.pageProps?.scheduleLoadInfo?.[0]?.iCalContent;

    if (!icalContent) {
        throw new Error("ical_content_not_found");
    }

    return icalContent;
};

const parseSchedule = (
    icalContent: string,
    targetDate: string | undefined,
    ttlSeconds: number,
): { data: ScheduleResponse; entry: CachedEntry } => {
    const now = new Date();
    const startDate = targetDate ? new Date(`${targetDate}T00:00:00`) : now;
    const endDate = targetDate
        ? new Date(startDate.getTime() + 24 * 60 * 60 * 1000)
        : new Date(startDate.getTime() + 180 * 24 * 60 * 60 * 1000);

    const events = parseIcalEvents(icalContent, startDate, endDate);
    const grouped = groupEventsByDay(events);

    const data: ScheduleResponse =
        targetDate && grouped[targetDate]
            ? { [targetDate]: grouped[targetDate] }
            : grouped;

    return {
        data,
        entry: buildCacheEntry(data, ttlSeconds),
    };
};

const parseIcalEvents = (
    icalContent: string,
    startDate: Date,
    endDate: Date,
): Array<{
    summary: string;
    start: Date;
    end: Date | null;
    location: string;
    description: string;
    uid: string;
    categories: string;
}> => {
    const normalized = icalContent
        .replace(/\\r\\n/g, "\r\n")
        .replace(/\\n/g, "\n");
    const events = parseEventsFromIcs(normalized);
    const startTimestamp = startDate.getTime();
    const endTimestamp = endDate.getTime();

    const result: Array<{
        summary: string;
        start: Date;
        end: Date | null;
        location: string;
        description: string;
        uid: string;
        categories: string;
    }> = [];

    for (const event of events) {
        const summary = readPropertyValue(event, "SUMMARY");

        if (summary.toLowerCase().includes("неделя")) {
            continue;
        }

        const startProp = readProperty(event, "DTSTART");
        if (!startProp) {
            continue;
        }

        const endProp = readProperty(event, "DTEND");
        const start = parseIcsDate(startProp.value, startProp.params);
        const end = endProp
            ? parseIcsDate(endProp.value, endProp.params)
            : null;

        const baseItem = {
            summary: cleanText(summary),
            start,
            end,
            location: cleanText(readPropertyValue(event, "LOCATION")),
            description: decodeEscapedText(
                readPropertyValue(event, "DESCRIPTION"),
            ),
            uid: readPropertyValue(event, "UID"),
            categories: readPropertyValue(event, "CATEGORIES"),
        };

        const exDates = readPropertyList(event, "EXDATE").flatMap((item) =>
            item.value
                .split(",")
                .map((value) => value.trim())
                .filter((value) => value.length > 0)
                .map((value) => parseIcsDate(value, item.params)),
        );

        const recurrence = readPropertyValue(event, "RRULE");

        if (recurrence) {
            const occurrences = expandRecurrence({
                recurrence,
                dtstart: start,
                rangeStart: startDate,
                rangeEnd: endDate,
            });

            for (const occurrence of occurrences) {
                if (hasExcludedDate(occurrence, exDates)) {
                    continue;
                }

                const occTs = occurrence.getTime();
                if (occTs < startTimestamp || occTs > endTimestamp) {
                    continue;
                }

                const durationMs =
                    baseItem.end && baseItem.start
                        ? baseItem.end.getTime() - baseItem.start.getTime()
                        : null;

                result.push({
                    ...baseItem,
                    start: occurrence,
                    end:
                        durationMs !== null
                            ? new Date(occurrence.getTime() + durationMs)
                            : null,
                });
            }
            continue;
        }

        const startTs = baseItem.start.getTime();
        if (startTs >= startTimestamp && startTs <= endTimestamp) {
            result.push(baseItem);
        }
    }

    return result;
};

const parseEventsFromIcs = (ics: string): ParsedEvent[] => {
    const unfolded = unfoldIcs(ics);
    const lines = unfolded.split(/\r?\n/);
    const events: ParsedEvent[] = [];
    let currentEvent: ParsedEvent | null = null;

    for (const line of lines) {
        if (line === "BEGIN:VEVENT") {
            currentEvent = {};
            continue;
        }

        if (line === "END:VEVENT") {
            if (currentEvent) {
                events.push(currentEvent);
            }
            currentEvent = null;
            continue;
        }

        if (!currentEvent) {
            continue;
        }

        const parsed = parsePropertyLine(line);
        if (!parsed) {
            continue;
        }

        const existing = currentEvent[parsed.name] || [];
        existing.push(parsed);
        currentEvent[parsed.name] = existing;
    }

    return events;
};

const unfoldIcs = (ics: string): string => ics.replace(/\r?\n[ \t]/g, "");

const parsePropertyLine = (line: string): ParsedProperty | null => {
    const separatorIndex = line.indexOf(":");
    if (separatorIndex <= 0) {
        return null;
    }

    const left = line.slice(0, separatorIndex);
    const value = line.slice(separatorIndex + 1);
    const [nameRaw, ...paramsRaw] = left.split(";");
    const params: Record<string, string> = {};

    for (const rawParam of paramsRaw) {
        const [paramNameRaw, paramValueRaw] = rawParam.split("=");

        if (!paramNameRaw || !paramValueRaw) {
            continue;
        }

        params[paramNameRaw.toUpperCase()] = paramValueRaw.replace(
            /^"|"$/g,
            "",
        );
    }

    return {
        name: nameRaw.toUpperCase(),
        params,
        value,
    };
};

const readProperty = (
    event: ParsedEvent,
    name: string,
): ParsedProperty | undefined => event[name]?.[0];

const readPropertyList = (event: ParsedEvent, name: string): ParsedProperty[] =>
    event[name] || [];

const readPropertyValue = (event: ParsedEvent, name: string): string =>
    readProperty(event, name)?.value || "";

const cleanText = (value: string): string =>
    value.replace(/\r\n/g, " ").replace(/\n/g, " ").trim();

const decodeEscapedText = (value: string): string =>
    value
        .replace(/\\n/g, "\n")
        .replace(/\\,/g, ",")
        .replace(/\\;/g, ";")
        .replace(/\\\\/g, "\\")
        .trim();

const parseIcsDate = (value: string, params: Record<string, string>): Date => {
    const clean = value.trim();

    if (/^\d{8}$/.test(clean)) {
        const year = Number(clean.slice(0, 4));
        const month = Number(clean.slice(4, 6));
        const day = Number(clean.slice(6, 8));
        return zonedDateTimeToUtc(
            { year, month, day, hour: 0, minute: 0, second: 0 },
            MOSCOW_TZ,
        );
    }

    const zuluMatch = clean.match(
        /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/,
    );
    if (zuluMatch) {
        return new Date(
            Date.UTC(
                Number(zuluMatch[1]),
                Number(zuluMatch[2]) - 1,
                Number(zuluMatch[3]),
                Number(zuluMatch[4]),
                Number(zuluMatch[5]),
                Number(zuluMatch[6]),
            ),
        );
    }

    const localMatch = clean.match(
        /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})$/,
    );
    if (localMatch) {
        const zone = params.TZID || MOSCOW_TZ;
        return zonedDateTimeToUtc(
            {
                year: Number(localMatch[1]),
                month: Number(localMatch[2]),
                day: Number(localMatch[3]),
                hour: Number(localMatch[4]),
                minute: Number(localMatch[5]),
                second: Number(localMatch[6]),
            },
            zone,
        );
    }

    const fallback = new Date(clean);
    if (!Number.isNaN(fallback.getTime())) {
        return fallback;
    }

    return new Date();
};

const zonedDateTimeToUtc = (
    value: {
        year: number;
        month: number;
        day: number;
        hour: number;
        minute: number;
        second: number;
    },
    timeZone: string,
): Date => {
    const utcGuess = new Date(
        Date.UTC(
            value.year,
            value.month - 1,
            value.day,
            value.hour,
            value.minute,
            value.second,
        ),
    );
    const offset = getTimeZoneOffsetMs(utcGuess, timeZone);
    return new Date(utcGuess.getTime() - offset);
};

const getTimeZoneOffsetMs = (date: Date, timeZone: string): number => {
    const dtf = new Intl.DateTimeFormat("en-US", {
        timeZone,
        hour12: false,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    });

    const parts = dtf.formatToParts(date);
    const get = (type: Intl.DateTimeFormatPartTypes): number => {
        const part = parts.find((item) => item.type === type);
        return Number(part?.value || "0");
    };

    const asUtc = Date.UTC(
        get("year"),
        get("month") - 1,
        get("day"),
        get("hour"),
        get("minute"),
        get("second"),
    );

    return asUtc - date.getTime();
};

const expandRecurrence = (params: {
    recurrence: string;
    dtstart: Date;
    rangeStart: Date;
    rangeEnd: Date;
}): Date[] => {
    const parsed = parseRrule(params.recurrence);
    const freq = parsed.FREQ || "";
    const interval = Number(parsed.INTERVAL || "1");
    const countLimit = parsed.COUNT ? Number(parsed.COUNT) : null;
    const until = parsed.UNTIL ? parseIcsDate(parsed.UNTIL, {}) : null;
    const byDays = (parsed.BYDAY || "")
        .split(",")
        .map((value) => value.trim())
        .filter((value) => value.length > 0);

    if (!freq) {
        return [params.dtstart];
    }

    const results: Date[] = [];
    let generated = 0;
    const absoluteEnd = new Date(
        Math.min(
            params.rangeEnd.getTime(),
            until?.getTime() ?? Number.POSITIVE_INFINITY,
        ),
    );

    const pushOccurrence = (occurrence: Date) => {
        if (countLimit !== null && generated >= countLimit) {
            return;
        }

        generated += 1;
        if (occurrence >= params.rangeStart && occurrence <= absoluteEnd) {
            results.push(occurrence);
        }
    };

    if (freq === "DAILY") {
        let cursor = new Date(params.dtstart);
        while (cursor <= absoluteEnd) {
            pushOccurrence(new Date(cursor));
            if (countLimit !== null && generated >= countLimit) {
                break;
            }
            cursor = new Date(
                cursor.getTime() + interval * 24 * 60 * 60 * 1000,
            );
        }
        return results;
    }

    if (freq === "WEEKLY") {
        const dayCodes = byDays.length
            ? byDays
            : [toIcsWeekday(params.dtstart)];
        const weekdaySet = new Set(dayCodes);
        const anchorWeekStart = startOfWeek(params.dtstart);
        let cursor = new Date(params.dtstart);

        while (cursor <= absoluteEnd) {
            const currentWeekStart = startOfWeek(cursor);
            const weekDiff = Math.floor(
                (currentWeekStart.getTime() - anchorWeekStart.getTime()) /
                    (7 * 24 * 60 * 60 * 1000),
            );

            if (weekDiff >= 0 && weekDiff % interval === 0) {
                const currentCode = toIcsWeekday(cursor);
                if (weekdaySet.has(currentCode)) {
                    const occurrence = cloneDateTime(cursor, params.dtstart);
                    pushOccurrence(occurrence);
                    if (countLimit !== null && generated >= countLimit) {
                        break;
                    }
                }
            }

            cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
        }
        return results;
    }

    if (params.dtstart <= absoluteEnd) {
        pushOccurrence(params.dtstart);
    }

    return results;
};

const parseRrule = (rruleValue: string): Record<string, string> => {
    const parts = rruleValue.split(";");
    const parsed: Record<string, string> = {};

    for (const part of parts) {
        const [keyRaw, valueRaw] = part.split("=");
        if (!keyRaw || !valueRaw) {
            continue;
        }

        parsed[keyRaw.toUpperCase()] = valueRaw;
    }

    return parsed;
};

const toIcsWeekday = (date: Date): string => {
    const day = date.getUTCDay();

    switch (day) {
        case 0:
            return "SU";
        case 1:
            return "MO";
        case 2:
            return "TU";
        case 3:
            return "WE";
        case 4:
            return "TH";
        case 5:
            return "FR";
        default:
            return "SA";
    }
};

const startOfWeek = (date: Date): Date => {
    const copy = new Date(
        Date.UTC(
            date.getUTCFullYear(),
            date.getUTCMonth(),
            date.getUTCDate(),
            0,
            0,
            0,
            0,
        ),
    );
    const day = copy.getUTCDay();
    const shift = day === 0 ? 6 : day - 1;
    copy.setUTCDate(copy.getUTCDate() - shift);
    return copy;
};

const cloneDateTime = (baseDate: Date, timeSource: Date): Date => {
    return new Date(
        Date.UTC(
            baseDate.getUTCFullYear(),
            baseDate.getUTCMonth(),
            baseDate.getUTCDate(),
            timeSource.getUTCHours(),
            timeSource.getUTCMinutes(),
            timeSource.getUTCSeconds(),
            timeSource.getUTCMilliseconds(),
        ),
    );
};

const hasExcludedDate = (occurrence: Date, exDates: Date[]): boolean => {
    const occurrenceKey = dateKeyInZone(occurrence, MOSCOW_TZ);
    return exDates.some(
        (item) => dateKeyInZone(item, MOSCOW_TZ) === occurrenceKey,
    );
};

const dateKeyInZone = (date: Date, timeZone: string): string => {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(date);

    const read = (partName: Intl.DateTimeFormatPartTypes): string =>
        parts.find((part) => part.type === partName)?.value || "00";

    return `${read("year")}-${read("month")}-${read("day")}`;
};

const timeInZone = (date: Date, timeZone: string): string => {
    return new Intl.DateTimeFormat("ru-RU", {
        timeZone,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    }).format(date);
};

const weekdayRu = (date: Date, timeZone: string): string => {
    const dayName = new Intl.DateTimeFormat("ru-RU", {
        timeZone,
        weekday: "long",
    }).format(date);

    const lower = dayName.toLowerCase();
    const fallback = WEEKDAYS_RU[dayNumberInZone(date, timeZone)] || lower;
    return lower || fallback;
};

const dayNumberInZone = (date: Date, timeZone: string): number => {
    const dayText = new Intl.DateTimeFormat("en-US", {
        timeZone,
        weekday: "short",
    }).format(date);

    const map: Record<string, number> = {
        Mon: 0,
        Tue: 1,
        Wed: 2,
        Thu: 3,
        Fri: 4,
        Sat: 5,
        Sun: 6,
    };

    return map[dayText] ?? 0;
};

const groupEventsByDay = (
    events: Array<{
        summary: string;
        start: Date;
        end: Date | null;
        location: string;
        description: string;
        uid: string;
        categories: string;
    }>,
): Record<string, ScheduleDay> => {
    const grouped: Record<string, ScheduleDay> = {};

    for (const event of events) {
        const dateKey = dateKeyInZone(event.start, MOSCOW_TZ);
        const weekday = weekdayRu(event.start, MOSCOW_TZ);

        if (!grouped[dateKey]) {
            grouped[dateKey] = {
                weekday,
                lessons: [],
            };
        }

        const summary = event.summary;
        const subject = summary.replace("ЛК ", "").replace("ПР ", "").trim();
        const type = summary.includes("ЛК ")
            ? "ЛК"
            : summary.includes("ПР ")
              ? "ПР"
              : event.categories;

        let teacher = "";
        if (event.description) {
            const lines = event.description.split("\n");
            const teacherLine = lines.find((line) =>
                line.includes("Преподаватель:"),
            );

            if (teacherLine) {
                teacher = teacherLine.replace("Преподаватель:", "").trim();
            }
        }

        const startTime = timeInZone(event.start, MOSCOW_TZ);
        const endTime = event.end ? timeInZone(event.end, MOSCOW_TZ) : "";
        const time = endTime ? `${startTime} - ${endTime}` : startTime;

        grouped[dateKey].lessons.push({
            time,
            subject,
            type,
            teacher,
            location: event.location,
            uid: event.uid,
        });
    }

    for (const value of Object.values(grouped)) {
        value.lessons.sort((first, second) =>
            first.time.localeCompare(second.time, "ru-RU"),
        );
    }

    return grouped;
};
