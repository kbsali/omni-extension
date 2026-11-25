import type { OmniModule } from '../../core/types';
import Popup from './Popup.svelte';

const article: OmniModule = {
  id: 'article',
  label: 'PDF',
  icon: '📄',
  Popup,
};

export default article;
