import { Toaster as Sonner, toast } from "sonner";
import { useEffect, useState } from "react";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    // Check if document has light or dark class
    const checkTheme = () => {
      const root = document.documentElement;
      if (root.classList.contains('light')) {
        setTheme("light");
      } else if (root.classList.contains('dark')) {
        setTheme("dark");
      } else {
        // Default to light mode
        setTheme("light");
      }
    };

    // Check theme on mount
    checkTheme();

    // Watch for theme changes
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });

    return () => observer.disconnect();
  }, []);

  // Sonner toasts are now handled by NotificationBell - hiding Toaster for compatibility
  return null;
};

export { Toaster, toast };
