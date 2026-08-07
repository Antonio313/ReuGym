import { useState, useEffect } from 'react';
import { hasInstallPrompt, onInstallPromptChange, triggerInstallPrompt } from '@/lib/installPrompt';

export function useInstallPrompt(): { canInstall: boolean; promptInstall: () => Promise<'accepted' | 'dismissed' | 'unavailable'> } {
  const [canInstall, setCanInstall] = useState(hasInstallPrompt());

  useEffect(() => onInstallPromptChange(() => setCanInstall(hasInstallPrompt())), []);

  return { canInstall, promptInstall: triggerInstallPrompt };
}
