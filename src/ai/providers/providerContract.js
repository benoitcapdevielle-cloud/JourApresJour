export class ProviderNotConfiguredError extends Error {
  constructor(providerId) {
    super(`AI provider not configured: ${providerId}`);
    this.name = 'ProviderNotConfiguredError';
    this.code = 'AI_PROVIDER_NOT_CONFIGURED';
    this.providerId = providerId;
  }
}

export const createProviderStub = (id) => Object.freeze({
  id,
  async generate() { throw new ProviderNotConfiguredError(id); },
});
