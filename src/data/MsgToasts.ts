export class MsgToasts {
    static readonly STATUS_SUCCESS = "Успешно!";
    static readonly STATUS_ERROR = "Внимание!";
    static readonly STATUS_WARNING = "Предупреждение!";
    static readonly STATUS_INFO = "Справка";

    static readonly CONNECTION_ERROR = (error: string) => {
        return {
            title: MsgToasts.STATUS_ERROR,
            description: `Подключение провалилось с ошибкой: ${error}`,
        };
    };

    static readonly PROFILE_WAS_NOT_LOADED_ERROR = () => {
        return {
            title: MsgToasts.STATUS_ERROR,
            description: "Не удалось загрузить профиль пользователя.",
        };
    };

    static readonly PROVIDER_NOT_CONFIGURED_ERROR = () => {
        return {
            title: MsgToasts.STATUS_ERROR,
            description:
                "Провайдер не был корректно настроен. Проверьте параметры провайдера и попробуйте снова.",
        };
    };

    static readonly JOB_EXECUTION_ERROR = (jobName: string, error: string) => {
        return {
            title: MsgToasts.STATUS_ERROR,
            description: `Задача ${jobName} завершилась с ошибкой: ${error}`,
        };
    };

    static readonly JOB_CANCELLING_ERROR = (jobName: string) => {
        return {
            title: MsgToasts.STATUS_ERROR,
            description: `Не удалось остановить задачу ${jobName}.`,
        };
    };

    static readonly JOB_CREATION_ERROR = (jobName: string) => {
        return {
            title: MsgToasts.STATUS_ERROR,
            description: `Не удалось создать задачу ${jobName}.`,
        };
    };

    // Warning
    static readonly UNSUPPORTED_FILE_FORMAT_WARNING = (fileName: string) => {
        return {
            title: MsgToasts.STATUS_WARNING,
            description: `Формат файла ${fileName} не поддерживается.`,
        };
    };

    static readonly FILE_TOO_LARGE_WARNING = (
        fileName: string,
        maxSize: string,
    ) => {
        return {
            title: MsgToasts.STATUS_WARNING,
            description: `Файл ${fileName} превышает лимит в ${maxSize}.`,
        };
    };

    // Success
    static readonly COPY_SUCCESS = () => {
        return {
            title: MsgToasts.STATUS_SUCCESS,
            description: "Текст скопирован в буфер обмена",
        };
    };

    static readonly FOLDER_SUCCESSFULLY_CREATED = () => {
        return {
            title: MsgToasts.STATUS_SUCCESS,
            description: "Папка успешно создана",
        };
    };

    static readonly FOLDER_SUCCESSFULLY_REMOVED = () => {
        return {
            title: MsgToasts.STATUS_SUCCESS,
            description: "Папка успешно удалена",
        };
    };

    static readonly FOLDER_SUCCESSFULLY_RENAMED = () => {
        return {
            title: MsgToasts.STATUS_SUCCESS,
            description: "Папка успешно переименована",
        };
    };

    static readonly FILE_SUCCESSFULLY_UPLOADED = () => {
        return {
            title: MsgToasts.STATUS_SUCCESS,
            description: "Файл успешно загружен",
        };
    };

    static readonly VSTORE_SUCCESSFULLY_CREATED = () => {
        return {
            title: MsgToasts.STATUS_SUCCESS,
            description: "Векторное хранилище успешно создано",
        };
    };

    static readonly VSTORE_SUCCESSFULLY_REMOVED = () => {
        return {
            title: MsgToasts.STATUS_SUCCESS,
            description: "Векторное хранилище успешно удалено",
        };
    };

    static readonly VSTORE_SUCCESSFULLY_CHANGED = () => {
        return {
            title: MsgToasts.STATUS_SUCCESS,
            description: "Векторное хранилище успешно изменено",
        };
    };

    static readonly DIALOG_SUCCESSFULLY_CREATED = () => {
        return {
            title: MsgToasts.STATUS_SUCCESS,
            description: "Диалог успешно создан",
        };
    };

    static readonly DIALOG_SUCCESSFULLY_REMOVED = () => {
        return {
            title: MsgToasts.STATUS_SUCCESS,
            description: "Диалог успешно удалён",
        };
    };

    static readonly DIALOG_SUCCESSFULLY_RENAMED = () => {
        return {
            title: MsgToasts.STATUS_SUCCESS,
            description: "Диалог успешно переименован",
        };
    };

    static readonly JOB_SUCCESSFULLY_COMPLETED = (jobName: string) => {
        return {
            title: MsgToasts.STATUS_SUCCESS,
            description: `Задача ${jobName} успешно завершена`,
        };
    };

    static readonly JOB_SUCCESSFULLY_CREATED = (jobName: string) => {
        return {
            title: MsgToasts.STATUS_SUCCESS,
            description: `Фоновая задача ${jobName} успешно создана`,
        };
    };

    static readonly JOB_SUCCESSFULLY_STOPPED = (jobName: string) => {
        return {
            title: MsgToasts.STATUS_INFO,
            description: `Задача ${jobName} была остановлена`,
        };
    };
}
