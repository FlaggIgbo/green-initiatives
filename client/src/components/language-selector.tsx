import { useTranslation, type Locale } from "@/hooks/use-translation";
import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FaGlobe } from "react-icons/fa";

const LOCALE_NAMES: Record<Locale, string> = {
  "en-US": "English (US)",
  "es-US": "Español (US)",
  "es-MX": "Español (MX)",
  "pt-BR": "Português (BR)",
};

export function LanguageSelector() {
  const { locale, setLocale } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <Select
      value={locale}
      open={open}
      onOpenChange={setOpen}
      onValueChange={(value) => setLocale(value as Locale)}
    >
      <SelectTrigger className="w-[180px]">
        <div className="flex items-center gap-2">
          <FaGlobe className="h-4 w-4" />
          <SelectValue />
        </div>
      </SelectTrigger>
      <SelectContent>
        {Object.entries(LOCALE_NAMES).map(([code, name]) => (
          <SelectItem key={code} value={code}>
            {name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
