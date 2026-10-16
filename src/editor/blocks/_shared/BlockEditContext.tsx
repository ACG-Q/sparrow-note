import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { AppEditor } from "../../schema";
import { MOBILE_MAX_WIDTH } from "./editMode";

export type PendingEdit = {
  blockId: string;
  container: "side" | "modal";
  type: string;
  label: string;
  iconType: string;
};

type BlockEditContextValue = {
  editor: AppEditor;
  pending: PendingEdit | null;
  open: (p: PendingEdit) => void;
  close: () => void;
};

const BlockEditContext = createContext<BlockEditContextValue | null>(null);

export function BlockEditProvider({
  editor,
  children,
}: {
  editor: AppEditor;
  children: ReactNode;
}) {
  const [pending, setPending] = useState<PendingEdit | null>(null);
  const open = useCallback((p: PendingEdit) => setPending(p), []);
  const close = useCallback(() => setPending(null), []);
  const value = useMemo(
    () => ({ editor, pending, open, close }),
    [editor, pending, open, close],
  );
  return <BlockEditContext.Provider value={value}>{children}</BlockEditContext.Provider>;
}

export function useBlockEdit(): BlockEditContextValue {
  const ctx = useContext(BlockEditContext);
  if (!ctx) {
    throw new Error("useBlockEdit 必须在 BlockEditProvider 内使用");
  }
  return ctx;
}

export function useIsMobile(): boolean {
  const [mobile, setMobile] = useState(
    () => window.matchMedia(`(max-width: ${MOBILE_MAX_WIDTH}px)`).matches,
  );
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_MAX_WIDTH}px)`);
    const onChange = () => setMobile(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return mobile;
}
