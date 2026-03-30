import type { DatabaseService } from "../services/DatabaseService";
import type {
    CreateUserDto,
    GeneralUserData,
    SecureUserData,
    UpdateUserDto,
    User,
} from "../models/user";

interface RawUserData {
    id: string;
    is_current: number;
    general_data: string;
    secure_data: string;
    created_at: string;
    updated_at: string;
}

const normalizeGeneralData = (data: GeneralUserData): GeneralUserData => {
    const enabledPromptTools = data.enabledPromptTools;
    const requiredPromptTools = data.requiredPromptTools.filter((toolName) =>
        enabledPromptTools.includes(toolName),
    );

    return {
        ...data,
        webToolsProvider: data.webToolsProvider,
        enabledPromptTools,
        requiredPromptTools,
        notifyOnJobCompleteToast: Boolean(data.notifyOnJobCompleteToast),
        notifyOnJobCompleteOsNotification: Boolean(
            data.notifyOnJobCompleteOsNotification,
        ),
        notifyOnJobCompleteEmail: Boolean(data.notifyOnJobCompleteEmail),
    };
};

export class UserRepository {
    private cachedUser: User | null = null;

    constructor(private readonly databaseService: DatabaseService) {}

    findCurrentUser() {
        if (this.cachedUser) return this.cachedUser;

        const data = this.databaseService
            .getDatabase()
            .prepare("SELECT * FROM profiles WHERE is_current = 1 LIMIT 1")
            .get() as RawUserData;

        if (!data) {
            return null;
        }

        this.cachedUser = {
            id: data.id,
            isCurrent: data.is_current === 1,
            generalData: normalizeGeneralData(
                JSON.parse(data.general_data) as GeneralUserData,
            ),
            secureData: JSON.parse(data.secure_data) as SecureUserData,
            createdAt: data.created_at,
            updatedAt: data.updated_at,
        } as User;
        return this.cachedUser;
    }

    createUser(data: CreateUserDto) {
        const now = new Date().toISOString();
        const id = crypto.randomUUID();

        this.databaseService
            .getDatabase()
            .prepare(
                `
                INSERT INTO profiles (id, is_current, general_data, secure_data, created_at, updated_at)
                VALUES (@id, @is_current, @general_data, @secure_data, @created_at, @updated_at)
            `,
            )
            .run({
                id,
                is_current: data.isCurrent ? 1 : 0,
                general_data: JSON.stringify(data.generalData),
                secure_data: JSON.stringify(data.secureData),
                created_at: now,
                updated_at: now,
            });

        return this.findCurrentUser() as User;
    }

    updateUser(id: string, data: UpdateUserDto) {
        const existingUser = this.databaseService
            .getDatabase()
            .prepare("SELECT * FROM profiles WHERE id = ?")
            .get(id) as RawUserData;

        if (!existingUser) {
            throw new Error("User not found");
        }

        const updatedGeneralData = data.generalData
            ? JSON.stringify(data.generalData)
            : existingUser.general_data;
        const updatedSecureData = data.secureData
            ? JSON.stringify(data.secureData)
            : existingUser.secure_data;
        const now = new Date().toISOString();

        this.databaseService
            .getDatabase()
            .prepare(
                `
                UPDATE profiles
                SET general_data = @general_data, secure_data = @secure_data, updated_at = @updated_at
                WHERE id = @id
            `,
            )
            .run({
                id,
                general_data: updatedGeneralData,
                secure_data: updatedSecureData,
                updated_at: now,
            });

        this.refreshCache();
    }

    private refreshCache() {
        this.cachedUser = null;
        this.findCurrentUser();
    }
}
