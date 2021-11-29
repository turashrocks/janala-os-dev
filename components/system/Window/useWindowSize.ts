import { useSession } from "contexts/session";
import { useCallback } from "react";
import { useTheme } from "styled-components";
import { pxToNum } from "utils/functions";

type WindowSize = {
  updateWindowSize: (height: number, width: number) => void;
};

const useWindowSize = (id: string): WindowSize => {
  const { setWindowStates } = useSession();
  const {
    sizes: { titleBar },
  } = useTheme();

  const updateWindowSize = useCallback(
    (height: number, width: number) =>
      setWindowStates((currentWindowStates) => ({
        ...currentWindowStates,
        [id]: {
          position: currentWindowStates[id]?.position,
          size: {
            height: height + pxToNum(titleBar.height),
            width,
          },
        },
      })),
    [id, setWindowStates, titleBar.height]
  );

  return {
    updateWindowSize,
  };
};

export default useWindowSize;
