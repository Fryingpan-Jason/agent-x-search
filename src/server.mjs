// Compatibility entry for existing fixed-path stdio registrations.
import { pathToFileURL } from 'node:url';
export { serve, toolDefinitions } from './transport.mjs';
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { main } = await import('./command.mjs');
  await main();
}
