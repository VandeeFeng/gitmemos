import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { Label } from '@/types/github';
import { getLabels, getGitHubConfig } from '@/lib/github';
import { useIssues } from './issue-context';

interface LabelContextType {
  labels: Label[];
  loading: boolean;
  error: string | null;
  syncLabels: () => Promise<void>;
  updateLabels: (newLabels: Label[]) => void;
}

const LabelContext = createContext<LabelContextType>({
  labels: [],
  loading: false,
  error: null,
  syncLabels: async () => {},
  updateLabels: () => {}
});

export function LabelProvider({ children }: { children: ReactNode }) {
  const [labels, setLabels] = useState<Label[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { config } = useIssues(); // Get config from issue context

  const syncLabels = useCallback(async () => {
    if (!config?.owner || !config?.repo) {
      setError('GitHub configuration is not set');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const labelsData = await getLabels(true); // Force sync
      setLabels(labelsData);
    } catch (error) {
      console.error('Error syncing labels:', error);
      setError(error instanceof Error ? error.message : 'Failed to sync labels');
    } finally {
      setLoading(false);
    }
  }, [config]);

  const updateLabels = useCallback((newLabels: Label[]) => {
    setLabels(newLabels);
  }, []);

  useEffect(() => {
    async function initializeLabels() {
      if (!config?.owner || !config?.repo) {
        setError('Waiting for GitHub configuration...');
        setLoading(false);
        return;
      }

      try {
        const labelsData = await getLabels();
        setLabels(labelsData);
        setError(null);
      } catch (error) {
        console.error('Error initializing labels:', error);
        setError(error instanceof Error ? error.message : 'Failed to initialize labels');
      } finally {
        setLoading(false);
      }
    }

    initializeLabels();
  }, [config]); // Re-run when config changes

  return (
    <LabelContext.Provider value={{ labels, loading, error, syncLabels, updateLabels }}>
      {children}
    </LabelContext.Provider>
  );
}

export function useLabels() {
  return useContext(LabelContext);
} 