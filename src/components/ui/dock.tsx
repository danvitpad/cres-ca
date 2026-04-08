/** --- YAML
 * name: Dock
 * description: macOS-style dock navigation with magnification effect on hover
 * source: badtz-ui
 * --- */

"use client"

import * as React from "react"
import { useRef } from "react"

import { cn } from "@/lib/utils"

interface DockProps {
  className?: string
  children: React.ReactNode
  maxAdditionalSize?: number
  iconSize?: number
}

interface DockIconProps {
  className?: string
  src?: string
  href?: string
  name: string
  onClick?: () => void
  handleIconHover?: (e: React.MouseEvent<HTMLLIElement>) => void
  children?: React.ReactNode
  iconSize?: number
  isActive?: boolean
}

type ScaleValueParams = [number, number]

export const scaleValue = function (
  value: number,
  from: ScaleValueParams,
  to: ScaleValueParams
): number {
  const scale = (to[1] - to[0]) / (from[1] - from[0])
  const capped = Math.min(from[1], Math.max(from[0], value)) - from[0]
  return Math.floor(capped * scale + to[0])
}

export function DockIcon({
  className,
  src,
  href,
  name,
  onClick,
  handleIconHover,
  children,
  iconSize,
  isActive,
}: DockIconProps) {
  const ref = useRef<HTMLLIElement | null>(null)

  const content = src ? (
    <img
      src={src}
      alt={name}
      className="h-full w-full rounded-[inherit]"
    />
  ) : (
    children
  )

  return (
    <>
      <style jsx>
        {`
          .dock-icon:hover + .dock-icon {
            width: calc(
              var(--icon-size) * 1.33 + var(--dock-offset-right, 0px)
            );
            height: calc(
              var(--icon-size) * 1.33 + var(--dock-offset-right, 0px)
            );
            margin-bottom: calc(
              var(--icon-size) * -0.33 + var(--dock-offset-right, 0) * -1
            );
          }

          .dock-icon:hover + .dock-icon + .dock-icon {
            width: calc(
              var(--icon-size) * 1.17 + var(--dock-offset-right, 0px)
            );
            height: calc(
              var(--icon-size) * 1.17 + var(--dock-offset-right, 0px)
            );
            margin-bottom: calc(
              var(--icon-size) * -0.17 + var(--dock-offset-right, 0) * -1
            );
          }

          .dock-icon:has(+ .dock-icon:hover) {
            width: calc(var(--icon-size) * 1.33 + var(--dock-offset-left, 0px));
            height: calc(
              var(--icon-size) * 1.33 + var(--dock-offset-left, 0px)
            );
            margin-bottom: calc(
              var(--icon-size) * -0.33 + var(--dock-offset-left, 0) * -1
            );
          }

          .dock-icon:has(+ .dock-icon + .dock-icon:hover) {
            width: calc(var(--icon-size) * 1.17 + var(--dock-offset-left, 0px));
            height: calc(
              var(--icon-size) * 1.17 + var(--dock-offset-left, 0px)
            );
            margin-bottom: calc(
              var(--icon-size) * -0.17 + var(--dock-offset-left, 0) * -1
            );
          }
        `}
      </style>
      <li
        ref={ref}
        style={
          {
            transition:
              "width, height, margin-bottom, cubic-bezier(0.25, 1, 0.5, 1) 150ms",
            "--icon-size": `${iconSize}px`,
          } as React.CSSProperties
        }
        onMouseMove={handleIconHover}
        className={cn(
          "dock-icon group/li flex h-[var(--icon-size)] w-[var(--icon-size)] cursor-pointer items-center justify-center px-[calc(var(--icon-size)*0.075)] hover:-mb-[calc(var(--icon-size)/2)] hover:h-[calc(var(--icon-size)*1.5)] hover:w-[calc(var(--icon-size)*1.5)] [&_img]:object-contain",
          className
        )}
      >
        <button
          onClick={onClick}
          className={cn(
            "group/a relative flex items-center justify-center aspect-square w-full rounded-[12px] border p-1.5 transition-colors",
            "border-border/50 bg-gradient-to-t from-muted/80 to-background shadow-sm",
            "after:absolute after:inset-0 after:rounded-[inherit] after:shadow-md after:shadow-zinc-800/5",
            isActive && "ring-2 ring-primary/40 border-primary/30"
          )}
        >
          <span className="absolute bottom-[calc(100%+8px)] left-1/2 -translate-x-1/2 rounded-md border border-border bg-popover px-2 py-1 text-xs whitespace-nowrap text-popover-foreground opacity-0 transition-opacity duration-200 group-hover/li:opacity-100 shadow-lg z-50">
            {name}
          </span>
          {content}
          {isActive && (
            <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-primary" />
          )}
        </button>
      </li>
    </>
  )
}

export function Dock({
  className,
  children,
  maxAdditionalSize = 5,
  iconSize = 48,
}: DockProps) {
  const dockRef = useRef<HTMLDivElement | null>(null)

  const handleIconHover = (e: React.MouseEvent<HTMLLIElement>) => {
    if (!dockRef.current) return
    const mousePos = e.clientX
    const iconPosLeft = e.currentTarget.getBoundingClientRect().left
    const iconWidth = e.currentTarget.getBoundingClientRect().width

    const cursorDistance = (mousePos - iconPosLeft) / iconWidth
    const offsetPixels = scaleValue(
      cursorDistance,
      [0, 1],
      [maxAdditionalSize * -1, maxAdditionalSize]
    )

    dockRef.current.style.setProperty(
      "--dock-offset-left",
      `${offsetPixels * -1}px`
    )

    dockRef.current.style.setProperty(
      "--dock-offset-right",
      `${offsetPixels}px`
    )
  }

  return (
    <nav ref={dockRef} role="navigation" aria-label="Main Dock">
      <ul
        className={cn(
          "flex items-end rounded-2xl border border-border/60 bg-background/95 backdrop-blur-2xl p-1.5 shadow-lg",
          className
        )}
      >
        {React.Children.map(children, (child) =>
          React.isValidElement<DockIconProps>(child)
            ? React.cloneElement(child as React.ReactElement<DockIconProps>, {
                handleIconHover,
                iconSize,
              })
            : child
        )}
      </ul>
    </nav>
  )
}
