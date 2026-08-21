import { createProviderStub } from './providerContract';

// Contract-only adapter. Provider credentials and calls must live on the future backend.
export const googleProvider = createProviderStub('google');
export default googleProvider;
