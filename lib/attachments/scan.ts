import type { RampState } from "@/components/xms/state-pill";
import type { AttachmentOrigin, ScanState } from "@/redux/attachmentsApi";
import type { UploadStage } from "@/lib/attachments/upload";

/**
 * The scan chip vocabulary: the desk names the scan, the portal speaks
 * client language. Both sit on the state ramp so the colours stay the
 * house ones (slate for pending, green for clean, red for blocked).
 */
export interface ScanChip {
  label: string;
  ramp: RampState;
  /** Overdue trio for the quarantined case instead of a ramp step. */
  danger: boolean;
}

export function scanChip(state: ScanState | UploadStage, portal = false): ScanChip {
  switch (state) {
    case "clean":
      return { label: portal ? "Ready" : "Clean", ramp: "resolved", danger: false };
    case "quarantined":
      return { label: portal ? "Blocked by security scan" : "Quarantined", ramp: "closed", danger: true };
    case "failed":
      return { label: portal ? "Upload failed" : "Failed", ramp: "closed", danger: true };
    case "presigning":
    case "uploading":
      return { label: "Uploading", ramp: "new", danger: false };
    default:
      return { label: portal ? "Checking file" : "Scanning", ramp: "new", danger: false };
  }
}

export function originLabel(origin: AttachmentOrigin): string {
  switch (origin) {
    case "email":
      return "Email";
    case "portal":
      return "Portal";
    case "sync":
      return "Sync";
    default:
      return "Internal";
  }
}

export const QUARANTINE_PLACEHOLDER = "This file was quarantined by the malware scan";
export const PORTAL_QUARANTINE_PLACEHOLDER = "This file was blocked by the security scan";
