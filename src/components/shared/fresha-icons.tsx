/** --- YAML
 * name: Fresha Sidebar Icons
 * description: Exact SVG icons extracted from Fresha partner dashboard sidebar
 * --- */

import React from 'react';

type IconProps = { style?: React.CSSProperties };

/** Home / Dashboard */
export function FreshaHome({ style }: IconProps) {
  return (
    <svg fill="currentColor" viewBox="0 0 32 32" style={style}>
      <path fillRule="evenodd" d="M14.652 3.873a2 2 0 0 1 2.697 0l10.013 9.1A2.04 2.04 0 0 1 28 14.42V26a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V14.421a2.04 2.04 0 0 1 .638-1.448zM6.003 14.44 16 5.333l9.997 9.106L26 26H6z" clipRule="evenodd" />
    </svg>
  );
}

/** Calendar */
export function FreshaCalendar({ style }: IconProps) {
  return (
    <svg fill="currentColor" viewBox="0 0 32 32" style={style}>
      <path fillRule="evenodd" d="M10 2a1 1 0 0 1 1 1v1h10V3a1 1 0 1 1 2 0v1h3a2 2 0 0 1 2 2v20a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h3V3a1 1 0 0 1 1-1M9 6H6v4h20V6h-3v1a1 1 0 1 1-2 0V6H11v1a1 1 0 1 1-2 0zm17 6H6v14h20z" clipRule="evenodd" />
    </svg>
  );
}

/** Tag / Sales (legacy — kept for backwards compatibility) */
export function FreshaTag({ style }: IconProps) {
  return (
    <svg fill="currentColor" viewBox="0 0 32 32" style={style}>
      <path fillRule="evenodd" d="M15.145 2.256a2 2 0 0 1 1.8.55l13.046 13.046a1.99 1.99 0 0 1 0 2.834L18.686 29.99a1.99 1.99 0 0 1-2.834 0L2.806 16.945a2 2 0 0 1-.55-1.8v-.003L4.27 5.054a1 1 0 0 1 .785-.785l10.088-2.012zm.385 1.963L6.1 6.1 4.22 15.53l13.05 13.05 11.31-11.311z" clipRule="evenodd" />
      <path d="M10.5 12a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3" />
    </svg>
  );
}

/** Wallet / Finance */
export function FreshaWallet({ style }: IconProps) {
  return (
    <svg fill="currentColor" viewBox="0 0 32 32" style={style}>
      <path fillRule="evenodd" d="M5 8a3 3 0 0 1 3-3h18a3 3 0 0 1 3 3v3h-2V8a1 1 0 0 0-1-1H8a1 1 0 0 0 0 2h17a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3zm3 3h17a1 1 0 0 1 1 1v3h-5a3 3 0 1 0 0 6h5v3a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V10.83A3 3 0 0 0 8 11m13 6a1 1 0 0 1 1-1h5v2h-5a1 1 0 0 1-1-1" clipRule="evenodd" />
    </svg>
  );
}

/** Smiley / Clients */
export function FreshaSmile({ style }: IconProps) {
  return (
    <svg fill="currentColor" viewBox="0 0 32 32" style={style}>
      <path d="M11.5 15a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3M20.5 15a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3" />
      <path fillRule="evenodd" d="M16 5C9.925 5 5 9.925 5 16s4.925 11 11 11 11-4.925 11-11S22.075 5 16 5M3 16C3 8.82 8.82 3 16 3s13 5.82 13 13-5.82 13-13 13S3 23.18 3 16m7.298 2.135a1 1 0 0 1 1.367.363 5.01 5.01 0 0 0 8.67 0 1 1 0 0 1 1.73 1.004 7.013 7.013 0 0 1-12.13 0 1 1 0 0 1 .363-1.367" clipRule="evenodd" />
    </svg>
  );
}

/** Book / Catalogue */
export function FreshaBook({ style }: IconProps) {
  return (
    <svg fill="currentColor" viewBox="0 0 32 32" style={style}>
      <path fillRule="evenodd" d="M2.586 6.586A2 2 0 0 1 4 6h8a5 5 0 0 1 4 2q.212-.282.465-.536A5 5 0 0 1 20 6h8a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2h-8a3 3 0 0 0-3 3 1 1 0 1 1-2 0 3 3 0 0 0-3-3H4a2 2 0 0 1-2-2V8a2 2 0 0 1 .586-1.414M15 25a5 5 0 0 0-3-1H4V8h8a3 3 0 0 1 3 3zm2 0a5 5 0 0 1 3-1h8V8h-8a3 3 0 0 0-3 3z" clipRule="evenodd" />
    </svg>
  );
}

/** Contact card / Online Booking */
export function FreshaContact({ style }: IconProps) {
  return (
    <svg fill="currentColor" viewBox="0 0 32 32" style={style}>
      <path fillRule="evenodd" d="M2.667 6a2 2 0 0 1 2-2h22.666a2 2 0 0 1 2 2v20a2 2 0 0 1-2 2H4.667a2 2 0 0 1-2-2zm24.666 0H4.667v20h22.666zM16 12a3 3 0 1 0 0 6 3 3 0 0 0 0-6m3.43 6.638a5 5 0 1 0-6.86 0 8 8 0 0 0-.893.423c-1.253.696-2.22 1.719-2.627 2.961a1 1 0 1 0 1.9.622c.213-.65.77-1.32 1.698-1.834.925-.514 2.107-.81 3.352-.81s2.427.296 3.352.81c.928.515 1.485 1.183 1.698 1.834a1 1 0 0 0 1.9-.622c-.406-1.242-1.374-2.265-2.627-2.96a8 8 0 0 0-.893-.424" clipRule="evenodd" />
    </svg>
  );
}

/** Megaphone / Marketing */
export function FreshaMegaphone({ style }: IconProps) {
  return (
    <svg fill="currentColor" viewBox="0 0 32 32" style={style}>
      <path fillRule="evenodd" d="M3.656 3.187a2 2 0 0 1 2.119.272 23.1 23.1 0 0 0 8.763 4.607c2.412.656 3.753.643 3.71.642l5.252.01a6 6 0 0 1 .795 11.946l-1.475 5.922a2 2 0 0 1-3.05 1.175l-1.37-.908a1.99 1.99 0 0 1-.9-1.677V20.79l-.052.006a20 20 0 0 0-2.91.572 23.1 23.1 0 0 0-8.763 4.607A2 2 0 0 1 2.5 24.45V4.984a2 2 0 0 1 1.156-1.797m18.564 17.53-1.34 5.38-1.38-.915v-4.465zm1.28-2h-4v-8h4a4 4 0 1 1 0 8m-6-8.062v8.124l-.282.03c-.784.091-1.89.271-3.206.63A25.1 25.1 0 0 0 4.5 24.433V5a25.1 25.1 0 0 0 9.513 4.996 22 22 0 0 0 3.487.659" clipRule="evenodd" />
    </svg>
  );
}

/** Team / Users group */
export function FreshaTeam({ style }: IconProps) {
  return (
    <svg fill="currentColor" viewBox="0 0 32 32" style={style}>
      <path d="M30.6 18.8a1 1 0 0 1-1.4-.2A6.45 6.45 0 0 0 24 16a1 1 0 0 1 0-2 3 3 0 1 0-2.905-3.75 1 1 0 0 1-1.937-.5 5 5 0 1 1 8.217 4.939 8.5 8.5 0 0 1 3.429 2.71A1 1 0 0 1 30.6 18.8m-6.735 7.7a1 1 0 1 1-1.73 1 7.125 7.125 0 0 0-12.27 0 1 1 0 1 1-1.73-1 9 9 0 0 1 4.217-3.74 6 6 0 1 1 7.296 0 9 9 0 0 1 4.217 3.74M16 22a4 4 0 1 0 0-8 4 4 0 0 0 0 8m-7-7a1 1 0 0 0-1-1 3 3 0 1 1 2.905-3.75 1 1 0 0 0 1.938-.5 5 5 0 1 0-8.218 4.939 8.5 8.5 0 0 0-3.425 2.71A1 1 0 1 0 2.8 18.6 6.45 6.45 0 0 1 8 16a1 1 0 0 0 1-1" />
    </svg>
  );
}

/** Analytics / Reports chart */
export function FreshaAnalytics({ style }: IconProps) {
  return (
    <svg fill="currentColor" viewBox="0 0 32 32" style={style}>
      <path fillRule="evenodd" d="M4 5a1 1 0 0 1 1 1v13.586l6.293-6.293a1 1 0 0 1 1.414 0L16 16.586 23.586 9H21a1 1 0 1 1 0-2h5a1 1 0 0 1 1 1v5a1 1 0 1 1-2 0v-2.586l-8.293 8.293a1 1 0 0 1-1.414 0L12 15.414l-7 7V25h23a1 1 0 1 1 0 2H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1" clipRule="evenodd" />
    </svg>
  );
}

/** Grid + plus / Add-ons */
export function FreshaAddons({ style }: IconProps) {
  return (
    <svg fill="currentColor" viewBox="0 0 32 32" style={style}>
      <path fillRule="evenodd" d="M5 7a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2zm8 0H7v6h6zm4 0a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-6a2 2 0 0 1-2-2zm8 0h-6v6h6zM5 19a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2zm8 0H7v6h6zm9-2a1 1 0 0 1 1 1v3h3a1 1 0 1 1 0 2h-3v3a1 1 0 1 1-2 0v-3h-3a1 1 0 1 1 0-2h3v-3a1 1 0 0 1 1-1" clipRule="evenodd" />
    </svg>
  );
}

/** Gear / Settings */
export function FreshaSettings({ style }: IconProps) {
  return (
    <svg fill="currentColor" viewBox="0 0 32 32" style={style}>
      <path d="M16 10a6 6 0 1 0 6 6 6.006 6.006 0 0 0-6-6m0 10a4 4 0 1 1 0-8 4 4 0 0 1 0 8m13.743-6.599a1 1 0 0 0-.487-.675l-3.729-2.125-.015-4.202a1 1 0 0 0-.353-.76 14 14 0 0 0-4.59-2.584 1 1 0 0 0-.808.074L16 5.23l-3.765-2.106a1 1 0 0 0-.809-.075 14 14 0 0 0-4.585 2.594 1 1 0 0 0-.354.759l-.018 4.206-3.729 2.125a1 1 0 0 0-.486.675 13.3 13.3 0 0 0 0 5.195 1 1 0 0 0 .486.675l3.729 2.125.015 4.202a1 1 0 0 0 .354.76 14 14 0 0 0 4.59 2.584 1 1 0 0 0 .807-.074L16 26.77l3.765 2.106a1.009 1.009 0 0 0 .809.073 14 14 0 0 0 4.585-2.592 1 1 0 0 0 .354-.759l.018-4.206 3.729-2.125a1 1 0 0 0 .486-.675 13.3 13.3 0 0 0-.003-5.19m-1.875 4.364-3.572 2.031a1 1 0 0 0-.375.375c-.072.125-.148.258-.226.383a1 1 0 0 0-.152.526l-.02 4.031c-.96.754-2.029 1.357-3.17 1.788L16.75 24.89a1 1 0 0 0-.489-.125h-.478a1 1 0 0 0-.513.125l-3.605 2.013a12 12 0 0 1-3.18-1.779L8.471 21.1a1 1 0 0 0-.152-.527 7 7 0 0 1-.225-.383 1 1 0 0 0-.375-.383l-3.572-2.031a11 11 0 0 1 0-3.735l3.572-2.035a1 1 0 0 0 .375-.375c.072-.125.148-.258.225-.383a1 1 0 0 0 .152-.526l.02-4.031c.96-.754 2.029-1.358 3.17-1.788l3.593 2.009a1 1 0 0 0 .489.124h.478a1 1 0 0 0 .513-.125l3.605-2.013a12 12 0 0 1 3.18 1.78l.014 4.023a1 1 0 0 0 .152.527q.115.183.225.383a1 1 0 0 0 .375.383l3.572 2.032a11 11 0 0 1 .004 3.739" />
    </svg>
  );
}

/** Question mark / Help */
export function FreshaHelp({ style }: IconProps) {
  return (
    <svg fill="currentColor" viewBox="0 0 32 32" style={style}>
      <path d="M16 24a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3" />
      <path fillRule="evenodd" d="M16 5C9.925 5 5 9.925 5 16s4.925 11 11 11 11-4.925 11-11S22.075 5 16 5M3 16C3 8.82 8.82 3 16 3s13 5.82 13 13-5.82 13-13 13S3 23.18 3 16m11.278-6.657A4.5 4.5 0 1 1 17 17.888V18a1 1 0 1 1-2 0v-1a1 1 0 0 1 1-1 2.5 2.5 0 1 0-2.5-2.5 1 1 0 1 1-2 0 4.5 4.5 0 0 1 2.778-4.157" clipRule="evenodd" />
    </svg>
  );
}

/** Search (header icon) */
export function FreshaSearch({ style }: IconProps) {
  return (
    <svg fill="currentColor" viewBox="0 0 32 32" style={style}>
      <path fillRule="evenodd" d="M14.5 5a9.5 9.5 0 1 0 0 19 9.5 9.5 0 0 0 0-19M3 14.5C3 8.149 8.149 3 14.5 3S26 8.149 26 14.5a11.5 11.5 0 0 1-2.4 7.073l5.707 5.72a1 1 0 0 1-1.414 1.414l-5.72-5.706A11.5 11.5 0 0 1 14.5 26C8.149 26 3 20.851 3 14.5" clipRule="evenodd" />
    </svg>
  );
}

/** Bar chart (header analytics icon) */
export function FreshaBarChart({ style }: IconProps) {
  return (
    <svg fill="currentColor" viewBox="0 0 32 32" style={style}>
      <path fillRule="evenodd" d="M4 5a1 1 0 0 1 1 1v13.586l6.293-6.293a1 1 0 0 1 1.414 0L16 16.586 23.586 9H21a1 1 0 1 1 0-2h5a1 1 0 0 1 1 1v5a1 1 0 1 1-2 0v-2.586l-8.293 8.293a1 1 0 0 1-1.414 0L12 15.414l-7 7V25h23a1 1 0 1 1 0 2H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1" clipRule="evenodd" />
    </svg>
  );
}

/** Bell / Notifications */
export function FreshaBell({ style }: IconProps) {
  return (
    <svg fill="currentColor" viewBox="0 0 32 32" style={style}>
      <path fillRule="evenodd" d="M16 3a1 1 0 0 1 1 1v1.07A8 8 0 0 1 24 13v4.697l2.555 3.832A1 1 0 0 1 25.723 23H20a4 4 0 0 1-8 0H6.277a1 1 0 0 1-.832-1.471L8 17.697V13a8 8 0 0 1 7-7.93V4a1 1 0 0 1 1-1M14 23a2 2 0 0 0 4 0zM10 13a6 6 0 1 1 12 0v5a1 1 0 0 0 .168.555L23.87 21H8.131l1.701-2.445A1 1 0 0 0 10 18z" clipRule="evenodd" />
    </svg>
  );
}
