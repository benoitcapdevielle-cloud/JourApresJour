import { createProviderStub } from './providerContract';

// Contract-only adapter. Provider credentials and calls must live on the future backend.
export const anthropicProvider = createProviderStub('anthropic');
export default anthropicProvider;
