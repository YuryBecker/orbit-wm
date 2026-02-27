import Link from "next/link";
import type { ComponentProps } from "react";

export type HeadingProps = ComponentProps<"h1">;
export type ParagraphProps = ComponentProps<"p">;
export type AnchorProps = ComponentProps<typeof Link>;

export function H1({ className, ...props }: HeadingProps) {
  return <h1 className={className} {...props} />;
}

export function H2({ className, ...props }: ComponentProps<"h2">) {
  return <h2 className={className} {...props} />;
}

export function H3({ className, ...props }: ComponentProps<"h3">) {
  return <h3 className={className} {...props} />;
}

export function P({ className, ...props }: ParagraphProps) {
  return <p className={className} {...props} />;
}

export function A({ className, ...props }: AnchorProps) {
  return <Link className={className} {...props} />;
}
