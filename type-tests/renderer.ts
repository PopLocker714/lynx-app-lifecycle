import type { JSX as LynxJSX } from '@lynx-js/react/jsx-runtime'
import type { InputProps, NodesRef, SVGProps } from '@lynx-js/types'
import type { JSX as ReactJSX } from 'react'

declare const nativeInput: InputProps
declare const nativeSvg: SVGProps

export const input: LynxJSX.IntrinsicElements['input'] = nativeInput
export const svg: LynxJSX.IntrinsicElements['svg'] = nativeSvg
export const nativeRef = {
    ref: (_node: NodesRef | null) => {},
} satisfies Pick<LynxJSX.IntrinsicElements['input'], 'ref'>
export const domRef = {
    ref: (_node: HTMLInputElement | null) => {},
} satisfies Pick<ReactJSX.IntrinsicElements['input'], 'ref'>
// @ts-expect-error A native NodesRef must never be accepted as a DOM element ref.
export const invalidDomRef: Pick<ReactJSX.IntrinsicElements['input'], 'ref'> = nativeRef
// @ts-expect-error A DOM element ref must never be accepted as a native NodesRef.
export const invalidNativeRef: Pick<LynxJSX.IntrinsicElements['input'], 'ref'> = domRef
