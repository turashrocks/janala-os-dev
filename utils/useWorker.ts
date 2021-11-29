import { useEffect, useState } from "react";

const useWorker = <T>(
  workerFunction: () => void,
  onMessage: (message: { data: T }) => void
): void => {
  const [worker, setWorker] = useState<Worker>();

  useEffect(() => {
    const workerUrl = URL.createObjectURL(
      new Blob(["(", workerFunction.toString(), ")()"], {
        type: "application/javascript",
      })
    );

    setWorker(new Worker(workerUrl));

    URL.revokeObjectURL?.(workerUrl);
  }, [workerFunction]);

  useEffect(() => {
    worker?.addEventListener("message", onMessage, { passive: true });
    worker?.postMessage("init");

    return () => {
      try {
        worker?.terminate();
      } catch (error) {
        if ((error as Error).message !== "Not Supported") throw error;
      }
    };
  }, [onMessage, worker]);
};

export default useWorker;
