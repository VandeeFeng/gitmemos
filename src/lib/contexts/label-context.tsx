import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { Label } from '@/types/github';
import { getLabels } from '@/lib/github';

interface LabelContextType {
  labels: Label[];
  loading: boolean;
  syncLabels: () => Promise<void>;
  updateLabels: (newLabels: Label[]) => void;
}

const LabelContext = createContext<LabelContextType>({
  labels: [],
  loading: false,
  syncLabels: async () => {},
  updateLabels: () => {}
});

export function LabelProvider({ children }: { children: ReactNode }) {
  const [labels, setLabels] = useState<Label[]>([]);
  const [loading, setLoading] = useState(true);

  const syncLabels = useCallback(async () => {
    setLoading(true);
    try {
      const labelsData = await getLabels(true); // Force sync
      setLabels(labelsData);
    } catch (error) {
      console.error('Error syncing labels:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const updateLabels = useCallback((newLabels: Label[]) => {
    setLabels(newLabels);
  }, []);

  useEffect(() => {
    async function initializeLabels() {
      try {
        const labelsData = await getLabels();
        setLabels(labelsData);
      } catch (error) {
        console.error('Error initializing labels:', error);
      } finally {
        setLoading(false);
      }
    }

    initializeLabels();
  }, []);

  return (
    <LabelContext.Provider value={{ labels, loading, syncLabels, updateLabels }}>
      {children}
    </LabelContext.Provider>
  );
}

export function useLabels() {
  return useContext(LabelContext);
} 