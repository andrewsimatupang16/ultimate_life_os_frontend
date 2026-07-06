import * as React from "react"
import * as AvatarPrimitive from "@radix-ui/react-avatar"

import { cn } from "@/lib/utils"

function normalizeAvatarSource(src: unknown) {
  if (typeof src !== "string") return undefined

  const trimmed = src.trim()
  if (!trimmed) return undefined

  if (trimmed.startsWith("//")) return `https:${trimmed}`

  const googleDriveFileMatch = trimmed.match(/drive\.google\.com\/file\/d\/([^/]+)/)
  if (googleDriveFileMatch?.[1]) {
    return `https://drive.google.com/uc?export=view&id=${googleDriveFileMatch[1]}`
  }

  const googleDriveOpenMatch = trimmed.match(/[?&]id=([^&]+)/)
  if (trimmed.includes("drive.google.com") && googleDriveOpenMatch?.[1]) {
    return `https://drive.google.com/uc?export=view&id=${googleDriveOpenMatch[1]}`
  }

  if (trimmed.includes("dropbox.com")) {
    return trimmed.replace("www.dropbox.com", "dl.dropboxusercontent.com").replace(/[?&]dl=0$/, "")
  }

  return trimmed
}

function Avatar({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Root>) {
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      className={cn(
        "relative flex size-8 shrink-0 overflow-hidden rounded-full bg-slate-100",
        className
      )}
      {...props}
    />
  )
}

function AvatarImage({
  className,
  src,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Image>) {
  return (
    <AvatarPrimitive.Image
      data-slot="avatar-image"
      src={normalizeAvatarSource(src)}
      referrerPolicy="no-referrer"
      decoding="async"
      className={cn("aspect-square size-full object-cover", className)}
      {...props}
    />
  )
}

function AvatarFallback({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Fallback>) {
  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      delayMs={120}
      className={cn(
        "bg-muted flex size-full items-center justify-center rounded-full",
        className
      )}
      {...props}
    />
  )
}

export { Avatar, AvatarImage, AvatarFallback, normalizeAvatarSource }
