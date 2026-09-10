export class ProviderError extends Error {
    status;
    provider;
    constructor(provider, message, status) {
        super(message);
        this.name = "ProviderError";
        this.provider = provider;
        this.status = status;
    }
}
