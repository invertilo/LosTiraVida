// SF Symbols–inspired line icons. 24×24 grid, currentColor, decorative by default.
import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Icon({ size = 20, children, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const PlayIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M7 4.8v14.4a1 1 0 0 0 1.52.85l11.5-7.2a1 1 0 0 0 0-1.7L8.52 3.95A1 1 0 0 0 7 4.8Z" fill="currentColor" stroke="none" />
  </Icon>
);
export const PauseIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="6" y="4.5" width="4" height="15" rx="1.2" fill="currentColor" stroke="none" />
    <rect x="14" y="4.5" width="4" height="15" rx="1.2" fill="currentColor" stroke="none" />
  </Icon>
);
export const RestartIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 12a8 8 0 1 0 2.4-5.7" />
    <path d="M4 4v4.5h4.5" />
  </Icon>
);
export const QuestionIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.5 9.3a2.6 2.6 0 0 1 5 .9c0 1.8-2.5 2.2-2.5 3.8" />
    <circle cx="12" cy="17" r="0.6" fill="currentColor" />
  </Icon>
);
export const ChevronLeftIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="m14.5 5.5-6.5 6.5 6.5 6.5" />
  </Icon>
);
export const ChevronRightIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="m9.5 5.5 6.5 6.5-6.5 6.5" />
  </Icon>
);
export const CloseIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Icon>
);
export const MinusIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6 12h12" />
  </Icon>
);
export const PlusIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 6v12M6 12h12" />
  </Icon>
);
export const SunIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
  </Icon>
);
export const MoonIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />
  </Icon>
);

/* Resources */
export const OxygenIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="9" cy="13" r="5" />
    <circle cx="17" cy="7" r="3" />
    <circle cx="18" cy="16.5" r="1.6" />
  </Icon>
);
export const WaterIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3.2s6 6.4 6 11a6 6 0 0 1-12 0c0-4.6 6-11 6-11Z" />
    <path d="M9.2 14.6a2.8 2.8 0 0 0 2.6 2.7" />
  </Icon>
);
export const FoodIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 21V10" />
    <path d="M12 13c-4.5 0-7-2.8-7-7 4.5 0 7 2.8 7 7Z" />
    <path d="M12 10.5c0-3.7 2.4-6.2 6.5-6.2 0 3.7-2.4 6.2-6.5 6.2Z" />
  </Icon>
);
export const PowerIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M13 2.8 5.5 13.2h6l-1 8 7.5-10.4h-6l1-8Z" />
  </Icon>
);
export const ShieldIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3 4.8 5.8v5.6c0 4.6 3 8.2 7.2 9.6 4.2-1.4 7.2-5 7.2-9.6V5.8L12 3Z" />
  </Icon>
);
export const LungsIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 4v7m0 0-2.5 2M12 11l2.5 2" />
    <path d="M8.5 7.5C6 7.5 4 11 4 15.5c0 2.3.9 3.8 2.6 3.8 2.3 0 3.4-1.8 3.4-4.5V9a1.5 1.5 0 0 0-1.5-1.5Z" />
    <path d="M15.5 7.5C18 7.5 20 11 20 15.5c0 2.3-.9 3.8-2.6 3.8-2.3 0-3.4-1.8-3.4-4.5V9a1.5 1.5 0 0 1 1.5-1.5Z" />
  </Icon>
);
export const RadiationIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="1.6" fill="currentColor" />
    <path d="M12 12 8.3 5.6A7.4 7.4 0 0 0 4.6 12h7.4Z" fill="currentColor" stroke="none" opacity="0.9" />
    <path d="m12 12 3.7-6.4a7.4 7.4 0 0 1 3.7 6.4H12Z" fill="currentColor" stroke="none" opacity="0.9" />
    <path d="m12 12-3.7 6.4a7.4 7.4 0 0 0 7.4 0L12 12Z" fill="currentColor" stroke="none" opacity="0.9" />
  </Icon>
);

/* Event severities */
export const CheckCircleIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="m8 12.3 2.7 2.7L16.2 9.4" />
  </Icon>
);
export const WarningIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M10.3 4.2 2.9 17.5A2 2 0 0 0 4.6 20.5h14.8a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0Z" />
    <path d="M12 9.5v4.2" />
    <circle cx="12" cy="16.9" r="0.6" fill="currentColor" />
  </Icon>
);
export const CriticalIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M8.3 2.8h7.4l5.5 5.5v7.4l-5.5 5.5H8.3l-5.5-5.5V8.3l5.5-5.5Z" />
    <path d="M12 7.6v5.2" />
    <circle cx="12" cy="16.2" r="0.6" fill="currentColor" />
  </Icon>
);
export const FailureIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="m9 9 6 6M15 9l-6 6" />
  </Icon>
);
export const SparkleIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3.5c.6 4.3 2.2 5.9 6.5 6.5-4.3.6-5.9 2.2-6.5 6.5-.6-4.3-2.2-5.9-6.5-6.5 4.3-.6 5.9-2.2 6.5-6.5Z" />
    <path d="M18.5 15.5c.3 1.9 1 2.6 2.9 2.9-1.9.3-2.6 1-2.9 2.9-.3-1.9-1-2.6-2.9-2.9 1.9-.3 2.6-1 2.9-2.9Z" />
  </Icon>
);

/* Crew roles */
export const StarIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="m12 3.5 2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8L12 3.5Z" />
  </Icon>
);
export const WrenchIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M14.7 6.3a4 4 0 0 0 5 5L20 11a4.5 4.5 0 0 1-6 5.3L8 22l-3-3 5.7-6A4.5 4.5 0 0 1 16 7l-1.3-.7Z" />
  </Icon>
);
export const FlaskIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M9.5 3h5M10 3v6L4.8 18.2A1.9 1.9 0 0 0 6.5 21h11a1.9 1.9 0 0 0 1.7-2.8L14 9V3" />
    <path d="M7.2 15h9.6" />
  </Icon>
);
export const MedicalIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
    <path d="M12 8v8M8 12h8" />
  </Icon>
);
export const LeafIcon = FoodIcon;
export const RockIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 18.5 7 9l5-4 5 3 3 10.5H4Z" />
    <path d="m7 9 4 3.5L17 8M11 12.5l1 6" />
  </Icon>
);
export const PeopleIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3 19.5c.6-3.3 3-5.2 6-5.2s5.4 1.9 6 5.2" />
    <circle cx="17" cy="9" r="2.4" />
    <path d="M16.5 14.4c2.3.2 4 1.8 4.5 4.6" />
  </Icon>
);
