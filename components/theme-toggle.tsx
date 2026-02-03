"use client";

import * as React from "react";
import { useTheme } from "next-themes";

export function ThemeToggle() {
    const { setTheme, resolvedTheme } = useTheme();
    const [mounted, setMounted] = React.useState(false);

    React.useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        return (
            <button className="rounded-md p-2 bg-card-bg text-foreground border border-border opacity-50 cursor-pointer">
                ☀️ Light
            </button>
        );
    }

    return (
        <button
            onClick={() => setTheme(resolvedTheme === "light" ? "dark" : "light")}
            className="rounded-md p-2 bg-card-bg text-foreground border border-border hover:bg-hover-bg transition-colors cursor-pointer"
        >
            {resolvedTheme === "light" ? "🌙 Dark" : "☀️ Light"}
        </button>
    );
}
