import { useState } from 'react';

export function useAction() {
  const [loading, setLoading] = useState(false);

  async function run(action: () => Promise<void>) {
    if (loading) return;

    setLoading(true);
    try {
      await action();
    } finally {
      setLoading(false);
    }
  }

  return { loading, run };
}