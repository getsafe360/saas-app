"use client";
import { Menu } from "@headlessui/react";
import { ChevronDown } from "lucide-react";
import Image from "next/image";

// Supported languages and their flags (public/flags)
const LANGUAGES = [
    { code: "en", label: "English", flag: "/flags/us.svg" },
    { code: "de", label: "Deutsch", flag: "/flags/de.svg" },
    { code: "es", label: "Español", flag: "/flags/es.svg" },
    { code: "fr", label: "Français", flag: "/flags/fr.svg" },
    { code: "it", label: "Italiano", flag: "/flags/it.svg" },
    { code: "pt", label: "Português", flag: "/flags/br.svg" }
];

import { usePathname, useRouter } from "next/navigation";
import { useLocale } from "next-intl";

export function LanguageSwitcher() {
    const router = useRouter();
    const pathname = usePathname();
    const locale = useLocale();
    const activeLang = LANGUAGES.find((l) => l.code === locale) || LANGUAGES[0];

    function changeLang(code: string) {
        // Remove the current locale prefix if present, then add new
        const segments = pathname.split("/");
        if (LANGUAGES.some(l => l.code === segments[1])) segments[1] = code;
        else segments.unshift("", code);
        router.push(segments.join("/"));
    }

    return (
        <Menu as="div" className="relative inline-block text-left text-xs">
            <Menu.Button className="flex items-center px-2 py-1 bg-transparent rounded hover:bg-gray-100 dark:hover:bg-neutral-800 transition focus:outline-none">
                <Image src={activeLang.flag} alt={activeLang.label} width={24} height={24} />
                <ChevronDown className="w-4 h-4 ml-1 text-gray-400" />
            </Menu.Button>
            <Menu.Items className="absolute right-0 mt-2 w-36 origin-top-right rounded shadow-lg bg-white dark:bg-gray-900 ring-0 z-50">
                {LANGUAGES.filter(l => l.code !== activeLang.code).map((l) => (
                    <Menu.Item key={l.code}>
                        {({ active }) => (
                            <button
                                className={`flex items-center w-full px-2 py-1.5 gap-2 text-left ${active ? "bg-gray-100 dark:bg-neutral-800" : ""}`}
                                onClick={() => changeLang(l.code)}
                            >
                                <Image src={l.flag} alt={l.label} width={24} height={24} />
                                {l.label}
                            </button>
                        )}
                    </Menu.Item>
                ))}
            </Menu.Items>
        </Menu>
    );
}
