import article from '../modules/article';
import cookies from '../modules/cookies';
import dark from '../modules/dark';
import emoji from '../modules/emoji';
import ntfy from '../modules/ntfy';
import type { OmniModule } from './types';

export const modules: OmniModule[] = [dark, cookies, emoji, ntfy, article];
