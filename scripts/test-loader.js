import { registerHooks } from 'node:module';
import { resolve } from './test-resolver.js';

registerHooks({ resolve });
