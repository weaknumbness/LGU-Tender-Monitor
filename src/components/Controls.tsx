import {
  createContext,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
const TabContext = createContext({ value: "", change: (_s: string) => {} });
export function Tabs({
  value,
  onValueChange,
  children,
}: {
  value: string;
  onValueChange: (s: string) => void;
  children: ReactNode;
}) {
  return (
    <TabContext.Provider value={{ value, change: onValueChange }}>
      {children}
    </TabContext.Provider>
  );
}
export function TabsList({
  className,
  children,
}: {
  className: string;
  variant: string;
  children: ReactNode;
}) {
  return <div className={className}>{children}</div>;
}
export function TabsTrigger({
  value,
  children,
}: {
  value: string;
  children: ReactNode;
}) {
  const tab = useContext(TabContext);
  return (
    <button
      type="button"
      data-state={tab.value === value ? "active" : "inactive"}
      aria-pressed={tab.value === value}
      onClick={() => tab.change(value)}
    >
      {children}
    </button>
  );
}
export function Dialog({
  open,
  onOpenChange,
  children,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (open && !el?.open) el?.showModal();
    if (!open && el?.open) el.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      aria-label="Подробности и настройки"
      onCancel={() => onOpenChange(false)}
      onClick={(e) => {
        if (e.target === ref.current) onOpenChange(false);
      }}
    >
      {open && (
        <div>
          <button
            className="dialog-close"
            aria-label="Закрыть"
            onClick={() => onOpenChange(false)}
          >
            ×
          </button>
          {children}
        </div>
      )}
    </dialog>
  );
}
export const Sheet = Dialog;
export function DialogContent({
  className,
  children,
}: {
  className: string;
  children: ReactNode;
}) {
  return <div className={className}>{children}</div>;
}
export const SheetContent = DialogContent;
export function DialogTitle({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <h2 className={className}>{children}</h2>;
}
export const SheetTitle = DialogTitle;
export function DialogDescription({ children }: { children: ReactNode }) {
  return <p className="muted">{children}</p>;
}
export const SheetDescription = DialogDescription;
