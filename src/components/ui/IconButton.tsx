import type { ButtonHTMLAttributes, ReactNode } from "react";

export type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
    icon: ReactNode;
    label: string;
};

export default function IconButton({
    className,
    icon,
    label,
    type = "button",
    ...props
}: IconButtonProps) {
    return (
        <button
            aria-label={label}
            className={className}
            type={type}
            {...props}
        >
            {icon}
        </button>
    );
}
