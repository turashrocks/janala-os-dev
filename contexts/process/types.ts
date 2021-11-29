import type { ComponentProcessProps } from "components/system/Apps/RenderComponent";
import type { Size } from "components/system/Window/RndWindow/useResizable";

export type ProcessElements = {
  componentWindow?: HTMLElement;
  peekElement?: HTMLElement;
  taskbarEntry?: HTMLElement;
};

export type Process = ProcessElements & {
  allowResizing?: boolean;
  autoSizing?: boolean;
  background?: string;
  closing?: boolean;
  Component: React.ComponentType<ComponentProcessProps>;
  defaultSize?: Size;
  hasWindow?: boolean;
  hideTitlebarIcon?: boolean;
  icon: string;
  lockAspectRatio?: boolean;
  maximized?: boolean;
  minimized?: boolean;
  prependTaskbarTitle?: boolean;
  singleton?: boolean;
  title: string;
  url?: string;
};

export type Processes = Record<string, Process>;
