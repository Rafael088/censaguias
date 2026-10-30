import type { ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "secondary" | "text";
type ButtonSize = "sm" | "md";

// Figma «03 / Botones y geometría»: primario relleno verde, secundario borde verde
// sobre blanco, texto solo verde; deshabilitado con fondo tinte y borde línea.
const variants: Record<ButtonVariant, string> = {
  primary: "bg-primary text-white",
  secondary: "border border-line bg-surface text-primary",
  text: "text-primary",
};

const sizes: Record<ButtonSize, string> = {
  sm: "min-h-11 px-3 text-label",
  // Figma: botones de al menos 46 px de alto.
  md: "min-h-[46px] px-4 text-body",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  type = "button",
  disabled,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-control font-semibold transition-opacity outline-none hover:opacity-90 active:opacity-80 disabled:cursor-not-allowed disabled:border-line disabled:bg-tint disabled:text-primary disabled:opacity-100 ${variants[variant]} ${sizes[size]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
