interface UpdaterState {
  status: "idle" | "checking" | "available" | "downloading" | "ready" | "none" | "error";
  version: string | null;
  percent: number;
  message: string;
}

interface Window {
  financeUpdater?: {
    getState: () => Promise<UpdaterState>;
    check: () => Promise<void>;
    install: () => Promise<void>;
    onState: (callback: (state: UpdaterState) => void) => () => void;
  };
}
