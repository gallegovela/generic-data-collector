import {
  Calendar,
  CalendarClock,
  Camera,
  CircleDot,
  Clock,
  Hash,
  Heading,
  ListChecks,
  MapPin,
  PenLine,
  ToggleLeft,
  Type,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  Calendar,
  CalendarClock,
  Camera,
  CircleDot,
  Clock,
  Hash,
  Heading,
  ListChecks,
  MapPin,
  PenLine,
  ToggleLeft,
  Type,
};

export function FieldIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICONS[name] ?? Type;
  return <Icon className={className} aria-hidden="true" />;
}
