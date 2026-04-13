import { TextDecoder, TextEncoder } from '@borewit/text-codec';
import { polyfillGlobal } from 'react-native/Libraries/Utilities/PolyfillFunctions';

polyfillGlobal("TextDecoder", () => TextDecoder);
polyfillGlobal("TextEncoder", () => TextEncoder);
