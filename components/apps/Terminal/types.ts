import type { Terminal } from "xterm";

export type CommandInterpreter = {
  cd: string;
  command: string;
  processCommand: () => void;
  setCommand: React.Dispatch<React.SetStateAction<string>>;
  setHistoryPosition: (step: number) => void;
  welcome: () => void;
};

export type OnKeyEvent = {
  domEvent: KeyboardEvent;
};

declare global {
  interface Window {
    Terminal?: typeof Terminal;
  }
}
