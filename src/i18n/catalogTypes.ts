import type {MessageKey} from './messages';
import type {Instrument} from '../music/instruments';

/** Named catalogs avoid depending on a locale's position in legacy translation rows. */
export interface LocaleCatalog {
  messages: Record<MessageKey, string>;
  text: Record<string, string>;
  instruments: Record<Instrument, string>;
  scales: Record<string, string>;
}
