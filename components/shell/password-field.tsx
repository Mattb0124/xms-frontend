"use client";

import { useState } from "react";
import { EyeIcon, EyeOffIcon, ICON } from "@/components/xms/icons";

/** A password field with the show and hide control from the web UI sign-in. */
export function PasswordField({
  id,
  value,
  onChange,
  autoComplete,
  placeholder,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  placeholder?: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="xms-sign-in-field-wrap">
      <input
        id={id}
        type={visible ? "text" : "password"}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="xms-sign-in-field"
        autoComplete={autoComplete}
        placeholder={placeholder}
        required
        minLength={autoComplete === "new-password" ? 8 : undefined}
      />
      <button
        type="button"
        className="xms-sign-in-reveal"
        onClick={() => setVisible((current) => !current)}
        aria-label={visible ? "Hide password" : "Show password"}
        tabIndex={-1}
      >
        {visible ? <EyeOffIcon size={ICON.field} /> : <EyeIcon size={ICON.field} />}
      </button>
    </div>
  );
}
