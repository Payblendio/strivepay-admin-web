import { IconBell, IconDeviceMobile, IconMail, IconMessage } from "@tabler/icons-react";

export function NotificationChannelIcon({ channel, size = "sm" }: { channel: string; size?: "sm" | "md" }) {
  const value = channel.toUpperCase();
  const px = size === "md" ? 22 : 16;
  const icon = value === "EMAIL"
    ? <IconMail size={px} stroke={1.8} />
    : value === "PUSH"
      ? <IconDeviceMobile size={px} stroke={1.8} />
      : value === "SMS"
        ? <IconMessage size={px} stroke={1.8} />
        : <IconBell size={px} stroke={1.8} />;
  return (
    <span className={`ops-channel-icon ${size} ${value.toLowerCase()}`} aria-label={value} title={value}>
      {icon}
    </span>
  );
}
