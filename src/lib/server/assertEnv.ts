export function requireEnv(value: string | undefined, name: string): string {
    if (!value) {
        throw new Error(`Missing required env var: ${name}`);
    }
    return value;
}
